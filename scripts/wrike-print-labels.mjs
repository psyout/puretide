#!/usr/bin/env node

import { config as dotenvConfig } from 'dotenv';
dotenvConfig();

import axios from 'axios';
import FormData from 'form-data';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const WRIKE_API_BASE = process.env.WRIKE_API_BASE || 'https://www.wrike.com/api/v4';

function getApiToken() {
	return process.env.WRIKE_API_TOKEN || process.env.WRIKE_TOKEN || '';
}

function getOrdersFolderId() {
	return process.env.WRIKE_FOLDER_ID || process.env.WRIKE_ORDERS_FOLDER_ID || 'MQAAAAEFtg1w';
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
	return text
		.split('\n')
		.map((l) => l.trim())
		.filter((l) => l.length > 0);
}

function tryParseLabeled(text) {
	const lines = normalizeLines(text);
	const fields = {};
	for (const line of lines) {
		const m = line.match(/^\s*([A-Za-z ]{2,}):\s*(.+)\s*$/);
		if (!m) continue;
		fields[m[1].trim().toLowerCase()] = m[2].trim();
	}
	const name = fields['name'] || fields['recipient'] || '';
	const addr = fields['address'] || fields['street'] || '';
	const city = fields['city'] || '';
	const state = fields['state'] || fields['province'] || '';
	const zip = fields['zip'] || fields['postal'] || fields['postal code'] || '';
	const country = fields['country'] || '';
	if (!name || (!addr && !(city || state || zip))) return null;

	const outLines = [];
	if (addr) outLines.push(addr);
	if (fields['address 2'] || fields['address2'] || fields['street 2'] || fields['street2']) {
		outLines.push(fields['address 2'] || fields['address2'] || fields['street 2'] || fields['street2']);
	}
	const cityLine = [city, state].filter(Boolean).join(', ');
	const zipSuffix = zip ? (cityLine ? ` ${zip}` : zip) : '';
	const combined = `${cityLine}${zipSuffix}`.trim();
	if (combined) outLines.push(combined);
	if (country) outLines.push(country);
	return { name, lines: outLines };
}

function tryParseBlock(text) {
	const lines = normalizeLines(text);
	if (lines.length < 2) return null;
	const name = lines[0];
	const addrLines = lines.slice(1);
	return { name, lines: addrLines };
}

function extractShippingAddressFromHtmlDescription(html) {
	if (!html) return null;
	const shippingMatch = String(html).match(/<h4>\s*Shipping Address\s*<\/h4>\s*<p>([\s\S]*?)<\/p>/i);
	if (!shippingMatch) return null;
	const text = stripHtml(shippingMatch[1]);
	const lines = normalizeLines(text);
	if (lines.length === 0) return null;
	return lines;
}

