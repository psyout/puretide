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

export type IdempotencyEntry = {
	key: string;
	route: 'orders' | 'digipay:create';
	orderNumber: string;
	orderId?: string;
	redirectUrl?: string;
	createdAt: string;
	expiresAt: string;
};

export type WebhookEventEntry = {
	provider: string;
	eventId: string;
	orderNumber: string;
	eventType: string;
	createdAt: string;
	receivedAt: string;
};

export type ShippingEmailRecord = {
	orderNumber: string;
	trackingNumber: string;
	sentAt: string;
	wrikeTaskId?: string;
	via?: string;
	route?: string;
	customerEmail?: string;
};

const DB_PATH = process.env.ORDERS_DB_PATH ? path.resolve(process.env.ORDERS_DB_PATH) : path.join(process.cwd(), 'data', 'orders.sqlite');
const LEGACY_ORDERS_JSON_PATH = process.env.LEGACY_ORDERS_JSON_PATH ? path.resolve(process.env.LEGACY_ORDERS_JSON_PATH) : path.join(process.cwd(), 'data', 'orders.json');

type SqlJsDatabase = import('sql.js').SqlJsDatabase;

declare global {
	// eslint-disable-next-line no-var
	var __ordersDb: SqlJsDatabase | undefined;
	// eslint-disable-next-line no-var
	var __ordersDbInit: Promise<SqlJsDatabase> | undefined;
}

export async function getShippingEmailRecord(orderNumber: string, trackingNumber: string): Promise<ShippingEmailRecord | null> {
	const db = await getDb();
	const stmt = db.prepare('SELECT * FROM shipping_emails WHERE order_number = ? AND tracking_number = ? LIMIT 1');
	stmt.bind([orderNumber, trackingNumber]);
	if (!stmt.step()) {
		stmt.free();
		return null;
	}
	const row = stmt.getAsObject() as Record<string, unknown>;
	stmt.free();
	return {
		orderNumber: String(row.order_number),
		trackingNumber: String(row.tracking_number),
		sentAt: String(row.sent_at),
		wrikeTaskId: row.wrike_task_id != null ? String(row.wrike_task_id) : undefined,
		via: row.via != null ? String(row.via) : undefined,
		route: row.route != null ? String(row.route) : undefined,
		customerEmail: row.customer_email != null ? String(row.customer_email) : undefined,
	};
}

export async function getAnyShippingEmailRecordForOrder(orderNumber: string): Promise<ShippingEmailRecord | null> {
	const db = await getDb();
	const stmt = db.prepare('SELECT * FROM shipping_emails WHERE order_number = ? ORDER BY sent_at DESC LIMIT 1');
	stmt.bind([orderNumber]);
	if (!stmt.step()) {
		stmt.free();
		return null;
	}
	const row = stmt.getAsObject() as Record<string, unknown>;
	stmt.free();
	return {
		orderNumber: String(row.order_number),
		trackingNumber: String(row.tracking_number),
		sentAt: String(row.sent_at),
		wrikeTaskId: row.wrike_task_id != null ? String(row.wrike_task_id) : undefined,
		via: row.via != null ? String(row.via) : undefined,
		route: row.route != null ? String(row.route) : undefined,
		customerEmail: row.customer_email != null ? String(row.customer_email) : undefined,
	};
}

