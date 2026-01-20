import { google } from 'googleapis';
import type { Product } from '@/types/product';
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
	const sheets = getSheetsClient();
	const title = await getSheetTitle(sheets);
	const range = `${title}!A1:K`;

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
};

export const writeSheetProducts = async (items: Product[]) => {
	const sheets = getSheetsClient();
	const title = await getSheetTitle(sheets);
	const range = `${title}!A1:K`;

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
};
