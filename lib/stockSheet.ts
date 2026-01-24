import { google } from 'googleapis';
import type { Product, PromoCode } from '@/types/product';
import { products as baseProducts } from '@/lib/products';

const SHEET_ID = process.env.GOOGLE_SHEET_ID;
const SHEET_NAME = process.env.GOOGLE_SHEET_NAME;
const CLIENT_EMAIL = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
const PRIVATE_KEY = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY?.replace(/\\n/g, '\n');

const HEADERS = [
	'id',
	'slug',
	'name',
	'description',
	'details',
	'price',
	'stock',
	'category',
	'mg',
	'image',
	'icons',
	'status',
] as const;
type HeaderKey = (typeof HEADERS)[number];
const REQUIRED_HEADERS: Array<HeaderKey> = [
	'id',
	'slug',
	'name',
	'description',
	'details',
	'price',
	'stock',
	'category',
];

const getSheetsClient = () => {
	if (!SHEET_ID || !CLIENT_EMAIL || !PRIVATE_KEY) {
		throw new Error('Google Sheets credentials are not configured');
	}
	const auth = new google.auth.JWT({
		email: CLIENT_EMAIL,
		key: PRIVATE_KEY,
		scopes: ['https://www.googleapis.com/auth/spreadsheets'],
	});
	return google.sheets({ version: 'v4', auth });
};

const getSheetTitle = async (sheets: ReturnType<typeof getSheetsClient>) => {
	if (SHEET_NAME) {
		return SHEET_NAME;
	}
	const response = await sheets.spreadsheets.get({
		spreadsheetId: SHEET_ID,
	});
	const firstSheet = response.data.sheets?.[0]?.properties?.title;
	if (!firstSheet) {
		throw new Error('No sheet found in spreadsheet');
	}
	return firstSheet;
};

const normalizeRow = (row: string[], headerRow: string[]): Record<HeaderKey, string> => {
	const result = {} as Record<HeaderKey, string>;
	const indexMap = headerRow.reduce<Record<string, number>>((acc, header, index) => {
		acc[header] = index;
		return acc;
	}, {});

	HEADERS.forEach((header) => {
		const index = indexMap[header];
		result[header] = index != null ? row[index] ?? '' : '';
	});
	return result;
};

const parseNumber = (value: string, fallback = 0) => {
	const numeric = Number(value);
	return Number.isFinite(numeric) ? numeric : fallback;
};

const normalizeStatus = (value?: string): NonNullable<Product['status']> => {
	switch ((value ?? '').toLowerCase()) {
		case 'active':
		case 'published':
			return 'published';
		case 'hidden':
		case 'draft':
		case 'draft list':
			return 'draft';
		case 'inactive':
			return 'inactive';
		case 'stock out':
		case 'stock-out':
			return 'stock-out';
		default:
			return 'published';
	}
};

export const readSheetProducts = async (): Promise<Product[]> => {
	try {
		const sheets = getSheetsClient();
		const title = await getSheetTitle(sheets);
		const range = `${title}!A1:L`;

		const response = await sheets.spreadsheets.values.get({
			spreadsheetId: SHEET_ID,
			range,
		});

		const rows = response.data.values ?? [];
		if (rows.length === 0) {
			return baseProducts;
		}

		const [headerRow, ...dataRows] = rows as string[][];
		const headerMatch = REQUIRED_HEADERS.every((header) => headerRow?.includes(header));
		if (!headerMatch) {
			return baseProducts;
		}

		const sheetProducts = dataRows
			.map((row) => normalizeRow(row, headerRow))
			.filter((row) => row.id)
			.map((row) => ({
				id: row.id,
				slug: row.slug,
				name: row.name,
				description: row.description,
				details: row.details || undefined,
				price: parseNumber(row.price),
				stock: parseNumber(row.stock),
				image: row.image || (baseProducts.find((product) => product.id === row.id)?.image ?? ''),
				category: row.category,
				mg: row.mg || undefined,
				icons:
					row.icons
						? row.icons
								.split(',')
								.map((icon) => icon.trim())
								.filter(Boolean)
						: baseProducts.find((product) => product.id === row.id)?.icons ?? [],
				status: normalizeStatus(row.status || baseProducts.find((product) => product.id === row.id)?.status),
			}));

		if (sheetProducts.length === 0) {
			return baseProducts;
		}

		return sheetProducts;
	} catch (error) {
		console.error('Error reading products from sheet:', error);
		return baseProducts;
	}
};

export const readSheetPromoCodes = async (): Promise<PromoCode[]> => {
	const SHEET_ID = process.env.GOOGLE_SHEET_ID;
	if (!SHEET_ID) return [];

	try {
		const sheets = getSheetsClient();
		// First, let's check if the sheet exists to provide a better error
		const spreadsheet = await sheets.spreadsheets.get({
			spreadsheetId: SHEET_ID,
		});

		const sheetExists = spreadsheet.data.sheets?.some((s) => s.properties?.title === 'PromoCodes');

		if (!sheetExists) {
			console.error('Sheet "PromoCodes" not found in the spreadsheet. Please create a tab named "PromoCodes".');
			return [];
		}

		const response = await sheets.spreadsheets.values.get({
			spreadsheetId: SHEET_ID,
			range: 'PromoCodes!A1:C',
		});

		const rows = response.data.values ?? [];
		if (rows.length <= 1) return []; // Only header or empty

		const [, ...dataRows] = rows as string[][];
		return dataRows.map((row) => ({
			code: (row[0] ?? '').trim().toUpperCase(),
			discount: parseNumber(row[1] ?? '0'),
			active: (row[2] ?? '').trim().toLowerCase() === 'true',
		}));
	} catch (error) {
		console.error('Error reading promo codes from sheet:', error);
		return [];
	}
};

export const writeSheetProducts = async (items: Product[]) => {
	try {
		const sheets = getSheetsClient();
		const title = await getSheetTitle(sheets);
		const range = `${title}!A1:L`;

		const values = [
			[...HEADERS],
			...items.map((product) => [
				product.id,
				product.slug,
				product.name,
				product.description,
				product.details ?? '',
				product.price.toFixed(2),
				String(product.stock),
				product.category,
				product.mg ?? '',
				product.image,
				(product.icons ?? []).join(', '),
				product.status ?? 'published',
			]),
		];

		await sheets.spreadsheets.values.update({
			spreadsheetId: SHEET_ID,
			range,
			valueInputOption: 'RAW',
			requestBody: { values },
		});
	} catch (error) {
		console.error('Error writing products to sheet:', error);
	}
};
