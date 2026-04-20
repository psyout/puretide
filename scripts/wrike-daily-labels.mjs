#!/usr/bin/env node

import { config as dotenvConfig } from 'dotenv';
dotenvConfig();

import axios from 'axios';
import FormData from 'form-data';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { AlignmentType, Document, HeightRule, Packer, Paragraph, Table, TableCell, TableRow, TextRun, WidthType } from 'docx';

const __filename = fileURLToPath(import.meta.url);
void path.dirname(__filename);

const WRIKE_API_BASE = process.env.WRIKE_API_BASE || 'https://www.wrike.com/api/v4';

function getApiToken() {
	return process.env.WRIKE_API_TOKEN || process.env.WRIKE_TOKEN || '';
}

function getOrdersFolderId() {
	return process.env.WRIKE_FOLDER_ID || process.env.WRIKE_ORDERS_FOLDER_ID || '';
}

function stripHtml(input) {
	if (!input) return '';
	return String(input)
		.replace(/<br\s*\/?\s*>/gi, '\n')
		.replace(/<\/p>/gi, '\n')
		.replace(/<\/h\d>/gi, '\n')
		.replace(/<[^>]*>/g, '')
		.replace(/&nbsp;/g, ' ')
		.replace(/&amp;/g, '&')
		.replace(/&lt;/g, '<')
		.replace(/&gt;/g, '>')
		.replace(/\r\n/g, '\n');
}

function normalizeLines(text) {
	const lines = String(text)
		.split('\n')
		.map((l) => l.trim())
		.filter((l) => l.length > 0);

	const result = [];
	for (const line of lines) {
		const match = line.match(/(.+?)\s*([A-Z]\d[A-Z]\s?\d[A-Z]\d|\d{5}(?:-\d{4})?)\s*$/);
		if (match) {
			result.push(match[1].trim());
			result.push(match[2].trim());
		} else {
			result.push(line);
		}
	}
	return result;
}

