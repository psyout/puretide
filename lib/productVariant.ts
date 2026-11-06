import type { ProductVariant } from '@/types/product';

export function isProductVariantSellable(variant: Pick<ProductVariant, 'status' | 'stock'>): boolean {
	return (variant.status ?? 'published') === 'published' && Number(variant.stock) > 0;
}
