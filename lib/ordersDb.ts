import initSqlJs from 'sql.js';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import path from 'path';

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

type SqlJsDatabase = import('sql.js').SqlJsDatabase;

declare global {
	// eslint-disable-next-line no-var
	var __ordersDb: SqlJsDatabase | undefined;
	// eslint-disable-next-line no-var
	var __ordersDbInit: Promise<SqlJsDatabase> | undefined;
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

function persistDb(db: SqlJsDatabase): void {
	mkdirSync(path.dirname(DB_PATH), { recursive: true });
	const data = db.export();
	writeFileSync(DB_PATH, Buffer.from(data));
}

async function getDb(): Promise<SqlJsDatabase> {
	if (globalThis.__ordersDb) return globalThis.__ordersDb;
	if (globalThis.__ordersDbInit) return globalThis.__ordersDbInit;

	globalThis.__ordersDbInit = (async () => {
		const SQL = await initSqlJs();
		let db: SqlJsDatabase;

		if (existsSync(DB_PATH)) {
			const buffer = readFileSync(DB_PATH);
			db = new SQL.Database(buffer);
		} else {
			db = new SQL.Database();
		}

		db.run(`
			CREATE TABLE IF NOT EXISTS orders (
				id TEXT PRIMARY KEY,
				order_number TEXT NOT NULL UNIQUE,
				created_at TEXT NOT NULL,
				payment_status TEXT NOT NULL,
				order_json TEXT NOT NULL,
				updated_at TEXT NOT NULL
			);
		`);
		db.run('CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at DESC)');
		db.run('CREATE INDEX IF NOT EXISTS idx_orders_order_number ON orders(order_number)');
		db.run('CREATE INDEX IF NOT EXISTS idx_orders_payment_status ON orders(payment_status)');

		db.run(`
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
		`);
		db.run('CREATE INDEX IF NOT EXISTS idx_retry_jobs_status_next_run ON retry_jobs(status, next_run_at)');

		await migrateLegacyOrdersJson(db);
		persistDb(db);

		globalThis.__ordersDb = db;
		return db;
	})();

	return globalThis.__ordersDbInit;
}

async function migrateLegacyOrdersJson(db: SqlJsDatabase): Promise<void> {
	const result = db.exec('SELECT COUNT(*) as count FROM orders');
	const count = result.length > 0 && result[0].values[0] ? (result[0].values[0][0] as number) : 0;
	if (count > 0) return;
	if (!existsSync(LEGACY_ORDERS_JSON_PATH)) return;

	try {
		const raw = readFileSync(LEGACY_ORDERS_JSON_PATH, 'utf8');
		const parsed = JSON.parse(raw);
		if (!Array.isArray(parsed) || parsed.length === 0) return;

		const now = new Date().toISOString();
		for (const item of parsed as StoredOrder[]) {
			const normalized = normalizeOrder(item);
			db.run(
				`INSERT OR REPLACE INTO orders (id, order_number, created_at, payment_status, order_json, updated_at)
				 VALUES (?, ?, ?, ?, ?, ?)`,
				[
					String(normalized.id),
					String(normalized.orderNumber),
					String(normalized.createdAt),
					String(normalized.paymentStatus),
					JSON.stringify(normalized),
					now,
				]
			);
		}
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

export async function listOrdersFromDb(): Promise<StoredOrder[]> {
	const db = await getDb();
	const result = db.exec('SELECT order_json FROM orders ORDER BY created_at DESC');
	if (result.length === 0) return [];
	const rows = result[0];
	const colIdx = rows.columns.indexOf('order_json');
	return rows.values.map((row) => parseOrderJson(String(row[colIdx])));
}

export async function getOrderByOrderNumberFromDb(orderNumber: string): Promise<StoredOrder | null> {
	const db = await getDb();
	const stmt = db.prepare('SELECT order_json FROM orders WHERE order_number = ? LIMIT 1');
	stmt.bind([orderNumber]);
	if (!stmt.step()) {
		stmt.free();
		return null;
	}
	const row = stmt.getAsObject() as { order_json: string };
	stmt.free();
	return parseOrderJson(row.order_json);
}

export async function getOrderBySessionFromDb(session: string): Promise<StoredOrder | null> {
	const db = await getDb();
	const stmt = db.prepare(
		'SELECT order_json FROM orders WHERE order_number = ? OR id = ? LIMIT 1'
	);
	stmt.bind([session, session]);
	if (!stmt.step()) {
		stmt.free();
		return null;
	}
	const row = stmt.getAsObject() as { order_json: string };
	stmt.free();
	return parseOrderJson(row.order_json);
}

export async function upsertOrderInDb(order: StoredOrder): Promise<StoredOrder> {
	const db = await getDb();
	const normalized = normalizeOrder(order);
	const now = new Date().toISOString();
	db.run(
		`INSERT INTO orders (id, order_number, created_at, payment_status, order_json, updated_at)
		 VALUES (?, ?, ?, ?, ?, ?)
		 ON CONFLICT(order_number) DO UPDATE SET
			id = excluded.id,
			created_at = excluded.created_at,
			payment_status = excluded.payment_status,
			order_json = excluded.order_json,
			updated_at = excluded.updated_at`,
		[
			String(normalized.id),
			String(normalized.orderNumber),
			String(normalized.createdAt),
			String(normalized.paymentStatus),
			JSON.stringify(normalized),
			now,
		]
	);
	persistDb(db);
	return normalized;
}

export async function getRetryJobBySessionFromDb(session: string): Promise<RetryJob | null> {
	const db = await getDb();
	const stmt = db.prepare('SELECT * FROM retry_jobs WHERE session = ? LIMIT 1');
	stmt.bind([session]);
	if (!stmt.step()) {
		stmt.free();
		return null;
	}
	const row = stmt.getAsObject() as Record<string, unknown>;
	stmt.free();
	return {
		id: String(row.id),
		session: String(row.session),
		attempts: Number(row.attempts),
		nextRunAt: String(row.next_run_at),
		createdAt: String(row.created_at),
		updatedAt: String(row.updated_at),
		lastError: row.last_error != null ? String(row.last_error) : undefined,
		status: row.status as RetryJobStatus,
	};
}

export async function listDuePendingRetryJobsFromDb(nowIso: string): Promise<RetryJob[]> {
	const db = await getDb();
	const stmt = db.prepare(
		'SELECT * FROM retry_jobs WHERE status = ? AND next_run_at <= ? ORDER BY next_run_at ASC'
	);
	stmt.bind(['pending', nowIso]);
	const rows: RetryJob[] = [];
	while (stmt.step()) {
		const row = stmt.getAsObject() as Record<string, unknown>;
		rows.push({
			id: String(row.id),
			session: String(row.session),
			attempts: Number(row.attempts),
			nextRunAt: String(row.next_run_at),
			createdAt: String(row.created_at),
			updatedAt: String(row.updated_at),
			lastError: row.last_error != null ? String(row.last_error) : undefined,
			status: row.status as RetryJobStatus,
		});
	}
	stmt.free();
	return rows;
}

export async function upsertRetryJobInDb(job: RetryJob): Promise<RetryJob> {
	const db = await getDb();
	const normalized: RetryJob = {
		...job,
		id: job.id || `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
		status: job.status ?? 'pending',
	};
	db.run(
		`INSERT INTO retry_jobs (id, session, attempts, next_run_at, created_at, updated_at, last_error, status)
		 VALUES (?, ?, ?, ?, ?, ?, ?, ?)
		 ON CONFLICT(session) DO UPDATE SET
			id = excluded.id,
			attempts = excluded.attempts,
			next_run_at = excluded.next_run_at,
			updated_at = excluded.updated_at,
			last_error = excluded.last_error,
			status = excluded.status`,
		[
			normalized.id,
			normalized.session,
			normalized.attempts,
			normalized.nextRunAt,
			normalized.createdAt,
			normalized.updatedAt,
			normalized.lastError ?? null,
			normalized.status,
		]
	);
	persistDb(db);
	return normalized;
}
