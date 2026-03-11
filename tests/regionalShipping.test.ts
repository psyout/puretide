import test from 'node:test';
import assert from 'node:assert/strict';
import { SHIPPING_COSTS, getEffectiveShippingCost, FREE_SHIPPING_THRESHOLD } from '../lib/constants';

test('regional shipping costs by postal code', () => {
	const westernPostalCodes = ['V5K 0A1', 'R3C 0A1', 'S7K 0A1', 'T2X 1V4'];
	const easternPostalCodes = ['K1A 0B1', 'H3Z 2Y7', 'E1C 4R8', 'A1B 3C7'];

	for (const zip of westernPostalCodes) {
		const cost = getEffectiveShippingCost(zip);
		assert.strictEqual(cost, SHIPPING_COSTS.western, `Western postal ${zip} should be $20`);
	}
	for (const zip of easternPostalCodes) {
		const cost = getEffectiveShippingCost(zip);
		assert.strictEqual(cost, SHIPPING_COSTS.eastern, `Eastern postal ${zip} should be $30`);
	}
});

test('free shipping overrides regional cost', () => {
	const subtotal = 500;
	const discount = 0;
	const subtotalAfterDiscounts = subtotal - discount;
	const qualifiesFreeShipping = subtotalAfterDiscounts > FREE_SHIPPING_THRESHOLD;
	const baseCost = getEffectiveShippingCost('V5K 0A1'); // western
	const shippingCost = qualifiesFreeShipping ? 0 : baseCost;

	assert.strictEqual(shippingCost, 0, 'Should be free shipping when subtotal after discounts > 400');
});

test('postal code validation edge cases', () => {
	assert.strictEqual(getEffectiveShippingCost(''), SHIPPING_COSTS.eastern, 'Empty postal code defaults to eastern');
	assert.strictEqual(getEffectiveShippingCost('v5k 0a1'), SHIPPING_COSTS.western, 'Lowercase postal code works');
	assert.strictEqual(getEffectiveShippingCost('X1A 1A1'), SHIPPING_COSTS.eastern, 'Non-western first letter defaults to eastern');
});