function parseLabelFromOrderDescription(html) {
	const nameMatch = String(html).match(/<b>\s*Name:\s*<\/b>\s*([^<]+?)\s*<br\s*\/?\s*>/i);
	const name = nameMatch ? stripHtml(nameMatch[1]).trim() : '';

	const shippingMatch = String(html).match(/<h4>\s*Shipping Address\s*<\/h4>\s*<p>([\s\S]*?)<\/p>/i);
	const billingMatch = String(html).match(/<h4>\s*Billing Address\s*<\/h4>\s*<p>([\s\S]*?)<\/p>/i);
	const match = shippingMatch || billingMatch;
	if (!match) return null;
	const text = stripHtml(match[1]);
	const lines = normalizeLines(text);
	if (!lines.length) return null;

	const unitPattern = /^(unit|apt|apartment|suite|ste|#\s*)\s*([^\s]+(?:\s+[^\s]+)*)/i;
	const addressLines = [];
	let i = 0;
	while (i < lines.length) {
		const line = lines[i];
		const combinedPattern = /^([^\s]+(?:\s+[^\s]+)*)-(.+)$/;
		const combinedMatch = line.match(combinedPattern);
		if (combinedMatch) {
			addressLines.push(line);
			i += 1;
			continue;
		}

		const unitMatch = line.match(unitPattern);
		if (unitMatch && i + 1 < lines.length) {
			const number = unitMatch[2];
			const street = lines[i + 1];
			addressLines.push(`${number}-${street}`);
			i += 2;
		} else if (unitMatch && lines.length === 1) {
			const number = unitMatch[2];
			const street = line.slice(unitMatch[0].length).trim();
			addressLines.push(`${number}-${street}`);
			i += 1;
		} else {
			addressLines.push(line);
			i += 1;
		}
	}

	return { name: name || 'Recipient', lines: addressLines };
}

async function fetchAllTasksInFolder(folderId, apiToken) {
	const tasks = [];
	let nextPageToken = undefined;

	while (true) {
		const res = await axios.get(`${WRIKE_API_BASE}/folders/${folderId}/tasks`, {
			headers: { Authorization: `Bearer ${apiToken}` },
			params: {
				descendants: true,
				fields: JSON.stringify(['description']),
				nextPageToken,
			},
			validateStatus: () => true,
		});

		if (res.status < 200 || res.status >= 300) {
			throw new Error(`Wrike API ${res.status}: ${typeof res.data === 'string' ? res.data : JSON.stringify(res.data)}`);
		}

		const data = res.data || {};
		const batch = Array.isArray(data.data) ? data.data : [];
		tasks.push(...batch);
		nextPageToken = data.nextPageToken;
		if (!nextPageToken) break;
	}

	return tasks;
}

function parseArgs(argv) {
	const out = { help: false, date: null, dryRun: false };
	for (const a of argv) {
		if (a === '--help' || a === '-h') out.help = true;
		else if (a.startsWith('--date=')) out.date = a.slice('--date='.length);
		else if (a === '--dry-run') out.dryRun = true;
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

async function uploadAttachmentToTask(taskId, filePath, apiToken) {
	const form = new FormData();
	form.append('file', fs.createReadStream(filePath));

	const res = await axios.post(`${WRIKE_API_BASE}/tasks/${taskId}/attachments`, form, {
		headers: {
			Authorization: `Bearer ${apiToken}`,
			...form.getHeaders(),
		},
		maxBodyLength: Infinity,
		validateStatus: () => true,
	});

	if (res.status < 200 || res.status >= 300) {
		throw new Error(`Wrike attachment upload failed ${res.status}: ${typeof res.data === 'string' ? res.data : JSON.stringify(res.data)}`);
	}

	return res.data?.data?.[0] || null;
}

async function createTaskInFolder(folderId, title, description, apiToken) {
	const res = await axios.post(
		`${WRIKE_API_BASE}/folders/${folderId}/tasks`,
		{ title, description, status: 'Active' },
		{
			headers: { Authorization: `Bearer ${apiToken}`, 'Content-Type': 'application/json' },
			validateStatus: () => true,
		},
	);
	if (res.status < 200 || res.status >= 300) {
		throw new Error(`Wrike create task failed ${res.status}: ${typeof res.data === 'string' ? res.data : JSON.stringify(res.data)}`);
	}
	return res.data?.data?.[0] || null;
}

function toLocalDayRange(date = new Date()) {
	const start = new Date(date);
	start.setHours(0, 0, 0, 0);
	const end = new Date(date);
	end.setHours(23, 59, 59, 999);
	return { start, end };
}

async function generateAvery5162DocxSheets(labels, outputPath) {
	const pageWidth = 8.5 * 1440;
	const pageHeight = 11 * 1440;
	const labelWidth = 4 * 1440;
	const rowPitch = 1.5 * 1440;
	const topMargin = 0.5 * 1440;
	const bottomMargin = 0.5 * 1440;
	const leftMargin = 0.15625 * 1440;
	const rightMargin = 0.15625 * 1440;
	const cellPadding = 0.08 * 1440;

	const makeLabelParagraphs = (label) => {
		if (!label) return [new Paragraph('')];
		const paras = [];
		paras.push(
			new Paragraph({
				alignment: AlignmentType.LEFT,
				children: [new TextRun({ text: `To: ${label.name}`, bold: true, size: 22 })],
			}),
		);
		for (const line of label.lines || []) {
			paras.push(
				new Paragraph({
					alignment: AlignmentType.LEFT,
					children: [new TextRun({ text: line, size: 20 })],
				}),
			);
		}
		return paras;
	};

	const makeCell = (label) =>
		new TableCell({
			width: { size: labelWidth, type: WidthType.DXA },
			margins: { top: cellPadding, bottom: cellPadding, left: cellPadding, right: cellPadding },
			children: makeLabelParagraphs(label),
		});

	const makeSheetTable = (sheetLabels) => {
		const rows = [];
		for (let r = 0; r < 7; r += 1) {
			const left = sheetLabels[r * 2] || null;
			const right = sheetLabels[r * 2 + 1] || null;
			rows.push(
				new TableRow({
					height: { value: rowPitch, rule: HeightRule.EXACT },
					children: [makeCell(left), makeCell(right)],
				}),
			);
		}

		return new Table({
			width: { size: 100, type: WidthType.PERCENTAGE },
			columnWidths: [labelWidth, labelWidth],
			rows,
		});
	};

	const children = [];
	for (let i = 0; i < labels.length; i += 14) {
		const slice = labels.slice(i, i + 14);
		if (children.length) children.push(new Paragraph({ text: '', pageBreakBefore: true }));
		children.push(makeSheetTable(slice));
	}

	const doc = new Document({
		sections: [
			{
				properties: {
					page: {
						size: { width: pageWidth, height: pageHeight },
						margin: { top: topMargin, bottom: bottomMargin, left: leftMargin, right: rightMargin },
					},
				},
				children,
			},
		],
	});

	const buf = await Packer.toBuffer(doc);
	fs.writeFileSync(outputPath, buf);
}

async function run() {
	const args = parseArgs(process.argv.slice(2));
	if (args.help) {
		console.log('Usage: node scripts/wrike-daily-labels.mjs [--date=YYYY-MM-DD] [--dry-run]');
		process.exit(0);
	}

	const apiToken = getApiToken();
	if (!apiToken) {
		console.error('Missing WRIKE_API_TOKEN (or WRIKE_TOKEN).');
		process.exit(1);
	}

	const folderId = getOrdersFolderId();
	if (!folderId) {
		console.error('Missing WRIKE_ORDERS_FOLDER_ID (or WRIKE_FOLDER_ID).');
		process.exit(1);
	}

	const baseDate = parseIsoDateOnly(args.date) ?? new Date();
	const { start, end } = toLocalDayRange(baseDate);
	const isoDate = start.toISOString().slice(0, 10);

	console.log('Wrike daily Avery 5162 sheet generator\n');
	console.log('  Date:', isoDate);
	console.log('  Folder:', folderId);
	console.log('');

	const tasks = await fetchAllTasksInFolder(folderId, apiToken);
	const todays = tasks.filter((t) => {
		const created = t?.createdDate ? new Date(t.createdDate) : null;
		if (!created) return false;
		return created >= start && created <= end;
	});

	const labels = [];
	for (const task of todays) {
		const parsed = parseLabelFromOrderDescription(task?.description || '');
		if (!parsed || !parsed.name || !parsed.lines?.length) continue;
		labels.push({ taskId: task.id, name: parsed.name, lines: parsed.lines });
	}

	console.log('Tasks today:', todays.length);
	console.log('Labels parsed:', labels.length);
	if (!labels.length) {
		console.log('No labels found for today.');
		return;
	}

	const outPath = path.resolve(process.cwd(), `daily-labels-${isoDate}-avery-5162.docx`);
	await generateAvery5162DocxSheets(labels, outPath);

	if (args.dryRun) {
		console.log('Dry run enabled. Generated:', outPath);
		return;
	}

	const dailyTask = await createTaskInFolder(folderId, `Daily Labels ${isoDate}`, `Daily Avery 5162 label sheets for ${isoDate}`, apiToken);
	if (!dailyTask) {
		console.error('Failed to create daily labels task in Wrike.');
		process.exit(1);
	}

	const uploaded = await uploadAttachmentToTask(dailyTask.id, outPath, apiToken);
	if (uploaded) {
		console.log(`[OK] Daily labels task ${dailyTask.id} → attachment ${uploaded.id}`);
	} else {
		console.warn('[WARN] Failed to upload daily labels document.');
	}

	try {
		fs.unlinkSync(outPath);
	} catch {
		// ignore
	}
}

run().catch((e) => {
	console.error('Fatal:', e);
	process.exit(1);
});
