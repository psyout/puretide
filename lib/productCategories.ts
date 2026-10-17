export const PRODUCT_FILTER_CATEGORIES = ['All', 'Metabolic', 'Stack', 'Recovery', 'Longevity', 'Cognitive', 'Supplies', 'Features'] as const;

export type ProductFilterCategory = (typeof PRODUCT_FILTER_CATEGORIES)[number];

export const PRODUCT_MENU_CATEGORIES = PRODUCT_FILTER_CATEGORIES.filter(
	(category): category is Exclude<ProductFilterCategory, 'All'> => category !== 'All',
);

export function isProductFilterCategory(value: string | null): value is ProductFilterCategory {
	return value !== null && PRODUCT_FILTER_CATEGORIES.some((category) => category === value);
}

export const PRODUCT_CATEGORY_EVENT = 'pure-tide:select-product-category';
