#!/usr/bin/env node

import { config as dotenvConfig } from 'dotenv';
dotenvConfig();

import axios from 'axios';

const WRIKE_API_BASE = process.env.WRIKE_API_BASE || 'https://www.wrike.com/api/v4';
const API_TOKEN = process.env.WRIKE_API_TOKEN || process.env.WRIKE_TOKEN;

function stripHtml(input) {
  if (!input) return '';
  return String(input)
    .replace(/<br\s*\/?\s*>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<\/h\d>/gi, '\n')
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\r\n/g, '\n');
}

function parseOrderDateFromOrderDescription(html) {
  if (!html) return null;
  // Match both <p>Date:...</p> and <b>Date:</b> formats
  const m = String(html).match(/(?:<p>\s*Date:\s*([^<]+?)\s*<\/p>|<b>\s*Date:\s*<\/b>\s*([^<]+?)(?:<br\s*\/?\s*>|$))/i);
  if (!m) return null;
  // Extract from either capture group
  const text = stripHtml(m[1] || m[2]).trim();
  const iso = text.match(/(\d{4}-\d{2}-\d{2})/);
  if (iso) {
    const d = new Date(`${iso[1]}T00:00:00`);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  const d = new Date(text);
  return Number.isNaN(d.getTime()) ? null : d;
}

const testHtml = `<br />        <br />Order #792f80249d<br />        <br /><b>Date:</b> 2026-07-19, 9:26:47 p.m.<br />`;

console.log('Testing date parsing with actual Wrike description format:');
console.log('HTML:', testHtml);
console.log('');

const parsed = parseOrderDateFromOrderDescription(testHtml);
console.log('Parsed date:', parsed ? parsed.toISOString() : 'null');
console.log('Date only:', parsed ? parsed.toISOString().slice(0, 10) : 'null');

if (parsed && parsed.toISOString().slice(0, 10) === '2026-07-19') {
  console.log('✅ Date parsing works correctly');
  process.exit(0);
} else {
  console.log('❌ Date parsing failed');
  process.exit(1);
}
