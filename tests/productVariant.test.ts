import test from 'node:test';
import assert from 'node:assert/strict';
import { getProductDisplayName } from '../lib/productVariant';

test('shows the selected strength in grouped stack variant titles', () => {
	assert.equal(getProductDisplayName('Wolverine Stack', '10mg', true), 'Wolverine Stack – 10mg');
	assert.equal(getProductDisplayName('Wolverine Stack', '20mg', true), 'Wolverine Stack – 20mg');
});

test('does not duplicate a strength already present in the product name', () => {
	assert.equal(getProductDisplayName('Retatrutide – 20mg', '20mg', true), 'Retatrutide – 20mg');
});

test('preserves the previous title for a non-variant stack', () => {
	assert.equal(getProductDisplayName('Glow Stack', '70mg', false), 'Glow Stack');
});
