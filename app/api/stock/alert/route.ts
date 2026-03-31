import { NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';
import crypto from 'crypto';
import { readSheetProducts } from '@/lib/stockSheet';
import { sendLowStockAlert } from '@/lib/email';
import type { Product } from '@/types/product';
import { isExplicitDevBypassEnabled } from '@/lib/authEnv';
import { buildSafeApiError } from '@/lib/apiError';

const LOW_STOCK_THRESHOLD = 5;
const ALERT_EMAIL = process.env.LOW_STOCK_EMAIL ?? 'info@puretide.ca';
const DEFAULT_COOLDOWN_MINUTES = 60;
const ALERT_STATE_PATH = path.join(process.cwd(), 'data', 'low-stock.json');

type AlertState = {
	signature: string;
	sentAt: string;
};

const buildSignature = (items: Product[]) => {
	const normalized = [...items]
		.filter((item) => item != null && String(item.id ?? '').trim() !== '')
		.sort((a, b) => String(a.id ?? '').localeCompare(String(b.id ?? '')))
		.map((item) => `${String(item.id ?? '')}:${Number(item.stock ?? 0)}`)
		.join('|');
	return crypto.createHash('sha256').update(normalized).digest('hex');
};

const readAlertState = async (): Promise<AlertState | null> => {
	try {
		const contents = await fs.readFile(ALERT_STATE_PATH, 'utf8');
		return JSON.parse(contents) as AlertState;
	} catch {
		return null;
	}
};

const writeAlertState = async (signature: string, sentAt: string) => {
	await fs.mkdir(path.dirname(ALERT_STATE_PATH), { recursive: true });
	await fs.writeFile(ALERT_STATE_PATH, JSON.stringify({ signature, sentAt }), 'utf8');
};

function requireCronSecret(request: Request): boolean {
	const secret = process.env.CRON_SECRET;
	if (!secret) {
		return isExplicitDevBypassEnabled('ALLOW_UNAUTH_CRON_ALERT');
	}
	const provided =
		request.headers.get('x-cron-secret') ??
		request.headers
			.get('authorization')
			?.replace(/^Bearer\s+/i, '')
			.trim();
	return provided === secret;
}

export async function POST(request: Request) {
	if (!requireCronSecret(request)) {
		return NextResponse.json({ ok: false, error: 'Unauthorized.' }, { status: 401 });
	}
	try {
		const items = await readSheetProducts();
		const lowStock = items.filter((item) => item.stock <= LOW_STOCK_THRESHOLD);
		if (lowStock.length === 0) {
			return NextResponse.json({ ok: true, count: 0, skipped: true, reason: 'no-low-stock' });
		}

		const cooldownMinutes = Number(process.env.LOW_STOCK_COOLDOWN_MINUTES ?? DEFAULT_COOLDOWN_MINUTES);
		const now = new Date();
		const signature = buildSignature(lowStock);
		const lastState = await readAlertState();
		if (lastState) {
			const lastSentAt = new Date(lastState.sentAt);
			const minutesSince = (now.getTime() - lastSentAt.getTime()) / 60000;
			if (lastState.signature === signature && minutesSince < cooldownMinutes) {
				return NextResponse.json({
					ok: true,
					count: lowStock.length,
					skipped: true,
					reason: 'cooldown',
				});
			}
		}

		await sendLowStockAlert(lowStock);
		await writeAlertState(signature, now.toISOString());
		return NextResponse.json({ ok: true, count: lowStock.length, skipped: false });
	} catch (error) {
		const safe = buildSafeApiError({ defaultMessage: 'Failed to send alert.', error, logLabel: 'stock-alert:post' });
		return NextResponse.json({ ok: false, error: safe.message, errorId: safe.errorId }, { status: 500 });
	}
}
