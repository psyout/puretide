#!/usr/bin/env node

import { config as dotenvConfig } from 'dotenv';
dotenvConfig();

import axios from 'axios';

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
const CRON_SECRET = process.env.CRON_SECRET;

if (!CRON_SECRET) {
  console.error('❌ Missing CRON_SECRET in environment');
  process.exit(1);
}

function parseIsoDateOnly(s) {
  if (!s) return null;
  const m = String(s).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  const d = new Date(`${m[1]}-${m[2]}-${m[3]}T00:00:00`);
  if (Number.isNaN(d.getTime())) return null;
  return d;
}

function formatDate(d) {
  return d.toISOString().slice(0, 10);
}

function addDays(date, days) {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

async function generateLabelsForDate(date) {
  const isoDate = formatDate(date);
  const url = `${BASE_URL}/api/cron/daily-labels?date=${isoDate}`;

  console.log(`Generating labels for ${isoDate}...`);

  try {
    const response = await axios.post(
      url,
      {},
      {
        headers: {
          'x-cron-secret': CRON_SECRET,
          'Content-Type': 'application/json',
        },
        timeout: 120000, // 2 minutes timeout
      },
    );

    if (response.data.ok) {
      console.log(`✅ ${isoDate}: ${response.data.labelsParsed} labels generated (orders: ${response.data.ordersConsidered})`);
      return { success: true, date: isoDate, data: response.data };
    } else {
      console.log(`⚠️  ${isoDate}: ${response.data.reason || 'No labels generated'} (orders: ${response.data.ordersConsidered})`);
      return { success: false, date: isoDate, reason: response.data.reason };
    }
  } catch (error) {
    console.error(`❌ ${isoDate}: Failed - ${error.message}`);
    return { success: false, date: isoDate, error: error.message };
  }
}

async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0 || args.includes('--help') || args.includes('-h')) {
    console.log('Usage: node scripts/backfill-labels.mjs [--start=YYYY-MM-DD] [--end=YYYY-MM-DD] [--date=YYYY-MM-DD]');
    console.log('');
    console.log('Options:');
    console.log('  --start=YYYY-MM-DD  Start date (inclusive)');
    console.log('  --end=YYYY-MM-DD    End date (inclusive)');
    console.log('  --date=YYYY-MM-DD   Single date to process');
    console.log('');
    console.log('Examples:');
    console.log('  node scripts/backfill-labels.mjs --date=2026-07-20');
    console.log('  node scripts/backfill-labels.mjs --start=2026-07-20 --end=2026-07-23');
    process.exit(0);
  }

  let startDate = null;
  let endDate = null;
  let singleDate = null;

  for (const arg of args) {
    if (arg.startsWith('--start=')) {
      startDate = parseIsoDateOnly(arg.slice('--start='.length));
    } else if (arg.startsWith('--end=')) {
      endDate = parseIsoDateOnly(arg.slice('--end='.length));
    } else if (arg.startsWith('--date=')) {
      singleDate = parseIsoDateOnly(arg.slice('--date='.length));
    }
  }

  if (singleDate) {
    if (!singleDate) {
      console.error('❌ Invalid date format for --date. Use YYYY-MM-DD.');
      process.exit(1);
    }
    await generateLabelsForDate(singleDate);
    return;
  }

  if (!startDate || !endDate) {
    console.error('❌ Both --start and --end are required for range backfill');
    process.exit(1);
  }

  if (startDate > endDate) {
    console.error('❌ Start date must be before or equal to end date');
    process.exit(1);
  }

  console.log('🔄 Backfilling labels from', formatDate(startDate), 'to', formatDate(endDate));
  console.log(`Target: ${BASE_URL}`);
  console.log('');

  const results = [];
  let currentDate = startDate;

  while (currentDate <= endDate) {
    const result = await generateLabelsForDate(currentDate);
    results.push(result);
    currentDate = addDays(currentDate, 1);
  }

  console.log('');
  console.log('📊 Summary:');
  const successful = results.filter((r) => r.success).length;
  const failed = results.filter((r) => !r.success).length;
  console.log(`  Total dates processed: ${results.length}`);
  console.log(`  Successful: ${successful}`);
  console.log(`  Failed/Skipped: ${failed}`);

  if (failed > 0) {
    console.log('');
    console.log('Failed dates:');
    for (const result of results.filter((r) => !r.success)) {
      console.log(`  - ${result.date}: ${result.reason || result.error}`);
    }
  }
}

main().catch((error) => {
  console.error('Fatal:', error);
  process.exit(1);
});
