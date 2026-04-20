#!/usr/bin/env node

import { config as dotenvConfig } from 'dotenv';
dotenvConfig();

import { generateAndAttachLabelsForRange } from '../lib/wrikeDailyLabels';

function parseArgs(argv) {
	const out = { start: null, end: null, days: 7, help: false };
	for (const a of argv) {
		if (a === '--help' || a === '-h') out.help = true;
		else if (a.startsWith('--start=')) out.start = a.slice('--start='.length);
		else if (a.startsWith('--end=')) out.end = a.slice('--end='.length);
		else if (a.startsWith('--days=')) out.days = Number(a.slice('--days='.length));
	}
	return out;
}

function parseIsoDateOnly(s) {
	if (!s) return null;
	const m = String(s).match(/^(\d{4})-(\d{2})-(\d{2})$/);
	if (!m) return null;
	const d = new Date(`${m[1]}-${m[2]}-${m[3]}T00:00:00`);
	if (Number.isNaN(d.getTime())) return null;
	return d;
}

async function run() {
	const args = parseArgs(process.argv.slice(2));
	if (args.help) {
		console.log('Usage: node scripts/wrike-weekly-labels.mjs [--days=7] [--start=YYYY-MM-DD --end=YYYY-MM-DD]');
		process.exit(0);
	}

	const apiToken = process.env.WRIKE_API_TOKEN || process.env.WRIKE_TOKEN;
	const ordersFolderId = process.env.WRIKE_ORDERS_FOLDER_ID || process.env.WRIKE_FOLDER_ID;
	const labelsFolderId = process.env.WRIKE_LABELS_FOLDER_ID;
	if (!apiToken) throw new Error('Missing WRIKE_API_TOKEN (or WRIKE_TOKEN).');
	if (!ordersFolderId) throw new Error('Missing WRIKE_ORDERS_FOLDER_ID (or WRIKE_FOLDER_ID).');
	if (!labelsFolderId) throw new Error('Missing WRIKE_LABELS_FOLDER_ID.');

	let startDate = parseIsoDateOnly(args.start);
	let endDate = parseIsoDateOnly(args.end);
	if (!startDate || !endDate) {
		const end = new Date();
		end.setDate(end.getDate() - 1);
		const start = new Date(end);
		start.setDate(start.getDate() - (Number.isFinite(args.days) ? args.days : 7) + 1);
		startDate = start;
		endDate = end;
	}

	const result = await generateAndAttachLabelsForRange({
		apiToken,
		ordersFolderId,
		labelsFolderId,
		startDate,
		endDate,
	});

	console.log(JSON.stringify(result, null, 2));
	if (!result.ok) process.exit(2);
}

run().catch((e) => {
	console.error('Fatal:', e);
	process.exit(1);
});
