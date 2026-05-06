import { google } from 'googleapis';
import type { Product, ProductVariant, PromoCode } from '@/types/product';
import { products as baseProducts } from '@/lib/products';

const SHEET_ID = process.env.GOOGLE_SHEET_ID;
const SHEET_NAME = process.env.GOOGLE_SHEET_NAME;
const CLIENT_EMAIL = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
const PRIVATE_KEY = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY?.replace(/\\n/g, '\n');

const HEADERS = [
	'id',
	'slug',
	'name',
	'subtitle',
	'description',
	'details',
	'price',
	'stock',
	'category',
	'mg',
	'purity',
	'image',
	'icons',
	'status',
	'price_1',
	'mg_1',
	'stock_1',
	'price_2',
	'mg_2',
	'stock_2',
] as const;
type HeaderKey = (typeof HEADERS)[number];
const REQUIRED_HEADERS: Array<HeaderKey> = ['id', 'slug', 'name', 'description', 'details', 'price', 'stock', 'category'];

const getErrorCode = (error: unknown) => (error && typeof error === 'object' && 'code' in error ? String((error as { code?: string }).code ?? '') : '');
const getErrorMessage = (error: unknown) => (error instanceof Error ? error.message : String(error));

const isExpectedSheetsFallbackError = (error: unknown) => {
	const message = getErrorMessage(error).toLowerCase();
	const code = getErrorCode(error).toUpperCase();
	return message.includes('google sheets credentials are not configured') || message.includes('getaddrinfo enotfound') || code === 'ENOTFOUND' || code === 'ETIMEDOUT' || code === 'ECONNRESET';
};

const reportSheetsError = (label: string, error: unknown) => {
	if (process.env.NODE_ENV === 'production' && isExpectedSheetsFallbackError(error)) {
		return;
	}
	if (isExpectedSheetsFallbackError(error)) {
		console.warn(`${label}: ${getErrorMessage(error)}`);
		return;
	}
	console.error(`${label}:`, error);
};

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
		const range = `${title}!A1:Z`;

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
			.map((row) => {
				const price1 = parseNumber(row.price_1);
				const mg1 = row.mg_1;
				const stock1 = parseNumber(row.stock_1);
				const price2 = parseNumber(row.price_2);
				const mg2 = row.mg_2;
				const stock2 = parseNumber(row.stock_2);

				const variants: Product['variants'] = [];
				if (mg1 && price1 > 0) {
					variants.push({
						key: `${row.id}-${mg1}`,
						label: `${mg1}mg`,
						price: price1,
						stock: stock1,
					});
				}
				if (mg2 && price2 > 0) {
					variants.push({
						key: `${row.id}-${mg2}`,
						label: `${mg2}mg`,
						price: price2,
						stock: stock2,
					});
				}

				const useVariant1 = variants.length > 0;
				const finalPrice = useVariant1 ? price1 : parseNumber(row.price);
				const finalStock = useVariant1 ? stock1 : parseNumber(row.stock);
				const finalMg = useVariant1 ? `${mg1}mg` : row.mg;

				return {
					id: row.id,
					slug: row.slug,
					name: row.name,
					subtitle: row.subtitle || undefined,
					description: row.description,
					details: row.details || undefined,
					price: finalPrice,
					stock: finalStock,
					image: row.image || (baseProducts.find((product) => product.id === row.id)?.image ?? ''),
					category: row.category,
					mg: finalMg || undefined,
					purity: row.purity || undefined,
					icons: row.icons
						? row.icons
								.split(',')
								.map((icon) => icon.trim())
								.filter(Boolean)
						: (baseProducts.find((product) => product.id === row.id)?.icons ?? []),
					status: normalizeStatus(row.status || baseProducts.find((product) => product.id === row.id)?.status),
					variants: variants.length > 0 ? variants : undefined,
					// Include raw variant columns for stock decrement
					price_1: price1 || undefined,
					mg_1: mg1 || undefined,
					stock_1: stock1 || undefined,
					price_2: price2 || undefined,
					mg_2: mg2 || undefined,
					stock_2: stock2 || undefined,
				};
			});

		if (sheetProducts.length === 0) {
			return baseProducts;
		}

		return sheetProducts;
	} catch (error) {
		reportSheetsError('Error reading products from sheet', error);
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

		const sheetExists = spreadsheet.data.sheets?.some((s: { properties?: { title?: string } }) => s.properties?.title === 'PromoCodes');

		if (!sheetExists) {
			console.error('Sheet "PromoCodes" not found in the spreadsheet. Please create a tab named "PromoCodes".');
			return [];
		}

		const response = await sheets.spreadsheets.values.get({
			spreadsheetId: SHEET_ID,
			range: 'PromoCodes!A1:D',
		});

		const rows = response.data.values ?? [];
		if (rows.length <= 1) return []; // Only header or empty

		const [, ...dataRows] = rows as string[][];
		return dataRows.map((row) => {
			const hasFourColumns = row.length >= 4;
			return {
				code: (row[0] ?? '').trim().toUpperCase(),
				discount: parseNumber(row[1] ?? '0'),
				freeShipping: hasFourColumns ? (row[2] ?? '').trim().toLowerCase() === 'true' : false,
				active: (hasFourColumns ? row[3] : (row[2] ?? '')).trim().toLowerCase() === 'true',
			};
		});
	} catch (error) {
		reportSheetsError('Error reading promo codes from sheet', error);
		return [];
	}
};

