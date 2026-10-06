import initSqlJs from 'sql.js';
import { existsSync, mkdirSync, readFileSync, renameSync, statSync, writeFileSync } from 'fs';
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

export type LabelGenerationRun = {
	id: string;
	cronType: 'daily' | 'afternoon' | 'range';
	date: string;
	ordersConsidered: number;
	labelsParsed: number;
	status: 'running' | 'completed' | 'failed';
	reason?: string;
	wrikeTaskId?: string;
	wrikeAttachmentId?: string;
	startedAt: string;
	completedAt?: string;
	errorMessage?: string;
};

export type AbandonedCartStatus = 'waiting' | 'sending' | 'sent' | 'recovered' | 'suppressed' | 'failed';

export type AbandonedCartItem = {
	id: string;
	quantity: number;
};

export type AbandonedCartRecord = {
	id: string;
	email: string;
	firstName?: string;
	items: AbandonedCartItem[];
	consentAt: string;
	consentText: string;
	status: AbandonedCartStatus;
	createdAt: string;
	updatedAt: string;
	lastActivityAt: string;
	sendAfter: string;
	sentAt?: string;
	recoveredAt?: string;
	clickedAt?: string;
	lastError?: string;
};

export type AbandonedCartSettings = {
	enabled: boolean;
	delayMinutes: number;
	retentionDays: number;
	updatedAt: string;
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

export async function createLabelGenerationRun(run: Omit<LabelGenerationRun, 'id' | 'startedAt'>): Promise<LabelGenerationRun> {
	const db = await getDb();
	const id = `label_run_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
	const startedAt = new Date().toISOString();

	db.run(
		`INSERT INTO label_generation_runs (id, cron_type, date, orders_considered, labels_parsed, status, reason, wrike_task_id, wrike_attachment_id, started_at, completed_at, error_message)
		 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		[
			id,
			run.cronType,
			run.date,
			run.ordersConsidered,
			run.labelsParsed,
			run.status,
			run.reason ?? null,
			run.wrikeTaskId ?? null,
			run.wrikeAttachmentId ?? null,
			startedAt,
			run.completedAt ?? null,
			run.errorMessage ?? null,
		],
	);
	persistDb(db);

	return { ...run, id, startedAt };
}

export async function updateLabelGenerationRun(
	id: string,
	updates: Partial<Pick<LabelGenerationRun, 'status' | 'ordersConsidered' | 'labelsParsed' | 'reason' | 'wrikeTaskId' | 'wrikeAttachmentId' | 'completedAt' | 'errorMessage'>>,
): Promise<void> {
	const db = await getDb();
	const fields: string[] = [];
	const values: (string | number | null)[] = [];

	if (updates.status !== undefined) {
		fields.push('status = ?');
		values.push(updates.status);
	}
	if (updates.ordersConsidered !== undefined) {
		fields.push('orders_considered = ?');
		values.push(updates.ordersConsidered);
	}
	if (updates.labelsParsed !== undefined) {
		fields.push('labels_parsed = ?');
		values.push(updates.labelsParsed);
	}
	if (updates.reason !== undefined) {
		fields.push('reason = ?');
		values.push(updates.reason);
	}
	if (updates.wrikeTaskId !== undefined) {
		fields.push('wrike_task_id = ?');
		values.push(updates.wrikeTaskId);
	}
	if (updates.wrikeAttachmentId !== undefined) {
		fields.push('wrike_attachment_id = ?');
		values.push(updates.wrikeAttachmentId);
	}
	if (updates.completedAt !== undefined) {
		fields.push('completed_at = ?');
		values.push(updates.completedAt);
	}
	if (updates.errorMessage !== undefined) {
		fields.push('error_message = ?');
		values.push(updates.errorMessage);
	}

	if (fields.length === 0) return;

	values.push(id);
	db.run(`UPDATE label_generation_runs SET ${fields.join(', ')} WHERE id = ?`, values);
	persistDb(db);
}

