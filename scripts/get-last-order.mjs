import dotenv from 'dotenv';
dotenv.config();

import initSqlJs from 'sql.js';
import { readFileSync } from 'fs';
import path from 'path';

const DB_PATH = process.env.ORDERS_DB_PATH ? path.resolve(process.env.ORDERS_DB_PATH) : path.join(process.cwd(), 'data', 'orders.sqlite');

const SQL = await initSqlJs();
const buffer = readFileSync(DB_PATH);
const db = new SQL.Database(buffer);

const row = db.exec('SELECT order_number FROM orders ORDER BY created_at DESC LIMIT 1');
if (row.length > 0 && row[0].values.length > 0) {
  console.log(row[0].values[0][0]);
} else {
  console.log('No orders found');
}