export const writeSheetPromoCodes = async (codes: PromoCode[]) => {
	if (!SHEET_ID) return;

	try {
		const sheets = getSheetsClient();
		const spreadsheet = await sheets.spreadsheets.get({ spreadsheetId: SHEET_ID });
		const sheetExists = spreadsheet.data.sheets?.some((s: { properties?: { title?: string } }) => s.properties?.title === 'PromoCodes');
		if (!sheetExists) {
			console.error('Sheet "PromoCodes" not found. Create a "PromoCodes" tab with headers: Code, Discount, FreeShipping, Active');
			return;
		}
		const values = [['Code', 'Discount', 'FreeShipping', 'Active'], ...codes.map((c) => [c.code, String(c.discount), c.freeShipping ? 'true' : 'false', c.active ? 'true' : 'false'])];
		await sheets.spreadsheets.values.update({
			spreadsheetId: SHEET_ID,
			range: 'PromoCodes!A1:D',
			valueInputOption: 'RAW',
			requestBody: { values },
		});
	} catch (error) {
		reportSheetsError('Error writing promo codes to sheet', error);
		throw error;
	}
};

export const readSheetClients = async (): Promise<ClientRecord[]> => {
	if (!SHEET_ID) return [];

	try {
		const sheets = getSheetsClient();
		const spreadsheet = await sheets.spreadsheets.get({ spreadsheetId: SHEET_ID });
		const sheetExists = spreadsheet.data.sheets?.some((s: { properties?: { title?: string } }) => s.properties?.title === 'Clients');
		if (!sheetExists) return [];

		const response = await sheets.spreadsheets.values.get({
			spreadsheetId: SHEET_ID,
			range: 'Clients!A:M',
		});
		const rows = response.data.values ?? [];
		if (rows.length <= 1) return [];

		const [, ...dataRows] = rows as string[][];
		return dataRows.map((row) => ({
			email: (row[0] ?? '').trim(),
			firstName: (row[1] ?? '').trim(),
			lastName: (row[2] ?? '').trim(),
			address: (row[3] ?? '').trim(),
			city: (row[4] ?? '').trim(),
			province: (row[5] ?? '').trim(),
			zipCode: (row[6] ?? '').trim(),
			country: (row[7] ?? '').trim(),
			ordersCount: parseNumber(row[8] ?? '0'),
			totalSpent: parseNumber(row[9] ?? '0'),
			lastOrderDate: (row[10] ?? '').trim(),
			products: (row[11] ?? '').split(', ').filter(Boolean),
			howDidYouHear: (row[12] ?? '').trim(),
		}));
	} catch (error) {
		reportSheetsError('Error reading clients from sheet', error);
		return [];
	}
};

