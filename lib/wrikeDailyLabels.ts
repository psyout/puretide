import { AlignmentType, Document, HeightRule, ImageRun, Packer, Paragraph, TabStopType, Table, TableCell, TableLayoutType, TableRow, TextRun, WidthType } from 'docx';
import fs from 'node:fs';
import path from 'node:path';
import FormData from 'form-data';
import axios from 'axios';

const WRIKE_API_BASE = process.env.WRIKE_API_BASE || 'https://www.wrike.com/api/v4';

type Label = { name: string; lines: string[] };

type WrikeTask = {
	id: string;
	description?: string;
	createdDate?: string;
};

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

export async function generateAvery5162DocxSheets(labels: Label[], outputPath: string): Promise<void> {
	const logoPath = path.resolve(process.cwd(), 'public', 'logo.png');
	const logoBytes = fs.existsSync(logoPath) ? fs.readFileSync(logoPath) : null;
	const textIndentTwips = logoBytes ? 1200 : 0;
	let logoTransform: { width: number; height: number } | null = null;
	if (logoBytes) {
		try {
			const { default: sharp } = await import('sharp');
			const meta = await sharp(logoBytes).metadata();
			const w = meta.width ?? 0;
			const h = meta.height ?? 0;
			const targetH = 30;
			const targetW = w > 0 && h > 0 ? Math.round((w / h) * targetH) : targetH;
			logoTransform = { width: targetW, height: targetH };
		} catch {
			logoTransform = { width: 30, height: 30 };
		}
	}

	const pageWidth = 8.5 * 1440;
	const pageHeight = 11 * 1440;
	const labelWidth = 4 * 1440;
	const rowPitch = (4 / 3) * 1440;
	const topMargin = 0.5 * 1440;
	const bottomMargin = 0.5 * 1440;
	const leftMargin = 0.15625 * 1440;
	const rightMargin = 0.15625 * 1440;
	const cellPadding = 0.08 * 1440;

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
							transformation: logoTransform ?? { width: 30, height: 30 },
						}),
						new TextRun({ text: '\t' }),
						new TextRun({ text: `To: ${label.name}`, bold: true, font: 'Helvetica', size: 28 }),
					],
				}),
			);
		} else {
			paras.push(
				new Paragraph({
					...basePara,
					children: [new TextRun({ text: `To: ${label.name}`, bold: true, font: 'Helvetica', size: 28 })],
				}),
			);
		}

		for (const line of label.lines || []) {
			paras.push(
				new Paragraph({
					...basePara,
					indent: textIndentTwips ? { left: textIndentTwips } : undefined,
					children: [new TextRun({ text: line, font: 'Helvetica', size: 24 })],
				}),
			);
		}
		return paras;
	};

	const makeCell = (label: Label | null) =>
		new TableCell({
			width: { size: labelWidth, type: WidthType.DXA },
			margins: { top: cellPadding, bottom: cellPadding, left: cellPadding, right: cellPadding },
			children: makeLabelParagraphs(label),
		});

	const makeSheetTable = (sheetLabels: Label[]) => {
		const rows: TableRow[] = [];
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
			width: { size: pageWidth - leftMargin - rightMargin, type: WidthType.DXA },
			columnWidths: [labelWidth, labelWidth],
			layout: TableLayoutType.FIXED,
			rows,
		});
	};

	const children: (Paragraph | Table)[] = [];
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
						margin: { top: topMargin, bottom: bottomMargin, left: leftMargin, right: rightMargin, header: 0, footer: 0 },
					},
				},
				children,
			},
		],
	});

	const buf = await Packer.toBuffer(doc);
	fs.writeFileSync(outputPath, buf);
}

