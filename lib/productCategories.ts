export const PRODUCT_FILTER_CATEGORIES = ['All', 'Metabolic', 'Stack', 'Recovery', 'Longevity', 'Cognitive', 'Supplies', 'Features'] as const;

export type ProductFilterCategory = (typeof PRODUCT_FILTER_CATEGORIES)[number];

export const PRODUCT_MENU_CATEGORIES = PRODUCT_FILTER_CATEGORIES.filter(
	(category): category is Exclude<ProductFilterCategory, 'All'> => category !== 'All',
);

export function isProductFilterCategory(value: string | null): value is ProductFilterCategory {
	return value !== null && PRODUCT_FILTER_CATEGORIES.some((category) => category === value);
}

export function getProductFilterCategory(category: string): ProductFilterCategory {
	const normalized = category.trim().toLowerCase();
	if (normalized === 'metabolic') return 'Metabolic';
	if (['stack', 'stacks', 'blend', 'blends'].includes(normalized)) return 'Stack';
	if (normalized === 'recovery') return 'Recovery';
	if (['longevity', 'immune', 'antioxidant', 'intimacy', 'sexual health'].includes(normalized)) return 'Longevity';
	if (normalized === 'cognitive') return 'Cognitive';
	if (['supplies', 'supply', 'accessory', 'accessories', 'hydration'].includes(normalized)) return 'Supplies';
	return 'Features';
}

export const PRODUCT_CATEGORY_EVENT = 'pure-tide:select-product-category';