function parseLabelFromTask(task) {
	const rawHtml = task?.description || '';

	// Extract customer name
	const nameMatch = String(rawHtml).match(/<b>\s*Name:\s*<\/b>\s*([^<]+?)\s*<br\s*\/?\s*>/i);
	const name = nameMatch ? stripHtml(nameMatch[1]).trim() : '';

	// Extract billing address block (since shipping address section is missing in these tasks)
	const billingMatch = String(rawHtml).match(/<h4>\s*Billing Address\s*<\/h4>\s*<br\s*\/?\s*>([\s\S]*?)(?=<h4>|$)/i);
	if (!billingMatch) return null;
	const text = stripHtml(billingMatch[1]);
	const lines = normalizeLines(text);
	if (lines.length === 0) return null;

	return { name: name || 'Recipient', lines };
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

function wrapText(font, text, size, maxWidth) {
	const words = String(text).split(/\s+/).filter(Boolean);
	const lines = [];
	let current = '';

	for (const w of words) {
		const candidate = current ? `${current} ${w}` : w;
		const width = font.widthOfTextAtSize(candidate, size);
		if (width <= maxWidth) {
			current = candidate;
			continue;
		}
		if (current) lines.push(current);
		current = w;
	}
	if (current) lines.push(current);
	return lines;
}

async function generateLabelsPdf(labels, outputPath) {
	const pdfDoc = await PDFDocument.create();
	const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
	const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

	// Prototype: 4x6 inches (thermal label style)
	const pageWidth = 4 * 72;
	const pageHeight = 6 * 72;
	const margin = 18;

	for (const label of labels) {
		const page = pdfDoc.addPage([pageWidth, pageHeight]);
		let y = pageHeight - margin;
		const maxWidth = pageWidth - margin * 2;

		const nameSize = 14;
		const lineSize = 12;
		const leading = 14;

		const nameLines = wrapText(fontBold, label.name, nameSize, maxWidth);
		for (const line of nameLines) {
			y -= nameSize;
			page.drawText(line, { x: margin, y, size: nameSize, font: fontBold, color: rgb(0, 0, 0) });
			y -= 6;
		}

		y -= 6;
		for (const addrLine of label.lines) {
			const wrapped = wrapText(font, addrLine, lineSize, maxWidth);
			for (const wLine of wrapped) {
				y -= leading;
				page.drawText(wLine, { x: margin, y, size: lineSize, font, color: rgb(0, 0, 0) });
				if (y < margin) break;
			}
			if (y < margin) break;
		}
	}

	const bytes = await pdfDoc.save();
	fs.writeFileSync(outputPath, bytes);
}

async function getSubtasksForTask(parentTaskId, apiToken) {
	const res = await axios.get(`${WRIKE_API_BASE}/folders/${getOrdersFolderId()}/tasks`, {
		headers: { Authorization: `Bearer ${apiToken}` },
		params: {
			fields: JSON.stringify(['superTaskIds', 'createdDate']),
		},
		validateStatus: () => true,
	});
	if (res.status < 200 || res.status >= 300) return [];
	const data = res.data || {};
	const all = Array.isArray(data.data) ? data.data : [];
	return all.filter((t) => Array.isArray(t.superTaskIds) && t.superTaskIds.includes(parentTaskId)).sort((a, b) => new Date(b.createdDate).getTime() - new Date(a.createdDate).getTime());
}

async function findSubtaskByTitle(parentTaskId, title, apiToken) {
	const subtasks = await getSubtasksForTask(parentTaskId, apiToken);
	return subtasks.find((st) => st.title?.trim() === title.trim()) || null;
}

async function findOrCreateSubtask(parentTaskId, title, apiToken) {
	const existing = await findSubtaskByTitle(parentTaskId, title, apiToken);
	if (existing) return existing;
	// create it
	const body = { title, description: '', status: 'Active', superTasks: [parentTaskId] };
	const res = await axios.post(`${WRIKE_API_BASE}/tasks`, body, {
		headers: {
			Authorization: `Bearer ${apiToken}`,
			'Content-Type': 'application/json',
		},
		validateStatus: () => true,
	});
	if (res.status < 200 || res.status >= 300) return null;
	const data = res.data || {};
	return data.data?.[0] || null;
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

	const uploaded = res.data?.data?.[0];
	return uploaded || null;
}

async function run() {
	const apiToken = getApiToken();
	if (!apiToken) {
		console.error('Missing WRIKE_API_TOKEN (or WRIKE_TOKEN).');
		process.exit(1);
	}

	const folderId = getOrdersFolderId();

	console.log('Wrike per-order labels generator\n');
	console.log('  API base:', WRIKE_API_BASE);
	console.log('  Folder:', folderId);
	console.log('');

	const tasks = await fetchAllTasksInFolder(folderId, apiToken);
	console.log('Tasks fetched:', tasks.length);

	for (const task of tasks) {
		const parsed = parseLabelFromTask(task);
		if (!parsed || !parsed.name || !Array.isArray(parsed.lines) || parsed.lines.length === 0) {
			console.log(`[SKIP] Task ${task?.id || '(no id)'} could not parse label`);
			continue;
		}

		const tempPdf = path.resolve(process.cwd(), `label-${task.id}.pdf`);
		await generateLabelsPdf([{ taskId: task.id, name: parsed.name, lines: parsed.lines }], tempPdf);

		const subtask = await findOrCreateSubtask(task.id, 'Create shipping labels', apiToken);
		if (!subtask) {
			console.warn(`[WARN] Failed to find or create subtask for order ${task.id}`);
			fs.unlinkSync(tempPdf);
			continue;
		}

		const uploaded = await uploadAttachmentToTask(subtask.id, tempPdf, apiToken);
		if (uploaded) {
			console.log(`[OK] Order ${task.id} → subtask ${subtask.id} → attachment ${uploaded.id}`);
		} else {
			console.warn(`[WARN] Failed to upload PDF for order ${task.id}`);
		}

		try {
			fs.unlinkSync(tempPdf);
		} catch (e) {
			console.warn(`[WARN] Could not delete temp file: ${e.message}`);
		}
	}

	console.log('');
	console.log('Done.');
}

run().catch((err) => {
	console.error('Error:', err?.message || err);
	process.exit(1);
});
