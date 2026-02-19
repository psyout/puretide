import Database from 'better-sqlite3';
import { existsSync, mkdirSync, readFileSync } from 'fs';
import path from 'path';

type DbInstance = Database.Database;

export type StoredOrder = Record<string, unknown>;

export type RetryJobStatus = 'pending' | 'failed' | 'completed';

export type RetryJob = {
	id: string;
	session: string;
	attempts: number;
	nextRunAt: string;
	createdAt: string;
	updatedAt: string;
	lastError?: string;
	status: RetryJobStatus;
};

const DB_PATH = path.join(process.cwd(), 'data', 'orders.sqlite');
const LEGACY_ORDERS_JSON_PATH = path.join(process.cwd(), 'data', 'orders.json');

declare global {
	// eslint-disable-next-line no-var
	var __ordersDb: DbInstance | undefined;
}

function normalizeOrder(order: StoredOrder): StoredOrder {
	const now = new Date().toISOString();
	const id = String(order.id ?? `order_${Date.now()}`);
	const orderNumber = String(order.orderNumber ?? id);
	const createdAt = String(order.createdAt ?? now);
	const paymentStatus = String(order.paymentStatus ?? 'paid');
	return {
		...order,
		id,
		orderNumber,
		createdAt,
		paymentStatus,
	};
}

function getDb(): DbInstance {
	if (globalThis.__ordersDb) return globalThis.__ordersDb;

	mkdirSync(path.dirname(DB_PATH), { recursive: true });
	const db = new Database(DB_PATH);
	db.pragma('journal_mode = WAL');

	db.exec(`
		CREATE TABLE IF NOT EXISTS orders (
			id TEXT PRIMARY KEY,
			order_number TEXT NOT NULL UNIQUE,
			created_at TEXT NOT NULL,
			payment_status TEXT NOT NULL,
			order_json TEXT NOT NULL,
			updated_at TEXT NOT NULL
		);
		CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at DESC);
		CREATE INDEX IF NOT EXISTS idx_orders_order_number ON orders(order_number);
		CREATE INDEX IF NOT EXISTS idx_orders_payment_status ON orders(payment_status);

		CREATE TABLE IF NOT EXISTS retry_jobs (
			id TEXT PRIMARY KEY,
			session TEXT NOT NULL UNIQUE,
			attempts INTEGER NOT NULL DEFAULT 0,
			next_run_at TEXT NOT NULL,
			created_at TEXT NOT NULL,
			updated_at TEXT NOT NULL,
			last_error TEXT,
			status TEXT NOT NULL
		);
		CREATE INDEX IF NOT EXISTS idx_retry_jobs_status_next_run ON retry_jobs(status, next_run_at);
	`);

	migrateLegacyOrdersJson(db);

	globalThis.__ordersDb = db;
	return db;
}

function migrateLegacyOrdersJson(db: DbInstance) {
	const countRow = db.prepare('SELECT COUNT(*) as count FROM orders').get() as { count: number };
	if (countRow.count > 0) return;
	if (!existsSync(LEGACY_ORDERS_JSON_PATH)) return;

	try {
		const raw = readFileSync(LEGACY_ORDERS_JSON_PATH, 'utf8');
		const parsed = JSON.parse(raw);
		if (!Array.isArray(parsed) || parsed.length === 0) return;

		const stmt = db.prepare(`
			INSERT INTO orders (id, order_number, created_at, payment_status, order_json, updated_at)
			VALUES (@id, @orderNumber, @createdAt, @paymentStatus, @orderJson, @updatedAt)
			ON CONFLICT(order_number) DO UPDATE SET
				id = excluded.id,
				created_at = excluded.created_at,
				payment_status = excluded.payment_status,
				order_json = excluded.order_json,
				updated_at = excluded.updated_at
		`);

		const now = new Date().toISOString();
		const insertMany = db.transaction((items: StoredOrder[]) => {
			for (const item of items) {
				const normalized = normalizeOrder(item);
				stmt.run({
					id: String(normalized.id),
					orderNumber: String(normalized.orderNumber),
					createdAt: String(normalized.createdAt),
					paymentStatus: String(normalized.paymentStatus),
					orderJson: JSON.stringify(normalized),
					updatedAt: now,
				});
			}
		});
		insertMany(parsed as StoredOrder[]);
	} catch (error) {
		console.error('Failed to migrate legacy orders.json to SQLite', error);
	}
}

