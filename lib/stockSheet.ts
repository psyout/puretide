import { google } from 'googleapis';
import type { Product } from '@/types/product';
import { products as baseProducts } from '@/lib/products';

const SHEET_ID = process.env.GOOGLE_SHEET_ID;
const SHEET_NAME = process.env.GOOGLE_SHEET_NAME;
const CLIENT_EMAIL = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
const PRIVATE_KEY = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY?.replace(/\\n/g, '\n');

const HEADERS = ['id', 'slug', 'name', 'description', 'details', 'price', 'stock', 'category'] as const;
type HeaderKey = (typeof HEADERS)[number];

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

const normalizeRow = (row: string[]): Record<HeaderKey, string> => {
	const result = {} as Record<HeaderKey, string>;
	HEADERS.forEach((header, index) => {
		result[header] = row[index] ?? '';
	});
	return result;
};

const parseNumber = (value: string, fallback = 0) => {
	const numeric = Number(value);
	return Number.isFinite(numeric) ? numeric : fallback;
};

export const readSheetProducts = async (): Promise<Product[]> => {
	const sheets = getSheetsClient();
	const title = await getSheetTitle(sheets);
	const range = `${title}!A1:H`;

	const response = await sheets.spreadsheets.values.get({
		spreadsheetId: SHEET_ID,
		range,
	});

	const rows = response.data.values ?? [];
	if (rows.length === 0) {
		return baseProducts;
	}

	const [headerRow, ...dataRows] = rows as string[][];
	const headerMatch = HEADERS.every((header, index) => headerRow?.[index] === header);
	if (!headerMatch) {
		return baseProducts;
	}

	const sheetProducts = dataRows
		.map(normalizeRow)
		.filter((row) => row.id)
		.map((row) => ({
			id: row.id,
			slug: row.slug,
			name: row.name,
			description: row.description,
			details: row.details || undefined,
			price: parseNumber(row.price),
			stock: parseNumber(row.stock),
			image: baseProducts.find((product) => product.id === row.id)?.image ?? '',
			category: row.category,
			icons: baseProducts.find((product) => product.id === row.id)?.icons ?? [],
		}));

	if (sheetProducts.length === 0) {
		return baseProducts;
	}

	return sheetProducts;
};

export const writeSheetProducts = async (items: Product[]) => {
	const sheets = getSheetsClient();
	const title = await getSheetTitle(sheets);
	const range = `${title}!A1:H`;

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
		]),
	];

	await sheets.spreadsheets.values.update({
		spreadsheetId: SHEET_ID,
		range,
		valueInputOption: 'RAW',
		requestBody: { values },
	});
};
