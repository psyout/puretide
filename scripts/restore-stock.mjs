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

// Restore stock for retatrutide from 19 back to 20
console.log('Restoring stock for retatrutide...');

const sheets = getSheetsClient();
const title = await getSheetTitle(sheets);
const range = `${title}!A1:Z`;

const response = await sheets.spreadsheets.values.get({
  spreadsheetId: SHEET_ID,
  range,
});

const rows = response.data.values ?? [];
const [headerRow, ...dataRows] = rows;
const indexMap = headerRow.reduce((acc, header, index) => {
  acc[canonicalizeHeader(header)] = index;
  return acc;
}, {});

const slugIdx = indexMap[canonicalizeHeader('slug')];
const totalStockIdx = indexMap[canonicalizeHeader('total stock')];

// Find retatrutide row
let rowIndex = -1;
for (let i = 0; i < dataRows.length; i++) {
  const row = dataRows[i];
  const slug = row[slugIdx];
  if (slug === 'retatrutide') {
    rowIndex = i + 2; // +2 for header row (1-indexed)
    console.log(`Found retatrutide at row ${rowIndex}`);
    console.log(`Current Total Stock: ${row[totalStockIdx]}`);
    break;
  }
}

if (rowIndex === -1) {
  console.error('retatrutide not found in sheet');
  process.exit(1);
}

// Update stock to 20
await sheets.spreadsheets.values.update({
  spreadsheetId: SHEET_ID,
  range: `${title}!${String.fromCharCode(65 + totalStockIdx)}${rowIndex}`,
  valueInputOption: 'USER_ENTERED',
  requestBody: { values: [['20']] },
});

console.log('✅ Stock restored to 20');
