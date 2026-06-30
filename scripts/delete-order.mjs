import dotenv from 'dotenv';
dotenv.config();

const ORDER_NUMBER = process.env.ORDER_NUMBER;
if (!ORDER_NUMBER) {
  console.error('Missing ORDER_NUMBER in environment');
  process.exit(1);
}

import initSqlJs from 'sql.js';
import { readFileSync, writeFileSync } from 'fs';
import path from 'path';

const DB_PATH = process.env.ORDERS_DB_PATH ? path.resolve(process.env.ORDERS_DB_PATH) : path.join(process.cwd(), 'data', 'orders.sqlite');

const SQL = await initSqlJs();
const buffer = readFileSync(DB_PATH);
const db = new SQL.Database(buffer);

const result = db.run('DELETE FROM orders WHERE order_number = ?', [ORDER_NUMBER]);
console.log(`Deleted ${result.changes} order(s) with order_number: ${ORDER_NUMBER}`);

const data = db.export();
writeFileSync(DB_PATH, Buffer.from(data));
console.log('Database saved');
