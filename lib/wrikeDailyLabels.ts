import { AlignmentType, BorderStyle, Document, HeightRule, ImageRun, Packer, Paragraph, TabStopType, Table, TableCell, TableLayoutType, TableRow, TextRun, WidthType } from 'docx';
import fs from 'node:fs';
import path from 'node:path';
import FormData from 'form-data';
import axios from 'axios';

const WRIKE_API_BASE = process.env.WRIKE_API_BASE || 'https://www.wrike.com/api/v4';

type Label = { name: string; lines: string[] };

type WrikeTask = {
	id: string;
	title?: string;
	description?: string;
	createdDate?: string;
};

type WrikeAttachment = {
	id: string;
	name?: string;
};

function parseOrderDateFromOrderDescription(html: string): Date | null {
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

function startOfLocalDay(d: Date): Date {
	const x = new Date(d);
	x.setHours(0, 0, 0, 0);
	return x;
}

function endOfLocalDay(d: Date): Date {
	const x = new Date(d);
	x.setHours(23, 59, 59, 999);
	return x;
}

function stripHtml(input: string): string {
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

function normalizeLines(text: string): string[] {
	const lines = String(text)
		.split('\n')
		.map((l) => l.trim())
		.filter((l) => l.length > 0);

	const result: string[] = [];
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

export function parseLabelFromOrderDescription(html: string): Label | null {
	const nameMatch = String(html).match(/<b>\s*Name:\s*<\/b>\s*([^<]+?)\s*<br\s*\/?\s*>/i);
	const name = nameMatch ? stripHtml(nameMatch[1]).trim() : '';

	const shippingMatch = String(html).match(/<h4>\s*Shipping Address\s*<\/h4>\s*<p>([\s\S]*?)<\/p>/i);
	const billingMatch = String(html).match(/<h4>\s*Billing Address\s*<\/h4>\s*<p>([\s\S]*?)<\/p>/i);
	const match = shippingMatch || billingMatch;

	let lines: string[] = [];
	if (match) {
		const text = stripHtml(match[1]);
		lines = normalizeLines(text);
	}

	if (lines.length === 0) {
		const text = stripHtml(html);
		const all = normalizeLines(text);

		let inferredName = name;
		if (!inferredName) {
			const n1 = text.match(/\bName:\s*(.+)$/im);
			if (n1) inferredName = n1[1].trim();
		}

		const stopRe = /^(order items|payment method|order summary|financial summary|stock remaining|order notes|status:)/i;
		const findBlock = (header: RegExp): string[] => {
			const idx = all.findIndex((l) => header.test(l));
			if (idx < 0) return [];
			const out: string[] = [];
			for (let i = idx + 1; i < all.length; i += 1) {
				const l = all[i];
				if (stopRe.test(l)) break;
				out.push(l);
			}
			return out;
		};

		lines = findBlock(/^shipping address$/i);
		if (lines.length === 0) lines = findBlock(/^billing address$/i);
		if (!inferredName || lines.length === 0) return null;
		return { name: inferredName || 'Recipient', lines };
	}

	const unitPattern = /^(unit|apt|apartment|suite|ste|#\s*)\s*([^\s]+(?:\s+[^\s]+)*)/i;
	const addressLines: string[] = [];
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

export async function generateAvery5160DocxSheets(labels: Label[], outputPath: string): Promise<void> {
	const logoPath = path.resolve(process.cwd(), 'public', 'logo.png');
	const logoBytes = fs.existsSync(logoPath) ? fs.readFileSync(logoPath) : null;
	const textIndentTwips = logoBytes ? 720 : 0;
	const noBorders = {
		top: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
		bottom: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
		left: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
		right: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
		insideH: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
		insideV: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
	};
	const offsetXIn = Number(process.env.AVERY_5160_OFFSET_X_IN ?? 0);
	const offsetYIn = Number(process.env.AVERY_5160_OFFSET_Y_IN ?? 0);
	const offsetXTwips = Number.isFinite(offsetXIn) ? offsetXIn * 1440 : 0;
	const offsetYTwips = Number.isFinite(offsetYIn) ? offsetYIn * 1440 : 0;
	const cellTopPadIn = Number(process.env.AVERY_5160_CELL_TOP_PAD_IN ?? NaN);
	let logoTransform: { width: number; height: number } | null = null;
	if (logoBytes) {
		try {
			const { default: sharp } = await import('sharp');
			const meta = await sharp(logoBytes).metadata();
			const w = meta.width ?? 0;
			const h = meta.height ?? 0;
			const targetH = 18;
			const targetW = w > 0 && h > 0 ? Math.round((w / h) * targetH) : targetH;
			logoTransform = { width: targetW, height: targetH };
		} catch {
			logoTransform = { width: 18, height: 18 };
		}
	}

	const pageWidth = 8.5 * 1440;
	const pageHeight = 11 * 1440;
	// Avery 5160/8160: 1" x 2-5/8" (30 per page)
	const labelWidth = 2.625 * 1440;
	const columnGap = 0.125 * 1440;
	const tableWidth = labelWidth * 3 + columnGap * 2;
	const rowPitch = 1 * 1440;
	// Reasonable defaults aligned with Avery 5160 style sheets; fine-tune with AVERY_5160_OFFSET_{X,Y}_IN
	const baseTopMargin = 0.5 * 1440;
	const baseBottomMargin = 0.5 * 1440;
	const baseLeftMargin = 0.1875 * 1440;
	const baseRightMargin = 0.1875 * 1440;
	const topMargin = baseTopMargin + offsetYTwips;
	const bottomMargin = Math.max(0, baseBottomMargin - offsetYTwips);
	const leftMargin = baseLeftMargin + offsetXTwips;
	const rightMargin = Math.max(0, baseRightMargin - offsetXTwips);
	const cellPadding = 0;
	const cellTopPadding = Number.isFinite(cellTopPadIn) ? cellTopPadIn * 1440 : cellPadding;

	const makeLabelParagraphs = (label: Label | null) => {
		if (!label) return [new Paragraph('')];
		const paras: Paragraph[] = [];
		const basePara = {
			alignment: AlignmentType.LEFT,
			spacing: { before: 0, after: 0 },
		} as const;

		if (logoBytes) {
			paras.push(
				new Paragraph({
					...basePara,
					tabStops: [{ type: TabStopType.LEFT, position: textIndentTwips }],
					children: [
						new ImageRun({
							data: logoBytes,
							type: 'png',
							transformation: logoTransform ?? { width: 18, height: 18 },
						}),
						new TextRun({ text: '\t' }),
						new TextRun({ text: `To: ${label.name}`, bold: true, font: 'Helvetica', size: 20 }),
					],
				}),
			);
		} else {
			paras.push(
				new Paragraph({
					...basePara,
					children: [new TextRun({ text: `To: ${label.name}`, bold: true, font: 'Helvetica', size: 20 })],
				}),
			);
		}

		for (const line of label.lines || []) {
			paras.push(
				new Paragraph({
					...basePara,
					indent: textIndentTwips ? { left: textIndentTwips } : undefined,
					children: [new TextRun({ text: line, font: 'Helvetica', size: 18 })],
				}),
			);
		}
		return paras;
	};

	const makeCell = (label: Label | null) =>
		new TableCell({
			width: { size: labelWidth, type: WidthType.DXA },
			margins: { top: cellTopPadding, bottom: cellPadding, left: cellPadding, right: cellPadding },
			borders: noBorders,
			children: makeLabelParagraphs(label),
		});

	const makeGapCell = () =>
		new TableCell({
			width: { size: columnGap, type: WidthType.DXA },
			margins: { top: 0, bottom: 0, left: 0, right: 0 },
			borders: noBorders,
			children: [new Paragraph({ spacing: { before: 0, after: 0 } })],
		});

	const makeSheetTable = (sheetLabels: Label[]) => {
		const rows: TableRow[] = [];
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
			layout: TableLayoutType.FIXED,
			borders: noBorders,
			rows,
		});
	};

	const sections = [] as { properties: any; children: (Paragraph | Table)[] }[];
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

async function fetchTasksInFolderByDateRange(folderId: string, apiToken: string, start: Date, end: Date): Promise<WrikeTask[]> {
	const allTasks: WrikeTask[] = [];
	let nextPageToken: string | undefined = undefined;
	while (true) {
		const params: any = {
			descendants: true,
			fields: JSON.stringify(['description']),
		};
		if (nextPageToken) {
			params.nextPageToken = nextPageToken;
		}
		const res: { status: number; data: any } = await axios.get(`${WRIKE_API_BASE}/folders/${folderId}/tasks`, {
			headers: { Authorization: `Bearer ${apiToken}` },
			params,
			validateStatus: () => true,
		});

		if (res.status < 200 || res.status >= 300) {
			throw new Error(`Wrike API ${res.status}: ${typeof res.data === 'string' ? res.data : JSON.stringify(res.data)}`);
		}
		const data: any = res.data || {};
		const batch = Array.isArray(data.data) ? data.data : [];
		allTasks.push(...batch);
		nextPageToken = data.nextPageToken;
		if (!nextPageToken) break;
	}

	// Prefer explicit order date embedded in the task description; fallback to Wrike task createdDate.
	return allTasks.filter((t) => {
		const desc = t?.description ?? '';
		const orderDate = parseOrderDateFromOrderDescription(desc);
		if (orderDate) {
			const day = startOfLocalDay(orderDate);
			return day >= start && day <= end;
		}
		const created = t?.createdDate ? new Date(t.createdDate) : null;
		if (!created) return false;
		return created >= start && created <= end;
	});
}

function getLabelsTaskStatus(): string | null {
	const raw = String(process.env.WRIKE_LABELS_TASK_STATUS ?? '').trim();
	return raw ? raw : null;
}

function isWrikeBasicStatus(status: string): boolean {
	// Wrike API supports these base statuses universally.
	// Custom workflow statuses typically require different fields and are not guaranteed to be accepted via `status`.
	return ['Active', 'Completed', 'Deferred', 'Cancelled'].includes(status);
}

async function findTaskIdByExactTitleInFolder(folderId: string, apiToken: string, title: string): Promise<string | null> {
	let nextPageToken: string | undefined = undefined;
	while (true) {
		const params: any = { descendants: false };
		if (nextPageToken) params.nextPageToken = nextPageToken;
		const res: { status: number; data: any } = await axios.get(`${WRIKE_API_BASE}/folders/${folderId}/tasks`, {
			headers: { Authorization: `Bearer ${apiToken}` },
			params,
			validateStatus: () => true,
		});
		if (res.status < 200 || res.status >= 300) {
			throw new Error(`Wrike API ${res.status}: ${typeof res.data === 'string' ? res.data : JSON.stringify(res.data)}`);
		}
		const data: any = res.data || {};
		const batch: any[] = Array.isArray(data.data) ? data.data : [];
		const found = batch.find((t) => String(t?.title ?? '').trim() === title.trim());
		if (found?.id) return String(found.id);
		nextPageToken = data.nextPageToken;
		if (!nextPageToken) break;
	}
	return null;
}

async function listAttachments(taskId: string, apiToken: string): Promise<WrikeAttachment[]> {
	const res: { status: number; data: any } = await axios.get(`${WRIKE_API_BASE}/tasks/${taskId}/attachments`, {
		headers: { Authorization: `Bearer ${apiToken}` },
		validateStatus: () => true,
	});
	if (res.status < 200 || res.status >= 300) {
		throw new Error(`Wrike attachments list failed ${res.status}: ${typeof res.data === 'string' ? res.data : JSON.stringify(res.data)}`);
	}
	return Array.isArray(res.data?.data) ? res.data.data : [];
}

async function tryUpdateTaskStatus(taskId: string, apiToken: string, status: string): Promise<void> {
	const res: { status: number; data: any } = await axios.put(
		`${WRIKE_API_BASE}/tasks/${taskId}`,
		{ status },
		{
			headers: { Authorization: `Bearer ${apiToken}`, 'Content-Type': 'application/json' },
			validateStatus: () => true,
		},
	);
	if (res.status < 200 || res.status >= 300) {
		console.warn(`[wrikeDailyLabels] Failed to update task status to "${status}" for task ${taskId}: ${res.status}`);
	}
}

async function createTaskInFolder(folderId: string, title: string, description: string, apiToken: string, status?: string | null): Promise<{ id: string } | null> {
	const requestedStatus = status ? String(status).trim() : '';
	const body: any = { title, description };
	if (requestedStatus && isWrikeBasicStatus(requestedStatus)) {
		body.status = requestedStatus;
	}

	const res: { status: number; data: any } = await axios.post(`${WRIKE_API_BASE}/folders/${folderId}/tasks`, body, {
		headers: { Authorization: `Bearer ${apiToken}`, 'Content-Type': 'application/json' },
		validateStatus: () => true,
	});
	if (res.status < 200 || res.status >= 300) {
		// If the caller provided a custom status string that Wrike rejects, we should not fail the entire job.
		// However, we also can't reliably infer how to set custom statuses via API without explicit configuration.
		throw new Error(`Wrike create task failed ${res.status}: ${typeof res.data === 'string' ? res.data : JSON.stringify(res.data)}`);
	}
	return res.data?.data?.[0] || null;
}

async function uploadAttachmentToTask(taskId: string, filePath: string, apiToken: string): Promise<{ id: string } | null> {
	const form = new FormData();
	form.append('file', fs.createReadStream(filePath));

	const res: { status: number; data: any } = await axios.post(`${WRIKE_API_BASE}/tasks/${taskId}/attachments`, form, {
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

function formatIsoDateOnlyLocal(d: Date): string {
	return d.toISOString().slice(0, 10);
}

export type DailyLabelsResult =
	| {
			ok: true;
			date: string;
			ordersConsidered: number;
			labelsParsed: number;
			dailyTaskId: string;
			attachmentId: string;
	  }
	| {
			ok: false;
			date: string;
			reason: string;
			ordersConsidered?: number;
			labelsParsed?: number;
	  };

export type RangeLabelsResult =
	| {
			ok: true;
			startDate: string;
			endDate: string;
			ordersConsidered: number;
			labelsParsed: number;
			taskId: string;
			attachmentId: string;
	  }
	| {
			ok: false;
			startDate: string;
			endDate: string;
			reason: string;
			ordersConsidered?: number;
			labelsParsed?: number;
	  };

function shouldFillAverySheets(): boolean {
	const raw5160 = String(process.env.AVERY_5160_FILL_SHEETS ?? '').trim();
	const raw = raw5160 || String(process.env.AVERY_5162_FILL_SHEETS ?? '').trim();
	const v = raw.toLowerCase();
	return v === '1' || v === 'true' || v === 'yes';
}

function fillLabelsToFullSheets(labels: Label[]): Label[] {
	// Avery 5160/8160: 30 labels per sheet.
	const perSheet = 30;
	if (labels.length === 0) return labels;
	const out = [...labels];
	while (out.length % perSheet !== 0) {
		out.push(out[out.length % labels.length]);
	}
	return out;
}

export async function generateAndAttachDailyLabels(params: { apiToken: string; ordersFolderId: string; labelsFolderId: string; date: Date }): Promise<DailyLabelsResult> {
	const date = params.date;
	const start = startOfLocalDay(date);
	const end = endOfLocalDay(date);
	const isoDate = formatIsoDateOnlyLocal(start);

	console.log('[wrikeDailyLabels] generateAndAttachDailyLabels:start', { isoDate, start: start.toISOString(), end: end.toISOString() });

	const inDay = await fetchTasksInFolderByDateRange(params.ordersFolderId, params.apiToken, start, end);

	let labels: Label[] = [];
	for (const task of inDay) {
		const parsed = parseLabelFromOrderDescription(task?.description ?? '');
		if (!parsed || !parsed.name || parsed.lines.length === 0) continue;
		labels.push(parsed);
	}
	if (shouldFillAverySheets()) {
		labels = fillLabelsToFullSheets(labels);
	}

	if (labels.length === 0) {
		console.log('[wrikeDailyLabels] no labels found', { isoDate, ordersConsidered: inDay.length });
		return { ok: false, date: isoDate, reason: 'no-labels', ordersConsidered: inDay.length, labelsParsed: 0 };
	}

	const outFileName = `daily-labels-${isoDate}-avery-5160.docx`;
	const outPath = path.resolve(process.cwd(), outFileName);
	await generateAvery5160DocxSheets(labels, outPath);

	try {
		const title = `Daily Labels ${isoDate}`;
		const desiredStatus = getLabelsTaskStatus();
		let taskId = await findTaskIdByExactTitleInFolder(params.labelsFolderId, params.apiToken, title);
		if (!taskId) {
			const dailyTask = await createTaskInFolder(params.labelsFolderId, title, `Daily Avery 5160/8160 label sheets for ${isoDate}`, params.apiToken, desiredStatus);
			if (!dailyTask) {
				console.error('[wrikeDailyLabels] wrike create task failed', { isoDate });
				return { ok: false, date: isoDate, reason: 'wrike-create-task-failed', ordersConsidered: inDay.length, labelsParsed: labels.length };
			}
			taskId = dailyTask.id;
		}
		if (desiredStatus) {
			await tryUpdateTaskStatus(taskId, params.apiToken, desiredStatus);
		}

		const attachments = await listAttachments(taskId, params.apiToken);
		const existing = attachments.find((a) => String(a?.name ?? '') === outFileName);
		if (existing?.id) {
			console.log('[wrikeDailyLabels] attachment already exists; skipping upload', { isoDate, taskId, attachmentId: existing.id });
			return {
				ok: true,
				date: isoDate,
				ordersConsidered: inDay.length,
				labelsParsed: labels.length,
				dailyTaskId: taskId,
				attachmentId: existing.id,
			};
		}

		const uploaded = await uploadAttachmentToTask(taskId, outPath, params.apiToken);
		if (!uploaded) {
			console.error('[wrikeDailyLabels] wrike upload failed', { isoDate, taskId });
			return { ok: false, date: isoDate, reason: 'wrike-upload-failed', ordersConsidered: inDay.length, labelsParsed: labels.length };
		}
		console.log('[wrikeDailyLabels] uploaded', { isoDate, taskId, attachmentId: uploaded.id });
		return {
			ok: true,
			date: isoDate,
			ordersConsidered: inDay.length,
			labelsParsed: labels.length,
			dailyTaskId: taskId,
			attachmentId: uploaded.id,
		};
	} finally {
		try {
			fs.unlinkSync(outPath);
		} catch {
			// ignore cleanup failure
		}
	}
}

export async function generateAndAttachLabelsForRange(params: {
	apiToken: string;
	ordersFolderId: string;
	labelsFolderId: string;
	startDate: Date;
	endDate: Date;
	title?: string;
	description?: string;
}): Promise<RangeLabelsResult> {
	const start = startOfLocalDay(params.startDate);
	const end = endOfLocalDay(params.endDate);
	const startIso = formatIsoDateOnlyLocal(start);
	const endIso = formatIsoDateOnlyLocal(end);

	const inRange = await fetchTasksInFolderByDateRange(params.ordersFolderId, params.apiToken, start, end);

	let labels: Label[] = [];
	for (const task of inRange) {
		const parsed = parseLabelFromOrderDescription(task?.description ?? '');
		if (!parsed || !parsed.name || parsed.lines.length === 0) continue;
		labels.push(parsed);
	}
	if (shouldFillAverySheets()) {
		labels = fillLabelsToFullSheets(labels);
	}

	if (labels.length === 0) {
		return { ok: false, startDate: startIso, endDate: endIso, reason: 'no-labels', ordersConsidered: inRange.length, labelsParsed: 0 };
	}

	const outFileName = `labels-${startIso}-to-${endIso}-avery-5160.docx`;
	const outPath = path.resolve(process.cwd(), outFileName);
	await generateAvery5160DocxSheets(labels, outPath);

	try {
		const title = params.title ?? `Weekly Labels ${startIso} to ${endIso}`;
		const description = params.description ?? `Avery 5160/8160 label sheets for ${startIso} to ${endIso}`;
		const desiredStatus = getLabelsTaskStatus();
		let taskId = await findTaskIdByExactTitleInFolder(params.labelsFolderId, params.apiToken, title);
		if (!taskId) {
			const task = await createTaskInFolder(params.labelsFolderId, title, description, params.apiToken, desiredStatus);
			if (!task) {
				return { ok: false, startDate: startIso, endDate: endIso, reason: 'wrike-create-task-failed', ordersConsidered: inRange.length, labelsParsed: labels.length };
			}
			taskId = task.id;
		} else if (desiredStatus) {
			await tryUpdateTaskStatus(taskId, params.apiToken, desiredStatus);
		}

		const attachments = await listAttachments(taskId, params.apiToken);
		const existing = attachments.find((a) => String(a?.name ?? '') === outFileName);
		if (existing?.id) {
			return {
				ok: true,
				startDate: startIso,
				endDate: endIso,
				ordersConsidered: inRange.length,
				labelsParsed: labels.length,
				taskId,
				attachmentId: existing.id,
			};
		}

		const uploaded = await uploadAttachmentToTask(taskId, outPath, params.apiToken);
		if (!uploaded) {
			return { ok: false, startDate: startIso, endDate: endIso, reason: 'wrike-upload-failed', ordersConsidered: inRange.length, labelsParsed: labels.length };
		}
		return {
			ok: true,
			startDate: startIso,
			endDate: endIso,
			ordersConsidered: inRange.length,
			labelsParsed: labels.length,
			taskId,
			attachmentId: uploaded.id,
		};
	} finally {
		try {
			fs.unlinkSync(outPath);
		} catch {
			// ignore cleanup failure
		}
	}
}
