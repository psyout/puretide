import { google } from 'googleapis';
import type { Product, PromoCode } from '@/types/product';
import { products as baseProducts } from '@/lib/products';

const SHEET_ID = process.env.GOOGLE_SHEET_ID;
const SHEET_NAME = process.env.GOOGLE_SHEET_NAME;
const CLIENT_EMAIL = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
const PRIVATE_KEY = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY?.replace(/\\n/g, '\n');

const HEADERS = ['id', 'slug', 'name', 'subtitle', 'description', 'details', 'price', 'stock', 'category', 'mg', 'image', 'icons', 'status'] as const;
type HeaderKey = (typeof HEADERS)[number];
const REQUIRED_HEADERS: Array<HeaderKey> = ['id', 'slug', 'name', 'description', 'details', 'price', 'stock', 'category'];

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
		result[header] = index != null ? (row[index] ?? '') : '';
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
		const range = `${title}!A1:M`;

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
				subtitle: row.subtitle || undefined,
				description: row.description,
				details: row.details || undefined,
				price: parseNumber(row.price),
				stock: parseNumber(row.stock),
				image: row.image || (baseProducts.find((product) => product.id === row.id)?.image ?? ''),
				category: row.category,
				mg: row.mg || undefined,
				icons: row.icons
					? row.icons
							.split(',')
							.map((icon) => icon.trim())
							.filter(Boolean)
					: (baseProducts.find((product) => product.id === row.id)?.icons ?? []),
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
		const range = `${title}!A1:M`;

		const values = [
			[...HEADERS],
			...items.map((product) => [
				product.id,
				product.slug,
				product.name,
				product.subtitle ?? '',
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

// Client tracking
const CLIENT_HEADERS = ['Email', 'First Name', 'Last Name', 'Address', 'City', 'Province', 'Zip', 'Country', 'Orders', 'Total Spent', 'Last Order', 'Products'] as const;

type ClientRecord = {
	email: string;
	firstName: string;
	lastName: string;
	address: string;
	city: string;
	province: string;
	zipCode: string;
	country: string;
	ordersCount: number;
	totalSpent: number;
	lastOrderDate: string;
	products: string[];
};

export const upsertSheetClient = async (client: Omit<ClientRecord, 'ordersCount' | 'totalSpent' | 'products'> & { orderTotal: number; productsPurchased: string[] }) => {
	if (!SHEET_ID) return;

	try {
		const sheets = getSheetsClient();
		
		// Check if Clients sheet exists
		const spreadsheet = await sheets.spreadsheets.get({ spreadsheetId: SHEET_ID });
		const sheetExists = spreadsheet.data.sheets?.some((s) => s.properties?.title === 'Clients');

		if (!sheetExists) {
			// Create the sheet with headers
			await sheets.spreadsheets.batchUpdate({
				spreadsheetId: SHEET_ID,
				requestBody: {
					requests: [{ addSheet: { properties: { title: 'Clients' } } }],
				},
			});
			await sheets.spreadsheets.values.update({
				spreadsheetId: SHEET_ID,
				range: 'Clients!A1:L1',
				valueInputOption: 'RAW',
				requestBody: { values: [[...CLIENT_HEADERS]] },
			});
		}

		// Read existing clients
		const response = await sheets.spreadsheets.values.get({
			spreadsheetId: SHEET_ID,
			range: 'Clients!A:L',
		});

		const rows = response.data.values ?? [];
		const existingIndex = rows.findIndex((row, i) => i > 0 && row[0]?.toLowerCase() === client.email.toLowerCase());

		if (existingIndex > 0) {
			// Update existing client
			const existingRow = rows[existingIndex];
			const prevOrders = parseNumber(existingRow[8] ?? '0');
			const prevTotal = parseNumber(existingRow[9] ?? '0');
			const prevProducts = (existingRow[11] ?? '').split(', ').filter(Boolean);
			const allProducts = Array.from(new Set([...prevProducts, ...client.productsPurchased]));

			const updatedRow = [
				client.email,
				client.firstName,
				client.lastName,
				client.address,
				client.city,
				client.province,
				client.zipCode,
				client.country,
				String(prevOrders + 1),
				(prevTotal + client.orderTotal).toFixed(2),
				client.lastOrderDate,
				allProducts.join(', '),
			];

			await sheets.spreadsheets.values.update({
				spreadsheetId: SHEET_ID,
				range: `Clients!A${existingIndex + 1}:L${existingIndex + 1}`,
				valueInputOption: 'RAW',
				requestBody: { values: [updatedRow] },
			});
		} else {
			// Add new client
			const newRow = [
				client.email,
				client.firstName,
				client.lastName,
				client.address,
				client.city,
				client.province,
				client.zipCode,
				client.country,
				'1',
				client.orderTotal.toFixed(2),
				client.lastOrderDate,
				client.productsPurchased.join(', '),
			];

			await sheets.spreadsheets.values.append({
				spreadsheetId: SHEET_ID,
				range: 'Clients!A:L',
				valueInputOption: 'RAW',
				insertDataOption: 'INSERT_ROWS',
				requestBody: { values: [newRow] },
			});
		}

		console.log('Client record saved to Google Sheets');
	} catch (error) {
		console.error('Error saving client to sheet:', error);
	}
};
