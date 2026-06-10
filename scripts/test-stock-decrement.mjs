import { google } from 'googleapis';
import dotenv from 'dotenv';

dotenv.config();

const SHEET_ID = process.env.GOOGLE_SHEET_ID;
const SHEET_NAME = process.env.GOOGLE_SHEET_NAME;
const CLIENT_EMAIL = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
const PRIVATE_KEY = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY?.replace(/\\n/g, '\n');

if (!SHEET_ID || !CLIENT_EMAIL || !PRIVATE_KEY) {
	console.error('Google Sheets credentials are not configured in .env');
	process.exit(1);
}

const getSheetsClient = () => {
	const auth = new google.auth.JWT({
		email: CLIENT_EMAIL,
		key: PRIVATE_KEY,
		scopes: ['https://www.googleapis.com/auth/spreadsheets'],
	});
	return google.sheets({ version: 'v4', auth });
};

const getSheetTitle = async (sheets) => {
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

const canonicalizeHeader = (value) =>
	value
		.trim()
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, ' ')
		.replace(/\s+/g, ' ')
		.trim();

// Read current products
console.log('Reading current products from Google Sheets...');
const sheets = getSheetsClient();
const title = await getSheetTitle(sheets);
const range = `${title}!A1:Z`;

const response = await sheets.spreadsheets.values.get({
	spreadsheetId: SHEET_ID,
	range,
});

const rows = response.data.values ?? [];
if (rows.length === 0) {
	console.error('No product rows returned from Google Sheets.');
	process.exit(1);
}

const [headerRow, ...dataRows] = rows;
const indexMap = headerRow.reduce((acc, header, index) => {
	acc[canonicalizeHeader(header)] = index;
	return acc;
}, {});

const slugIdx = indexMap[canonicalizeHeader('slug')];
const nameIdx = indexMap[canonicalizeHeader('name')];
const totalStockIdx = indexMap[canonicalizeHeader('total stock')];
const jayStockIdx = indexMap[canonicalizeHeader('jay stock')];
const marcusStockIdx = indexMap[canonicalizeHeader('marcus stock')];
const statusIdx = indexMap[canonicalizeHeader('status')];

if (slugIdx === undefined || totalStockIdx === undefined) {
	console.error('Required columns not found: slug or total stock');
	process.exit(1);
}

// Pick a test product with sufficient stock
let testProduct = null;
let testRowIndex = -1;

for (let i = 0; i < dataRows.length; i++) {
	const row = dataRows[i];
	const slug = row[slugIdx];
	const stock = parseInt(row[totalStockIdx] || '0', 10);
	const status = statusIdx !== undefined ? row[statusIdx] : 'published';

	if (slug && stock > 5 && (!status || status.toLowerCase() === 'published')) {
		testProduct = {
			slug,
			name: nameIdx !== undefined ? row[nameIdx] : slug,
			stock,
			jayStock: jayStockIdx !== undefined ? row[jayStockIdx] : '',
			marcusStock: marcusStockIdx !== undefined ? row[marcusStockIdx] : '',
			rowIndex: i + 2, // +2 for header row (1-indexed)
		};
		testRowIndex = i;
		break;
	}
}

if (!testProduct) {
	console.error('No suitable test product found (needs stock > 5 and published status)');
	process.exit(1);
}

console.log('\n=== TEST PRODUCT SELECTED ===');
console.log(`Slug: ${testProduct.slug}`);
console.log(`Name: ${testProduct.name}`);
console.log(`Row Index: ${testProduct.rowIndex}`);
console.log(`Current Total Stock: ${testProduct.stock}`);
console.log(`Current Jay Stock: ${testProduct.jayStock || '(not set)'}`);
console.log(`Current Marcus Stock: ${testProduct.marcusStock || '(not set)'}`);

const originalStock = testProduct.stock;
const originalJayStock = testProduct.jayStock;
const originalMarcusStock = testProduct.marcusStock;
const testQuantity = 1;

console.log(`\n=== TEST PLAN ===`);
console.log(`Will create test order for quantity: ${testQuantity}`);
console.log(`Expected new Total Stock: ${originalStock - testQuantity}`);
console.log(`Expected Jay Stock: ${originalJayStock || '(unchanged)'}`);
console.log(`Expected Marcus Stock: ${originalMarcusStock || '(unchanged)'}`);
console.log('\n=== TEST ORDER PAYLOAD ===');
console.log(`Use this product ID: ${testProduct.slug}`);
console.log(`Product name: ${testProduct.name}`);
console.log(`\nAfter creating the order, run this script again to verify the stock decreased correctly.`);