function parseOrderJson(raw: string): StoredOrder {
	try {
		return JSON.parse(raw) as StoredOrder;
	} catch {
		return {};
	}
}

export function listOrdersFromDb(): StoredOrder[] {
	const db = getDb();
	const rows = db
		.prepare('SELECT order_json FROM orders ORDER BY created_at DESC')
		.all() as Array<{ order_json: string }>;
	return rows.map((row) => parseOrderJson(row.order_json));
}

export function getOrderByOrderNumberFromDb(orderNumber: string): StoredOrder | null {
	const db = getDb();
	const row = db
		.prepare('SELECT order_json FROM orders WHERE order_number = ? LIMIT 1')
		.get(orderNumber) as { order_json: string } | undefined;
	return row ? parseOrderJson(row.order_json) : null;
}

export function getOrderBySessionFromDb(session: string): StoredOrder | null {
	const db = getDb();
	const row = db
		.prepare('SELECT order_json FROM orders WHERE order_number = ? OR id = ? LIMIT 1')
		.get(session, session) as { order_json: string } | undefined;
	return row ? parseOrderJson(row.order_json) : null;
}

export function upsertOrderInDb(order: StoredOrder): StoredOrder {
	const db = getDb();
	const normalized = normalizeOrder(order);
	const now = new Date().toISOString();
	db.prepare(`
		INSERT INTO orders (id, order_number, created_at, payment_status, order_json, updated_at)
		VALUES (?, ?, ?, ?, ?, ?)
		ON CONFLICT(order_number) DO UPDATE SET
			id = excluded.id,
			created_at = excluded.created_at,
			payment_status = excluded.payment_status,
			order_json = excluded.order_json,
			updated_at = excluded.updated_at
	`).run(
		String(normalized.id),
		String(normalized.orderNumber),
		String(normalized.createdAt),
		String(normalized.paymentStatus),
		JSON.stringify(normalized),
		now,
	);
	return normalized;
}

export function getRetryJobBySessionFromDb(session: string): RetryJob | null {
	const db = getDb();
	const row = db
		.prepare('SELECT * FROM retry_jobs WHERE session = ? LIMIT 1')
		.get(session) as
		| {
				id: string;
				session: string;
				attempts: number;
				next_run_at: string;
				created_at: string;
				updated_at: string;
				last_error?: string;
				status: RetryJobStatus;
		  }
		| undefined;
	if (!row) return null;
	return {
		id: row.id,
		session: row.session,
		attempts: Number(row.attempts),
		nextRunAt: row.next_run_at,
		createdAt: row.created_at,
		updatedAt: row.updated_at,
		lastError: row.last_error,
		status: row.status,
	};
}

export function listDuePendingRetryJobsFromDb(nowIso: string): RetryJob[] {
	const db = getDb();
	const rows = db
		.prepare('SELECT * FROM retry_jobs WHERE status = ? AND next_run_at <= ? ORDER BY next_run_at ASC')
		.all('pending', nowIso) as Array<{
		id: string;
		session: string;
		attempts: number;
		next_run_at: string;
		created_at: string;
		updated_at: string;
		last_error?: string;
		status: RetryJobStatus;
	}>;

	return rows.map((row) => ({
		id: row.id,
		session: row.session,
		attempts: Number(row.attempts),
		nextRunAt: row.next_run_at,
		createdAt: row.created_at,
		updatedAt: row.updated_at,
		lastError: row.last_error,
		status: row.status,
	}));
}

export function upsertRetryJobInDb(job: RetryJob): RetryJob {
	const db = getDb();
	const normalized: RetryJob = {
		...job,
		id: job.id || `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
		status: job.status ?? 'pending',
	};
	db.prepare(`
		INSERT INTO retry_jobs (id, session, attempts, next_run_at, created_at, updated_at, last_error, status)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?)
		ON CONFLICT(session) DO UPDATE SET
			id = excluded.id,
			attempts = excluded.attempts,
			next_run_at = excluded.next_run_at,
			updated_at = excluded.updated_at,
			last_error = excluded.last_error,
			status = excluded.status
	`).run(
		normalized.id,
		normalized.session,
		normalized.attempts,
		normalized.nextRunAt,
		normalized.createdAt,
		normalized.updatedAt,
		normalized.lastError ?? null,
		normalized.status,
	);
	return normalized;
}
