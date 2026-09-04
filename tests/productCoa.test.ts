import assert from 'node:assert/strict';
import test from 'node:test';
import { resolveProductCoaFile } from '../lib/productCoa';

const availableFiles = ['puretide-coa-bpc-157.pdf', 'puretide-coa-bpc-157-oral-tablets.pdf', 'puretide-coa-kpv.pdf'];

test('selects only the exact COA filename configured by the spreadsheet', () => {
	assert.equal(resolveProductCoaFile('puretide-coa-bpc-157.pdf', availableFiles), 'puretide-coa-bpc-157.pdf');
	assert.equal(resolveProductCoaFile('puretide-coa-bpc.pdf', availableFiles), null);
});

test('does not infer a regular product COA for an oral product', () => {
	assert.equal(resolveProductCoaFile(undefined, availableFiles), null);
	assert.equal(resolveProductCoaFile('puretide-coa-bpc-157-oral-tablets.pdf', availableFiles), 'puretide-coa-bpc-157-oral-tablets.pdf');
});

test('trims spreadsheet whitespace and rejects paths or non-PDF files', () => {
	assert.equal(resolveProductCoaFile('  puretide-coa-kpv.pdf  ', availableFiles), 'puretide-coa-kpv.pdf');
	assert.equal(resolveProductCoaFile('../puretide-coa-kpv.pdf', availableFiles), null);
	assert.equal(resolveProductCoaFile('folder\\puretide-coa-kpv.pdf', availableFiles), null);
	assert.equal(resolveProductCoaFile('puretide-coa-kpv.txt', availableFiles), null);
});