export async function insertShippingEmailRecord(record: ShippingEmailRecord): Promise<void> {
	const db = await getDb();
	db.run(
		`INSERT OR IGNORE INTO shipping_emails (order_number, tracking_number, sent_at, wrike_task_id, via, route, customer_email)
		 VALUES (?, ?, ?, ?, ?, ?, ?)`,
		[record.orderNumber, record.trackingNumber, record.sentAt, record.wrikeTaskId ?? null, record.via ?? null, record.route ?? null, record.customerEmail ?? null],
	);
	persistDb(db);
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

		db.run(`
			CREATE TABLE IF NOT EXISTS idempotency (
				key TEXT NOT NULL,
				route TEXT NOT NULL,
				order_number TEXT NOT NULL,
				order_id TEXT,
				redirect_url TEXT,
				created_at TEXT NOT NULL,
				expires_at TEXT NOT NULL,
				PRIMARY KEY (key, route)
			);
		`);
		db.run('CREATE INDEX IF NOT EXISTS idx_idempotency_expires_at ON idempotency(expires_at)');

		db.run(`
			CREATE TABLE IF NOT EXISTS webhook_events (
				provider TEXT NOT NULL,
				event_id TEXT NOT NULL,
				order_number TEXT,
				event_type TEXT,
				created_at TEXT,
				received_at TEXT NOT NULL,
				PRIMARY KEY (provider, event_id)
			);
		`);
		db.run('CREATE INDEX IF NOT EXISTS idx_webhook_events_order_number ON webhook_events(order_number)');
		db.run('CREATE INDEX IF NOT EXISTS idx_webhook_events_received_at ON webhook_events(received_at DESC)');

		db.run(`
			CREATE TABLE IF NOT EXISTS shipping_emails (
				order_number TEXT NOT NULL,
				tracking_number TEXT NOT NULL,
				sent_at TEXT NOT NULL,
				wrike_task_id TEXT,
				via TEXT,
				route TEXT,
				customer_email TEXT,
				PRIMARY KEY (order_number, tracking_number)
			);
		`);
		db.run('CREATE INDEX IF NOT EXISTS idx_shipping_emails_order_number ON shipping_emails(order_number)');
		db.run('CREATE INDEX IF NOT EXISTS idx_shipping_emails_sent_at ON shipping_emails(sent_at DESC)');

		db.run(`
			CREATE TABLE IF NOT EXISTS friends_family_allowlist (
				email TEXT PRIMARY KEY,
				is_active INTEGER NOT NULL,
				note TEXT,
				created_at TEXT NOT NULL,
				updated_at TEXT NOT NULL
			);
		`);
		db.run('CREATE INDEX IF NOT EXISTS idx_friends_family_allowlist_active ON friends_family_allowlist(is_active)');

		db.run(`
			CREATE TABLE IF NOT EXISTS friends_family_email_otps (
				id TEXT PRIMARY KEY,
				email TEXT NOT NULL,
				otp_hash TEXT NOT NULL,
				salt TEXT NOT NULL,
				expires_at TEXT NOT NULL,
				attempts INTEGER NOT NULL DEFAULT 0,
				consumed_at TEXT,
				created_at TEXT NOT NULL
			);
		`);
		db.run('CREATE INDEX IF NOT EXISTS idx_friends_family_email_otps_email_expires ON friends_family_email_otps(email, expires_at)');
		db.run('CREATE INDEX IF NOT EXISTS idx_friends_family_email_otps_expires_at ON friends_family_email_otps(expires_at)');

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
				[String(normalized.id), String(normalized.orderNumber), String(normalized.createdAt), String(normalized.paymentStatus), JSON.stringify(normalized), now],
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
	const stmt = db.prepare('SELECT order_json FROM orders WHERE order_number = ? OR id = ? LIMIT 1');
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
		[String(normalized.id), String(normalized.orderNumber), String(normalized.createdAt), String(normalized.paymentStatus), JSON.stringify(normalized), now],
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
	const stmt = db.prepare('SELECT * FROM retry_jobs WHERE status = ? AND next_run_at <= ? ORDER BY next_run_at ASC');
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
		[normalized.id, normalized.session, normalized.attempts, normalized.nextRunAt, normalized.createdAt, normalized.updatedAt, normalized.lastError ?? null, normalized.status],
	);
	persistDb(db);
	return normalized;
}