async function fetchTasksInFolderByDateRange(folderId: string, apiToken: string, start: Date, end: Date): Promise<WrikeTask[]> {
	const tasks: WrikeTask[] = [];
	let nextPageToken: string | undefined = undefined;
	const createdDateStart = start.toISOString();
	const createdDateEnd = end.toISOString();
	while (true) {
		const res: { status: number; data: any } = await axios.get(`${WRIKE_API_BASE}/folders/${folderId}/tasks`, {
			headers: { Authorization: `Bearer ${apiToken}` },
			params: {
				descendants: true,
				fields: JSON.stringify(['description']),
				createdDate: JSON.stringify({ start: createdDateStart, end: createdDateEnd }),
				nextPageToken,
			},
			validateStatus: () => true,
		});

		if (res.status < 200 || res.status >= 300) {
			throw new Error(`Wrike API ${res.status}: ${typeof res.data === 'string' ? res.data : JSON.stringify(res.data)}`);
		}
		const data: any = res.data || {};
		const batch = Array.isArray(data.data) ? data.data : [];
		tasks.push(...batch);
		nextPageToken = data.nextPageToken;
		if (!nextPageToken) break;
	}
	return tasks;
}

async function createTaskInFolder(folderId: string, title: string, description: string, apiToken: string): Promise<{ id: string } | null> {
	const res: { status: number; data: any } = await axios.post(
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

export async function generateAndAttachDailyLabels(params: { apiToken: string; ordersFolderId: string; labelsFolderId: string; date: Date }): Promise<DailyLabelsResult> {
	const date = params.date;
	const start = startOfLocalDay(date);
	const end = endOfLocalDay(date);
	const isoDate = formatIsoDateOnlyLocal(start);

	const inDay = await fetchTasksInFolderByDateRange(params.ordersFolderId, params.apiToken, start, end);

	const labels: Label[] = [];
	for (const task of inDay) {
		const parsed = parseLabelFromOrderDescription(task?.description ?? '');
		if (!parsed || !parsed.name || parsed.lines.length === 0) continue;
		labels.push(parsed);
	}

	if (labels.length === 0) {
		return { ok: false, date: isoDate, reason: 'no-labels', ordersConsidered: inDay.length, labelsParsed: 0 };
	}

	const outPath = path.resolve(process.cwd(), `daily-labels-${isoDate}-avery-5162.docx`);
	await generateAvery5162DocxSheets(labels, outPath);

	try {
		const dailyTask = await createTaskInFolder(params.labelsFolderId, `Daily Labels ${isoDate}`, `Daily Avery 5162 label sheets for ${isoDate}`, params.apiToken);
		if (!dailyTask) {
			return { ok: false, date: isoDate, reason: 'wrike-create-task-failed', ordersConsidered: inDay.length, labelsParsed: labels.length };
		}
		const uploaded = await uploadAttachmentToTask(dailyTask.id, outPath, params.apiToken);
		if (!uploaded) {
			return { ok: false, date: isoDate, reason: 'wrike-upload-failed', ordersConsidered: inDay.length, labelsParsed: labels.length };
		}
		return {
			ok: true,
			date: isoDate,
			ordersConsidered: inDay.length,
			labelsParsed: labels.length,
			dailyTaskId: dailyTask.id,
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

	const labels: Label[] = [];
	for (const task of inRange) {
		const parsed = parseLabelFromOrderDescription(task?.description ?? '');
		if (!parsed || !parsed.name || parsed.lines.length === 0) continue;
		labels.push(parsed);
	}

	if (labels.length === 0) {
		return { ok: false, startDate: startIso, endDate: endIso, reason: 'no-labels', ordersConsidered: inRange.length, labelsParsed: 0 };
	}

	const outPath = path.resolve(process.cwd(), `labels-${startIso}-to-${endIso}-avery-5162.docx`);
	await generateAvery5162DocxSheets(labels, outPath);

	try {
		const title = params.title ?? `Weekly Labels ${startIso} to ${endIso}`;
		const description = params.description ?? `Avery 5162 label sheets for ${startIso} to ${endIso}`;
		const task = await createTaskInFolder(params.labelsFolderId, title, description, params.apiToken);
		if (!task) {
			return { ok: false, startDate: startIso, endDate: endIso, reason: 'wrike-create-task-failed', ordersConsidered: inRange.length, labelsParsed: labels.length };
		}
		const uploaded = await uploadAttachmentToTask(task.id, outPath, params.apiToken);
		if (!uploaded) {
			return { ok: false, startDate: startIso, endDate: endIso, reason: 'wrike-upload-failed', ordersConsidered: inRange.length, labelsParsed: labels.length };
		}
		return {
			ok: true,
			startDate: startIso,
			endDate: endIso,
			ordersConsidered: inRange.length,
			labelsParsed: labels.length,
			taskId: task.id,
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
