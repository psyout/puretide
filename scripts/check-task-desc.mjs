#!/usr/bin/env node

import { config as dotenvConfig } from 'dotenv';
dotenvConfig();

import axios from 'axios';

const WRIKE_API_BASE = process.env.WRIKE_API_BASE || 'https://www.wrike.com/api/v4';
const API_TOKEN = process.env.WRIKE_API_TOKEN || process.env.WRIKE_TOKEN;

const taskId = process.argv[2];

if (!taskId) {
  console.error('Usage: node scripts/check-task-desc.mjs <taskId>');
  process.exit(1);
}

async function main() {
  const res = await axios.get(`${WRIKE_API_BASE}/tasks/${taskId}`, {
    headers: { Authorization: `Bearer ${API_TOKEN}` },
    validateStatus: () => true,
  });

  if (res.status < 200 || res.status >= 300) {
    console.error(`Wrike API ${res.status}: ${res.data}`);
    process.exit(1);
  }

  const task = res.data?.data?.[0];
  if (!task) {
    console.error('Task not found');
    process.exit(1);
  }

  console.log('Task:', task.title);
  console.log('ID:', task.id);
  console.log('Created:', task.createdDate);
  console.log('\nDescription (raw):');
  console.log(task.description || '(empty)');
  console.log('\nDescription (HTML):');
  console.log(task.description || '(empty)');
}

main().catch((e) => {
  console.error('Fatal:', e);
  process.exit(1);
});