export async function getIdempotencyEntry(key: string, route: 'orders' | 'digipay:create'): Promise<IdempotencyEntry | null> {
	const db = await getDb();
	const stmt = db.prepare('SELECT * FROM idempotency WHERE key = ? AND route = ? AND expires_at > ? LIMIT 1');
	const now = new Date().toISOString();
	stmt.bind([key, route, now]);
	if (!stmt.step()) {
		stmt.free();
		return null;
	}
	const row = stmt.getAsObject() as Record<string, unknown>;
	stmt.free();
	return {
		key: String(row.key),
		route: row.route as 'orders' | 'digipay:create',
		orderNumber: String(row.order_number),
		orderId: row.order_id ? String(row.order_id) : undefined,
		redirectUrl: row.redirect_url ? String(row.redirect_url) : undefined,
		createdAt: String(row.created_at),
		expiresAt: String(row.expires_at),
	};
}

export async function setIdempotencyEntry(entry: Omit<IdempotencyEntry, 'createdAt'>): Promise<void> {
	const db = await getDb();
	const now = new Date().toISOString();
	db.run(
		`INSERT OR REPLACE INTO idempotency (key, route, order_number, order_id, redirect_url, created_at, expires_at)
		 VALUES (?, ?, ?, ?, ?, ?, ?)`,
		[entry.key, entry.route, entry.orderNumber, entry.orderId ?? null, entry.redirectUrl ?? null, now, entry.expiresAt],
	);
	persistDb(db);
}

export async function deleteExpiredIdempotencyEntries(): Promise<void> {
	const db = await getDb();
	const now = new Date().toISOString();
	db.run('DELETE FROM idempotency WHERE expires_at <= ?', [now]);
	persistDb(db);
}

export async function hasProcessedWebhookEvent(provider: string, eventId: string): Promise<boolean> {
	const db = await getDb();
	const stmt = db.prepare('SELECT 1 FROM webhook_events WHERE provider = ? AND event_id = ? LIMIT 1');
	stmt.bind([provider, eventId]);
	const found = stmt.step();
	stmt.free();
	return found;
}

export async function recordWebhookEvent(entry: WebhookEventEntry): Promise<void> {
	const db = await getDb();
	db.run(
		`INSERT OR IGNORE INTO webhook_events (provider, event_id, order_number, event_type, created_at, received_at)
		 VALUES (?, ?, ?, ?, ?, ?)`,
		[entry.provider, entry.eventId, entry.orderNumber, entry.eventType, entry.createdAt, entry.receivedAt],
	);
	persistDb(db);
}

export async function getPendingRetryJobs(): Promise<RetryJob[]> {
	const db = await getDb();
	const stmt = db.prepare('SELECT * FROM retry_jobs WHERE status = ? AND next_run_at <= ? ORDER BY next_run_at ASC');
	stmt.bind(['pending', new Date().toISOString()]);
	const jobs: RetryJob[] = [];
	while (stmt.step()) {
		const row = stmt.getAsObject() as Record<string, unknown>;
		jobs.push({
			id: String(row.id),
			session: String(row.session),
			attempts: Number(row.attempts),
			nextRunAt: String(row.next_run_at),
			createdAt: String(row.created_at),
			updatedAt: String(row.updated_at),
			lastError: row.last_error ? String(row.last_error) : undefined,
			status: row.status as RetryJobStatus,
		});
	}
	stmt.free();
	return jobs;
}

export type FriendsFamilyAllowlistEntry = {
	email: string;
	isActive: boolean;
	note?: string;
	createdAt: string;
	updatedAt: string;
};

export async function listFriendsFamilyAllowlistEntries(): Promise<FriendsFamilyAllowlistEntry[]> {
	const db = await getDb();
	const result = db.exec('SELECT email, is_active, note, created_at, updated_at FROM friends_family_allowlist ORDER BY email ASC');
	if (result.length === 0) return [];
	const rows = result[0];
	const idxEmail = rows.columns.indexOf('email');
	const idxActive = rows.columns.indexOf('is_active');
	const idxNote = rows.columns.indexOf('note');
	const idxCreated = rows.columns.indexOf('created_at');
	const idxUpdated = rows.columns.indexOf('updated_at');
	return rows.values.map((row) => ({
		email: String(row[idxEmail] ?? ''),
		isActive: Number(row[idxActive] ?? 0) === 1,
		note: row[idxNote] != null ? String(row[idxNote]) : undefined,
		createdAt: String(row[idxCreated] ?? ''),
		updatedAt: String(row[idxUpdated] ?? ''),
	}));
}

