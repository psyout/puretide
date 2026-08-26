import assert from 'node:assert/strict';
import test from 'node:test';
import { parseProductDescription } from '../lib/productDescription';

test('extracts supported product links into Sub-Q CTAs', () => {
	const result = parseProductDescription('A capsule product. https://puretide.ca/product/kpv');

	assert.equal(result.copy, 'A capsule product.');
	assert.deepEqual(result.ctas, [
		{
			label: 'Sub-Q Format',
			href: 'https://puretide.ca/product/kpv',
		},
	]);
});

test('supports the BPC-157 URL, an optional slash, and markdown links', () => {
	const result = parseProductDescription('A capsule product. [View the vial](https://puretide.ca/product/bpc-157/)');

	assert.equal(result.copy, 'A capsule product.');
	assert.deepEqual(result.ctas.map((cta) => cta.href), ['https://puretide.ca/product/bpc-157']);
});

test('leaves descriptions without a supported URL unchanged', () => {
	const description = 'A naturally occurring tripeptide studied for its anti-inflammatory properties.';

	assert.deepEqual(parseProductDescription(description), { copy: description, ctas: [] });
});

test('adds the KPV CTA directly to the KPV oral tablets product', () => {
	const result = parseProductDescription('KPV oral tablet description.', 'kpv-oral-tablets');

	assert.deepEqual(result.ctas, [
		{
			label: 'Sub-Q Format',
			href: 'https://puretide.ca/product/kpv',
		},
	]);
});

test('adds the BPC-157 CTA directly to the BPC-157 oral tablets product', () => {
	const result = parseProductDescription('BPC-157 oral tablet description.', 'bpc-157-oral-tablets');

	assert.deepEqual(result.ctas, [
		{
			label: 'Sub-Q Format',
			href: 'https://puretide.ca/product/bpc-157',
		},
	]);
});
