import test from 'node:test';
import assert from 'node:assert/strict';
import { reconcileInventoryBatchQuantities } from '../lib/stockSheet';

test('deducts Zoho reductions from Current Stock before New Stock', () => {
	assert.deepEqual(reconcileInventoryBatchQuantities(34, 9, 42), { current: 33, incoming: 9 });
	assert.deepEqual(reconcileInventoryBatchQuantities(4, 9, 3), { current: 0, incoming: 3 });
});

test('places Zoho increases into New Stock', () => {
	assert.deepEqual(reconcileInventoryBatchQuantities(10, 5, 22), { current: 10, incoming: 12 });
});

test('normalizes invalid or negative batch quantities without going negative', () => {
	assert.deepEqual(reconcileInventoryBatchQuantities(-4, 'bad', 6), { current: 0, incoming: 6 });
});