export async function getLabelGenerationRun(cronType: string, date: string): Promise<LabelGenerationRun | null> {
	const db = await getDb();
	const stmt = db.prepare('SELECT * FROM label_generation_runs WHERE cron_type = ? AND date = ? ORDER BY started_at DESC LIMIT 1');
	stmt.bind([cronType, date]);
	if (!stmt.step()) {
		stmt.free();
		return null;
	}
	const row = stmt.getAsObject() as Record<string, unknown>;
	stmt.free();
	return {
		id: String(row.id),
		cronType: row.cron_type as 'daily' | 'afternoon' | 'range',
		date: String(row.date),
		ordersConsidered: Number(row.orders_considered),
		labelsParsed: Number(row.labels_parsed),
		status: row.status as 'running' | 'completed' | 'failed',
		reason: row.reason != null ? String(row.reason) : undefined,
		wrikeTaskId: row.wrike_task_id != null ? String(row.wrike_task_id) : undefined,
		wrikeAttachmentId: row.wrike_attachment_id != null ? String(row.wrike_attachment_id) : undefined,
		startedAt: String(row.started_at),
		completedAt: row.completed_at != null ? String(row.completed_at) : undefined,
		errorMessage: row.error_message != null ? String(row.error_message) : undefined,
	};
}

export async function getRecentLabelGenerationRuns(limit: number = 10): Promise<LabelGenerationRun[]> {
	const db = await getDb();
	const stmt = db.prepare('SELECT * FROM label_generation_runs ORDER BY started_at DESC LIMIT ?');
	stmt.bind([limit]);
	const runs: LabelGenerationRun[] = [];
	while (stmt.step()) {
		const row = stmt.getAsObject() as Record<string, unknown>;
		runs.push({
			id: String(row.id),
			cronType: row.cron_type as 'daily' | 'afternoon' | 'range',
			date: String(row.date),
			ordersConsidered: Number(row.orders_considered),
			labelsParsed: Number(row.labels_parsed),
			status: row.status as 'running' | 'completed' | 'failed',
			reason: row.reason != null ? String(row.reason) : undefined,
			wrikeTaskId: row.wrike_task_id != null ? String(row.wrike_task_id) : undefined,
			wrikeAttachmentId: row.wrike_attachment_id != null ? String(row.wrike_attachment_id) : undefined,
			startedAt: String(row.started_at),
			completedAt: row.completed_at != null ? String(row.completed_at) : undefined,
			errorMessage: row.error_message != null ? String(row.error_message) : undefined,
		});
	}
	stmt.free();
	return runs;
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
	const temporaryPath = `${DB_PATH}.${process.pid}.tmp`;
	writeFileSync(temporaryPath, Buffer.from(data), { mode: 0o600 });
	renameSync(temporaryPath, DB_PATH);
}