export const writeSheetProducts = async (items: Product[]) => {
	try {
		const sheets = getSheetsClient();
		const title = await getSheetTitle(sheets);
		const range = `${title}!A1:Z`;

		const values = [
			[...HEADERS],
			...items.map((product) => {
				const variant1 = product.variants?.[0];
				const variant2 = product.variants?.[1];
				return [
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
					product.purity ?? '',
					product.image,
					(product.icons ?? []).join(', '),
					product.status ?? 'published',
					variant1?.price.toFixed(2) ?? '',
					variant1?.label.replace('mg', '') ?? '',
					String(variant1?.stock ?? ''),
					variant2?.price.toFixed(2) ?? '',
					variant2?.label.replace('mg', '') ?? '',
					String(variant2?.stock ?? ''),
				];
			}),
		];

		await sheets.spreadsheets.values.update({
			spreadsheetId: SHEET_ID,
			range,
			valueInputOption: 'RAW',
			requestBody: { values },
		});
	} catch (error) {
		reportSheetsError('Error writing products to sheet', error);
	}
};

// Client tracking
const CLIENT_HEADERS = ['Email', 'First Name', 'Last Name', 'Address', 'City', 'Province', 'Zip', 'Country', 'Orders', 'Total Spent', 'Last Order', 'Products', 'How Did You Hear'] as const;

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
	howDidYouHear?: string;
};

export const upsertSheetClient = async (client: Omit<ClientRecord, 'ordersCount' | 'totalSpent' | 'products'> & { orderTotal: number; productsPurchased: string[]; howDidYouHear?: string }) => {
	if (!SHEET_ID) return;

	try {
		const sheets = getSheetsClient();

		// Check if Clients sheet exists
		const spreadsheet = await sheets.spreadsheets.get({ spreadsheetId: SHEET_ID });
		const sheetExists = spreadsheet.data.sheets?.some((s: { properties?: { title?: string } }) => s.properties?.title === 'Clients');

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
				range: 'Clients!A1:M1',
				valueInputOption: 'RAW',
				requestBody: { values: [[...CLIENT_HEADERS]] },
			});
		}

		// Read existing clients
		const response = await sheets.spreadsheets.values.get({
			spreadsheetId: SHEET_ID,
			range: 'Clients!A:M',
		});

		const rows = response.data.values ?? [];
		const existingIndex = rows.findIndex((row: string[], i: number) => i > 0 && row[0]?.toLowerCase() === client.email.toLowerCase());

		if (existingIndex > 0) {
			// Update existing client
			const existingRow = rows[existingIndex];
			const prevOrders = parseNumber(existingRow[8] ?? '0');
			const prevTotal = parseNumber(existingRow[9] ?? '0');
			const prevProducts = (existingRow[11] ?? '').split(', ').filter(Boolean);
			const prevHowDidYouHear = (existingRow[12] ?? '').trim();
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
				client.howDidYouHear || prevHowDidYouHear,
			];

			await sheets.spreadsheets.values.update({
				spreadsheetId: SHEET_ID,
				range: `Clients!A${existingIndex + 1}:M${existingIndex + 1}`,
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
				client.howDidYouHear ?? '',
			];

			await sheets.spreadsheets.values.append({
				spreadsheetId: SHEET_ID,
				range: 'Clients!A:M',
				valueInputOption: 'RAW',
				insertDataOption: 'INSERT_ROWS',
				requestBody: { values: [newRow] },
			});
		}

		console.log('Client record saved to Google Sheets');
	} catch (error) {
		reportSheetsError('Error saving client to sheet', error);
	}
};