export async function upsertFriendsFamilyAllowlistEntry(input: { email: string; isActive: boolean; note?: string | null }): Promise<void> {
	const db = await getDb();
	const now = new Date().toISOString();
	db.run(
		`INSERT INTO friends_family_allowlist (email, is_active, note, created_at, updated_at)
		 VALUES (?, ?, ?, ?, ?)
		 ON CONFLICT(email) DO UPDATE SET
			is_active = excluded.is_active,
			note = excluded.note,
			updated_at = excluded.updated_at`,
		[input.email, input.isActive ? 1 : 0, input.note ?? null, now, now],
	);
	persistDb(db);
}

export async function deleteFriendsFamilyAllowlistEntry(email: string): Promise<void> {
	const db = await getDb();
	db.run('DELETE FROM friends_family_allowlist WHERE email = ?', [email]);
	persistDb(db);
}

export async function isFriendsFamilyEmailAllowlisted(email: string): Promise<boolean> {
	const db = await getDb();
	const stmt = db.prepare('SELECT 1 FROM friends_family_allowlist WHERE email = ? AND is_active = 1 LIMIT 1');
	stmt.bind([email]);
	const ok = stmt.step();
	stmt.free();
	return ok;
}

export type FriendsFamilyOtpRecord = {
	id: string;
	email: string;
	otpHash: string;
	salt: string;
	expiresAt: string;
	attempts: number;
	consumedAt?: string;
	createdAt: string;
};

export async function insertFriendsFamilyOtpRecord(record: FriendsFamilyOtpRecord): Promise<void> {
	const db = await getDb();
	db.run(
		`INSERT INTO friends_family_email_otps (id, email, otp_hash, salt, expires_at, attempts, consumed_at, created_at)
		 VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
		[record.id, record.email, record.otpHash, record.salt, record.expiresAt, record.attempts, record.consumedAt ?? null, record.createdAt],
	);
	persistDb(db);
}

export async function getUnconsumedFriendsFamilyOtpByEmail(email: string, nowIso: string): Promise<FriendsFamilyOtpRecord | null> {
	const db = await getDb();
	const stmt = db.prepare(
		`SELECT id, email, otp_hash, salt, expires_at, attempts, consumed_at, created_at
		 FROM friends_family_email_otps
		 WHERE email = ? AND consumed_at IS NULL AND expires_at > ?
		 ORDER BY created_at DESC
		 LIMIT 1`,
	);
	stmt.bind([email, nowIso]);
	if (!stmt.step()) {
		stmt.free();
		return null;
	}
	const row = stmt.getAsObject() as Record<string, unknown>;
	stmt.free();
	return {
		id: String(row.id),
		email: String(row.email),
		otpHash: String(row.otp_hash),
		salt: String(row.salt),
		expiresAt: String(row.expires_at),
		attempts: Number(row.attempts ?? 0),
		consumedAt: row.consumed_at != null ? String(row.consumed_at) : undefined,
		createdAt: String(row.created_at),
	};
}

export async function incrementFriendsFamilyOtpAttempts(id: string): Promise<void> {
	const db = await getDb();
	db.run('UPDATE friends_family_email_otps SET attempts = attempts + 1 WHERE id = ?', [id]);
	persistDb(db);
}

export async function consumeFriendsFamilyOtp(id: string, consumedAtIso: string): Promise<void> {
	const db = await getDb();
	db.run('UPDATE friends_family_email_otps SET consumed_at = ? WHERE id = ? AND consumed_at IS NULL', [consumedAtIso, id]);
	persistDb(db);
}