async function getDb(): Promise<SqlJsDatabase> {
	if (globalThis.__ordersDb) return globalThis.__ordersDb;
	if (globalThis.__ordersDbInit) return globalThis.__ordersDbInit;

	globalThis.__ordersDbInit = (async () => {
		const wasmPath = path.join(process.cwd(), 'node_modules', 'sql.js', 'dist', 'sql-wasm.wasm');
		const SQL = await initSqlJs({
			locateFile: (file) => (file === 'sql-wasm.wasm' ? wasmPath : path.join(path.dirname(wasmPath), file)),
		});
		let db: SqlJsDatabase;

		if (existsSync(DB_PATH) && statSync(DB_PATH).size > 0) {
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

		db.run(`
			CREATE TABLE IF NOT EXISTS label_generation_runs (
				id TEXT PRIMARY KEY,
				cron_type TEXT NOT NULL,
				date TEXT NOT NULL,
				orders_considered INTEGER NOT NULL DEFAULT 0,
				labels_parsed INTEGER NOT NULL DEFAULT 0,
				status TEXT NOT NULL,
				reason TEXT,
				wrike_task_id TEXT,
				wrike_attachment_id TEXT,
				started_at TEXT NOT NULL,
				completed_at TEXT,
				error_message TEXT
			);
		`);
		db.run('CREATE INDEX IF NOT EXISTS idx_label_generation_runs_cron_type_date ON label_generation_runs(cron_type, date)');
		db.run('CREATE INDEX IF NOT EXISTS idx_label_generation_runs_started_at ON label_generation_runs(started_at DESC)');

		db.run(`
			CREATE TABLE IF NOT EXISTS abandoned_carts (
				id TEXT PRIMARY KEY,
				email TEXT NOT NULL,
				first_name TEXT,
				cart_json TEXT NOT NULL,
				consent_at TEXT NOT NULL,
				consent_text TEXT NOT NULL,
				status TEXT NOT NULL,
				created_at TEXT NOT NULL,
				updated_at TEXT NOT NULL,
				last_activity_at TEXT NOT NULL,
				send_after TEXT NOT NULL,
				sent_at TEXT,
				recovered_at TEXT,
				clicked_at TEXT,
				last_error TEXT
			);
		`);
		db.run('CREATE INDEX IF NOT EXISTS idx_abandoned_carts_status_send_after ON abandoned_carts(status, send_after)');
		db.run('CREATE INDEX IF NOT EXISTS idx_abandoned_carts_email ON abandoned_carts(email)');

		db.run(`
			CREATE TABLE IF NOT EXISTS abandoned_cart_suppressions (
				email TEXT PRIMARY KEY,
				created_at TEXT NOT NULL,
				reason TEXT NOT NULL
			);
		`);

		db.run(`
			CREATE TABLE IF NOT EXISTS abandoned_cart_settings (
				id INTEGER PRIMARY KEY CHECK (id = 1),
				enabled INTEGER NOT NULL DEFAULT 0,
				delay_minutes INTEGER NOT NULL DEFAULT 120,
				retention_days INTEGER NOT NULL DEFAULT 30,
				updated_at TEXT NOT NULL
			);
		`);
		db.run(
			`INSERT OR IGNORE INTO abandoned_cart_settings (id, enabled, delay_minutes, retention_days, updated_at)
			 VALUES (1, 0, 120, 30, ?)`,
			[new Date().toISOString()],
		);

		await migrateLegacyOrdersJson(db);
		persistDb(db);

		globalThis.__ordersDb = db;
		return db;
	})().catch((error) => {
		// A transient initialization error must not poison this process forever.
		globalThis.__ordersDbInit = undefined;
		throw error;
	});

	return globalThis.__ordersDbInit;
}

function abandonedCartFromRow(row: Record<string, unknown>): AbandonedCartRecord {
	let items: AbandonedCartItem[] = [];
	try {
		const parsed = JSON.parse(String(row.cart_json ?? '[]'));
		if (Array.isArray(parsed)) {
			items = parsed
				.map((item) => ({ id: String(item?.id ?? ''), quantity: Number(item?.quantity ?? 0) }))
				.filter((item) => item.id && Number.isInteger(item.quantity) && item.quantity > 0);
		}
	} catch {
		items = [];
	}
	return {
		id: String(row.id),
		email: String(row.email),
		firstName: row.first_name != null ? String(row.first_name) : undefined,
		items,
		consentAt: String(row.consent_at),
		consentText: String(row.consent_text),
		status: row.status as AbandonedCartStatus,
		createdAt: String(row.created_at),
		updatedAt: String(row.updated_at),
		lastActivityAt: String(row.last_activity_at),
		sendAfter: String(row.send_after),
		sentAt: row.sent_at != null ? String(row.sent_at) : undefined,
		recoveredAt: row.recovered_at != null ? String(row.recovered_at) : undefined,
		clickedAt: row.clicked_at != null ? String(row.clicked_at) : undefined,
		lastError: row.last_error != null ? String(row.last_error) : undefined,
	};
}

export async function getAbandonedCartSettings(): Promise<AbandonedCartSettings> {
	const db = await getDb();
	const stmt = db.prepare('SELECT * FROM abandoned_cart_settings WHERE id = 1 LIMIT 1');
	stmt.step();
	const row = stmt.getAsObject() as Record<string, unknown>;
	stmt.free();
	return {
		enabled: Number(row.enabled) === 1,
		delayMinutes: Number(row.delay_minutes) || 120,
		retentionDays: Number(row.retention_days) || 30,
		updatedAt: String(row.updated_at),
	};
}

export async function updateAbandonedCartSettings(input: { enabled: boolean; delayMinutes: number; retentionDays: number }): Promise<AbandonedCartSettings> {
	const db = await getDb();
	const updatedAt = new Date().toISOString();
	const delayMinutes = Math.max(30, Math.min(7 * 24 * 60, Math.round(input.delayMinutes)));
	const retentionDays = Math.max(1, Math.min(365, Math.round(input.retentionDays)));
	db.run('UPDATE abandoned_cart_settings SET enabled = ?, delay_minutes = ?, retention_days = ?, updated_at = ? WHERE id = 1', [
		input.enabled ? 1 : 0,
		delayMinutes,
		retentionDays,
		updatedAt,
	]);
	persistDb(db);
	return { enabled: input.enabled, delayMinutes, retentionDays, updatedAt };
}

export async function isAbandonedCartEmailSuppressed(email: string): Promise<boolean> {
	const db = await getDb();
	const stmt = db.prepare('SELECT 1 FROM abandoned_cart_suppressions WHERE email = ? LIMIT 1');
	stmt.bind([email.trim().toLowerCase()]);
	const found = stmt.step();
	stmt.free();
	return found;
}

export async function upsertAbandonedCart(input: {
	id: string;
	email: string;
	firstName?: string;
	items: AbandonedCartItem[];
	consentAt: string;
	consentText: string;
	sendAfter: string;
}): Promise<AbandonedCartRecord> {
	const db = await getDb();
	const now = new Date().toISOString();
	const email = input.email.trim().toLowerCase();
	db.run(
		`INSERT INTO abandoned_carts (id, email, first_name, cart_json, consent_at, consent_text, status, created_at, updated_at, last_activity_at, send_after)
		 VALUES (?, ?, ?, ?, ?, ?, 'waiting', ?, ?, ?, ?)
		 ON CONFLICT(id) DO UPDATE SET
			email = excluded.email,
			first_name = excluded.first_name,
			cart_json = excluded.cart_json,
			consent_at = excluded.consent_at,
			consent_text = excluded.consent_text,
			status = CASE WHEN abandoned_carts.status IN ('sent', 'recovered', 'suppressed') THEN abandoned_carts.status ELSE 'waiting' END,
			updated_at = excluded.updated_at,
			last_activity_at = excluded.last_activity_at,
			send_after = CASE WHEN abandoned_carts.status = 'sent' THEN abandoned_carts.send_after ELSE excluded.send_after END,
			last_error = NULL`,
		[input.id, email, input.firstName?.trim() || null, JSON.stringify(input.items), input.consentAt, input.consentText, now, now, now, input.sendAfter],
	);
	persistDb(db);
	const cart = await getAbandonedCartById(input.id);
	if (!cart) throw new Error('Failed to save abandoned cart');
	return cart;
}

export async function getAbandonedCartById(id: string): Promise<AbandonedCartRecord | null> {
	const db = await getDb();
	const stmt = db.prepare('SELECT * FROM abandoned_carts WHERE id = ? LIMIT 1');
	stmt.bind([id]);
	if (!stmt.step()) {
		stmt.free();
		return null;
	}
	const row = stmt.getAsObject() as Record<string, unknown>;
	stmt.free();
	return abandonedCartFromRow(row);
}

export async function listAbandonedCarts(limit = 100): Promise<AbandonedCartRecord[]> {
	const db = await getDb();
	const stmt = db.prepare('SELECT * FROM abandoned_carts ORDER BY updated_at DESC LIMIT ?');
	stmt.bind([Math.max(1, Math.min(500, limit))]);
	const rows: AbandonedCartRecord[] = [];
	while (stmt.step()) rows.push(abandonedCartFromRow(stmt.getAsObject() as Record<string, unknown>));
	stmt.free();
	return rows;
}

export async function listDueAbandonedCarts(nowIso: string, limit = 20): Promise<AbandonedCartRecord[]> {
	const db = await getDb();
	const stmt = db.prepare("SELECT * FROM abandoned_carts WHERE status = 'waiting' AND send_after <= ? ORDER BY send_after ASC LIMIT ?");
	stmt.bind([nowIso, Math.max(1, Math.min(100, limit))]);
	const rows: AbandonedCartRecord[] = [];
	while (stmt.step()) rows.push(abandonedCartFromRow(stmt.getAsObject() as Record<string, unknown>));
	stmt.free();
	return rows;
}

export async function claimAbandonedCartForSending(id: string): Promise<boolean> {
	const db = await getDb();
	const now = new Date().toISOString();
	db.run("UPDATE abandoned_carts SET status = 'sending', updated_at = ? WHERE id = ? AND status = 'waiting'", [now, id]);
	const changed = Number(db.exec('SELECT changes() AS count')[0]?.values[0]?.[0] ?? 0) === 1;
	if (changed) persistDb(db);
	return changed;
}

export async function requeueStaleAbandonedCartClaims(cutoffIso: string): Promise<number> {
	const db = await getDb();
	const now = new Date().toISOString();
	db.run("UPDATE abandoned_carts SET status = 'waiting', updated_at = ?, last_error = 'Recovered stale send claim' WHERE status = 'sending' AND updated_at < ?", [now, cutoffIso]);
	const count = Number(db.exec('SELECT changes() AS count')[0]?.values[0]?.[0] ?? 0);
	if (count > 0) persistDb(db);
	return count;
}

export async function updateAbandonedCartStatus(
	id: string,
	status: AbandonedCartStatus,
	updates: { sentAt?: string; recoveredAt?: string; clickedAt?: string; lastError?: string | null; sendAfter?: string } = {},
): Promise<void> {
	const db = await getDb();
	const fields = ['status = ?', 'updated_at = ?'];
	const values: Array<string | null> = [status, new Date().toISOString()];
	for (const [column, value] of [
		['sent_at', updates.sentAt],
		['recovered_at', updates.recoveredAt],
		['clicked_at', updates.clickedAt],
		['last_error', updates.lastError],
		['send_after', updates.sendAfter],
	] as const) {
		if (value !== undefined) {
			fields.push(`${column} = ?`);
			values.push(value);
		}
	}
	values.push(id);
	db.run(`UPDATE abandoned_carts SET ${fields.join(', ')} WHERE id = ?`, values);
	persistDb(db);
}

export async function suppressAbandonedCartEmail(email: string, reason = 'unsubscribe'): Promise<void> {
	const db = await getDb();
	const normalized = email.trim().toLowerCase();
	const now = new Date().toISOString();
	db.run('INSERT OR REPLACE INTO abandoned_cart_suppressions (email, created_at, reason) VALUES (?, ?, ?)', [normalized, now, reason]);
	db.run("UPDATE abandoned_carts SET status = 'suppressed', updated_at = ?, last_error = NULL WHERE email = ? AND status IN ('waiting', 'failed')", [now, normalized]);
	persistDb(db);
}

export async function markAbandonedCartsRecoveredByEmail(email: string, recoveredAt = new Date().toISOString()): Promise<void> {
	const db = await getDb();
	const normalized = email.trim().toLowerCase();
	db.run(
		"UPDATE abandoned_carts SET status = 'recovered', recovered_at = ?, updated_at = ?, last_error = NULL WHERE email = ? AND status IN ('waiting', 'sent', 'failed')",
		[recoveredAt, recoveredAt, normalized],
	);
	persistDb(db);
}

export async function deleteExpiredAbandonedCarts(cutoffIso: string): Promise<number> {
	const db = await getDb();
	db.run('DELETE FROM abandoned_carts WHERE updated_at < ?', [cutoffIso]);
	const count = Number(db.exec('SELECT changes() AS count')[0]?.values[0]?.[0] ?? 0);
	if (count > 0) persistDb(db);
	return count;
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

export async function hasOrderForEmailSince(email: string, sinceIso: string): Promise<boolean> {
	const normalized = email.trim().toLowerCase();
	const orders = await listOrdersFromDb();
	return orders.some((order) => {
		const customer = order.customer as { email?: unknown } | undefined;
		const orderEmail = String(customer?.email ?? '').trim().toLowerCase();
		const createdAt = String(order.createdAt ?? '');
		return orderEmail === normalized && createdAt >= sinceIso;
	});
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

export type PaidFulfillmentClaim = {
	paidAt: string;
	source: 'creditcard_charge' | 'creditcard_webhook';
	transactionId?: string;
	amountReceived?: number;
};

export async function updatePendingOrderIfPending(orderNumber: string, updates: StoredOrder): Promise<StoredOrder | null> {
	const db = await getDb();
	const select = db.prepare('SELECT order_json FROM orders WHERE order_number = ? AND payment_status = ? LIMIT 1');
	select.bind([orderNumber, 'pending']);
	if (!select.step()) {
		select.free();
		return null;
	}

	const row = select.getAsObject() as { order_json: string };
	select.free();
	const updatedOrder = normalizeOrder({ ...parseOrderJson(row.order_json), ...updates });
	const now = new Date().toISOString();
	db.run(
		`UPDATE orders
		 SET payment_status = ?, order_json = ?, updated_at = ?
		 WHERE order_number = ? AND payment_status = ?`,
		[String(updatedOrder.paymentStatus), JSON.stringify(updatedOrder), now, orderNumber, 'pending'],
	);
	const changesResult = db.exec('SELECT changes() AS count');
	const changedRows = Number(changesResult[0]?.values[0]?.[0] ?? 0);
	if (changedRows !== 1) {
		return null;
	}

	persistDb(db);
	return updatedOrder;
}

/**
 * Atomically moves a pending order to paid and grants the caller permission to
 * run fulfillment. Credit-card approval can arrive through both the synchronous
 * charge response and the provider webhook; only the first caller may proceed.
 */
export async function claimPaidOrderForFulfillment(orderNumber: string, claim: PaidFulfillmentClaim): Promise<StoredOrder | null> {
	const db = await getDb();
	const select = db.prepare('SELECT order_json FROM orders WHERE order_number = ? AND payment_status = ? LIMIT 1');
	select.bind([orderNumber, 'pending']);
	if (!select.step()) {
		select.free();
		return null;
	}

	const row = select.getAsObject() as { order_json: string };
	select.free();
	const current = parseOrderJson(row.order_json);
	const claimedOrder: StoredOrder = {
		...current,
		paymentStatus: 'paid',
		paidAt: claim.paidAt,
		paymentCompletion: {
			source: claim.source,
			transactionId: claim.transactionId,
			amountReceived: claim.amountReceived,
			claimedAt: claim.paidAt,
		},
	};
	const now = new Date().toISOString();

	// There is intentionally no await between the read and conditional update.
	// sql.js executes this synchronously, so concurrent request handlers cannot
	// both change the same pending order to paid in this process.
	db.run(
		`UPDATE orders
		 SET payment_status = ?, order_json = ?, updated_at = ?
		 WHERE order_number = ? AND payment_status = ?`,
		['paid', JSON.stringify(claimedOrder), now, orderNumber, 'pending'],
	);
	const changesResult = db.exec('SELECT changes() AS count');
	const changedRows = Number(changesResult[0]?.values[0]?.[0] ?? 0);
	if (changedRows !== 1) {
		return null;
	}

	persistDb(db);
	return claimedOrder;
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

export async function getRecentRetryJobs(limit: number = 20): Promise<RetryJob[]> {
	const db = await getDb();
	const stmt = db.prepare('SELECT * FROM retry_jobs ORDER BY updated_at DESC LIMIT ?');
	stmt.bind([Math.max(1, Math.min(limit, 100))]);
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
