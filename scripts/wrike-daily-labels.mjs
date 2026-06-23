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

function getLabelsFolderId() {
	return process.env.WRIKE_LABELS_FOLDER_ID || '';
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

function stripNonAddressLines(lines) {
	const badLine = (s) => {
		const x = String(s || '').trim();
		if (!x) return true;
		if (/ship\s*to\s*:?/i.test(x)) return true;
		if (/shipping\s+information\s*:?/i.test(x)) return true;
		if (/&#x[0-9a-f]+;|&#\d+;|&[a-z]+;/i.test(x) && /ship\s*to/i.test(x)) return true;
		return false;
	};

	return lines.filter((l) => !badLine(l));
}

function parseOrderDateFromOrderDescription(html) {
	if (!html) return null;
	const m = String(html).match(/<p>\s*Date:\s*([^<]+?)\s*<\/p>/i);
	if (!m) return null;
	const text = stripHtml(m[1]).trim();
	const iso = text.match(/(\d{4}-\d{2}-\d{2})/);
	if (iso) {
		const d = new Date(`${iso[1]}T00:00:00`);
		return Number.isNaN(d.getTime()) ? null : d;
	}
	const d = new Date(text);
	return Number.isNaN(d.getTime()) ? null : d;
}

function parseLabelFromOrderDescription(html) {
	const nameMatch = String(html).match(/<b>\s*Name:\s*<\/b>\s*([^<]+?)\s*<br\s*\/?\s*>/i);
	const name = nameMatch ? stripHtml(nameMatch[1]).trim() : '';

	const shippingMatch = String(html).match(/<h4>\s*Shipping Address\s*<\/h4>\s*<p>([\s\S]*?)<\/p>/i);
	const billingMatch = String(html).match(/<h4>\s*Billing Address\s*<\/h4>\s*<p>([\s\S]*?)<\/p>/i);
	const match = shippingMatch || billingMatch;

	let lines = [];
	if (match) {
		const text = stripHtml(match[1]);
		lines = stripNonAddressLines(normalizeLines(text));
	}

	if (!lines.length) {
		const text = stripHtml(html);
		const all = normalizeLines(text);

		let inferredName = name;
		if (!inferredName) {
			const n1 = text.match(/\bName:\s*(.+)$/im);
			if (n1) inferredName = n1[1].trim();
		}

		const stopRe = /^(order items|payment method|order summary|financial summary|stock remaining|order notes|status:)/i;
		const findBlock = (header) => {
			const idx = all.findIndex((l) => header.test(l));
			if (idx < 0) return [];
			const out = [];
			for (let i = idx + 1; i < all.length; i += 1) {
				const l = all[i];
				if (stopRe.test(l)) break;
				out.push(l);
			}
			return out;
		};

		lines = findBlock(/^shipping address$/i);
		if (!lines.length) lines = findBlock(/^billing address$/i);
		lines = stripNonAddressLines(lines);
		if (!inferredName || !lines.length) return null;
		return { name: inferredName || 'Recipient', lines };
	}

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

async function generateAvery5160DocxSheets(labels, outputPath) {
	const pageWidth = 8.5 * 1440;
	const pageHeight = 11 * 1440;
	// Avery 5160/8160: 1" x 2-5/8" (30 per page)
	const labelWidth = 2.625 * 1440;
	const columnGap = 0.125 * 1440;
	const tableWidth = labelWidth * 3 + columnGap * 2;
	const rowPitch = 1 * 1440;
	const topMargin = 0.5 * 1440;
	const bottomMargin = 0.5 * 1440;
	const leftMargin = 0.1875 * 1440;
	const rightMargin = 0.1875 * 1440;
	const cellPadding = 0;

	const makeLabelParagraphs = (label) => {
		if (!label) return [new Paragraph('')];
		const paras = [];
		paras.push(
			new Paragraph({
				alignment: AlignmentType.LEFT,
				spacing: { before: 0, after: 0 },
				children: [new TextRun({ text: `${label.name}`, bold: true, size: 20 })],
			}),
		);
		for (const line of label.lines || []) {
			paras.push(
				new Paragraph({
					alignment: AlignmentType.LEFT,
					spacing: { before: 0, after: 0 },
					children: [new TextRun({ text: line, size: 18 })],
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

	const makeGapCell = () =>
		new TableCell({
			width: { size: columnGap, type: WidthType.DXA },
			margins: { top: 0, bottom: 0, left: 0, right: 0 },
			children: [new Paragraph({ spacing: { before: 0, after: 0 } })],
		});

	const makeSheetTable = (sheetLabels) => {
		const rows = [];
		for (let r = 0; r < 10; r += 1) {
			const c0 = sheetLabels[r * 3] || null;
			const c1 = sheetLabels[r * 3 + 1] || null;
			const c2 = sheetLabels[r * 3 + 2] || null;
			rows.push(
				new TableRow({
					height: { value: rowPitch, rule: HeightRule.EXACT },
					children: [makeCell(c0), makeGapCell(), makeCell(c1), makeGapCell(), makeCell(c2)],
				}),
			);
		}

		return new Table({
			width: { size: tableWidth, type: WidthType.DXA },
			columnWidths: [labelWidth, columnGap, labelWidth, columnGap, labelWidth],
			rows,
		});
	};

	const sections = [];
	for (let i = 0; i < labels.length; i += 30) {
		const slice = labels.slice(i, i + 30);
		sections.push({
			properties: {
				page: {
					size: { width: pageWidth, height: pageHeight },
					margin: { top: topMargin, bottom: bottomMargin, left: leftMargin, right: rightMargin, header: 0, footer: 0 },
				},
			},
			children: [makeSheetTable(slice)],
		});
	}

	const doc = new Document({ sections });

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

	const labelsFolderId = getLabelsFolderId();
	const outputFolderId = labelsFolderId || folderId;

	const baseDate = parseIsoDateOnly(args.date) ?? new Date();
	const { start, end } = toLocalDayRange(baseDate);
	const isoDate = start.toISOString().slice(0, 10);

	console.log('Wrike daily Avery 5160/8160 sheet generator\n');
	console.log('  Date:', isoDate);
	console.log('  Folder:', outputFolderId);
	console.log('');

	const tasks = await fetchAllTasksInFolder(folderId, apiToken);
	const todays = tasks.filter((t) => {
		const orderDate = parseOrderDateFromOrderDescription(t?.description || '');
		if (orderDate) {
			const day = new Date(orderDate);
			day.setHours(0, 0, 0, 0);
			return day >= start && day <= end;
		}
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

	const outPath = path.resolve(process.cwd(), `daily-labels-${isoDate}-avery-5160.docx`);
	await generateAvery5160DocxSheets(labels, outPath);

	if (args.dryRun) {
		console.log('Dry run enabled. Generated:', outPath);
		return;
	}

	const dailyTask = await createTaskInFolder(outputFolderId, `Daily Labels ${isoDate}`, `Daily Avery 5160/8160 label sheets for ${isoDate}`, apiToken);
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
