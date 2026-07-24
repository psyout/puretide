#!/usr/bin/env node

import { config as dotenvConfig } from 'dotenv';
dotenvConfig();

import axios from 'axios';

const WRIKE_API_BASE = process.env.WRIKE_API_BASE || 'https://www.wrike.com/api/v4';
const API_TOKEN = process.env.WRIKE_API_TOKEN || process.env.WRIKE_TOKEN;
const ORDERS_FOLDER_ID = process.env.WRIKE_ORDERS_FOLDER_ID || process.env.WRIKE_FOLDER_ID;

if (!API_TOKEN) {
  console.error('❌ Missing WRIKE_API_TOKEN');
  process.exit(1);
}

if (!ORDERS_FOLDER_ID) {
  console.error('❌ Missing WRIKE_ORDERS_FOLDER_ID');
  process.exit(1);
}

function parseOrderDateFromOrderDescription(html) {
  if (!html) return null;
  const m = String(html).match(/<p>\s*Date:\s*([^<]+?)\s*<\/p>/i);
  if (!m) return null;
  const text = m[1].trim();
  const iso = text.match(/(\d{4}-\d{2}-\d{2})/);
  if (iso) {
    const d = new Date(`${iso[1]}T00:00:00`);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  const d = new Date(text);
  return Number.isNaN(d.getTime()) ? null : d;
}

function startOfLocalDay(d) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function endOfLocalDay(d) {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
}

async function fetchAllTasksInFolder(folderId, apiToken) {
  const tasks = [];
  let nextPageToken = undefined;

  while (true) {
    const res = await axios.get(`${WRIKE_API_BASE}/folders/${folderId}/tasks`, {
      headers: { Authorization: `Bearer ${apiToken}` },
      params: {
        descendants: true,
        fields: JSON.stringify(['description']),
        nextPageToken,
      },
      validateStatus: () => true,
    });

    if (res.status < 200 || res.status >= 300) {
      throw new Error(`Wrike API ${res.status}: ${typeof res.data === 'string' ? res.data : JSON.stringify(res.data)}`);
    }

    const data = res.data || {};
    const batch = Array.isArray(data.data) ? data.data : [];
    tasks.push(...batch);
    nextPageToken = data.nextPageToken;
    if (!nextPageToken) break;
  }

  return tasks;
}

async function main() {
  console.log('🔍 Diagnosing label generation issue\n');
  console.log(`API Base: ${WRIKE_API_BASE}`);
  console.log(`Orders Folder: ${ORDERS_FOLDER_ID}`);
  console.log('');

  // Fetch all tasks
  console.log('Fetching all tasks from Wrike...');
  const allTasks = await fetchAllTasksInFolder(ORDERS_FOLDER_ID, API_TOKEN);
  console.log(`Total tasks in folder: ${allTasks.length}\n`);

  // Check July 20-23, 2026
  const datesToCheck = [
    new Date('2026-07-20'),
    new Date('2026-07-21'),
    new Date('2026-07-22'),
    new Date('2026-07-23'),
  ];

  for (const date of datesToCheck) {
    const start = startOfLocalDay(date);
    const end = endOfLocalDay(date);
    const isoDate = date.toISOString().slice(0, 10);

    console.log(`\n📅 ${isoDate}:`);
    
    const inDay = allTasks.filter((t) => {
      const desc = t?.description ?? '';
      const orderDate = parseOrderDateFromOrderDescription(desc);
      if (orderDate) {
        const day = startOfLocalDay(orderDate);
        return day >= start && day <= end;
      }
      const created = t?.createdDate ? new Date(t.createdDate) : null;
      if (!created) return false;
      return created >= start && created <= end;
    });

    console.log(`  Tasks matching date range: ${inDay.length}`);

    if (inDay.length > 0) {
      console.log(`  Task IDs: ${inDay.map(t => t.id).join(', ')}`);
      
      for (const task of inDay) {
        const orderDate = parseOrderDateFromOrderDescription(task?.description ?? '');
        const created = task?.createdDate ? new Date(task.createdDate) : null;
        console.log(`    Task ${task.id}:`);
        console.log(`      Title: ${task.title}`);
        console.log(`      Order Date from desc: ${orderDate ? orderDate.toISOString().slice(0, 10) : 'null'}`);
        console.log(`      Created Date: ${created ? created.toISOString() : 'null'}`);
        console.log(`      Has shipping address: ${task.description?.includes('Shipping Address') ? 'yes' : 'no'}`);
      }
    } else {
      console.log('  ⚠️  No tasks found for this date');
    }
  }

  // Show recent tasks regardless of date
  console.log('\n\n📋 Recent tasks (last 10 by created date):');
  const recentTasks = [...allTasks]
    .filter(t => t.createdDate)
    .sort((a, b) => new Date(b.createdDate) - new Date(a.createdDate))
    .slice(0, 10);

  for (const task of recentTasks) {
    const orderDate = parseOrderDateFromOrderDescription(task?.description ?? '');
    console.log(`  ${task.createdDate?.slice(0, 10)} - ${task.id} - ${task.title}`);
    console.log(`    Order Date: ${orderDate ? orderDate.toISOString().slice(0, 10) : 'null'}`);
  }
}

main().catch((e) => {
  console.error('Fatal:', e);
  process.exit(1);
});
