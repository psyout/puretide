import type { ProductVariant } from '@/types/product';

export function isProductVariantSellable(variant: Pick<ProductVariant, 'status' | 'stock'>): boolean {
	return (variant.status ?? 'published') === 'published' && Number(variant.stock) > 0;
}

export function getProductDisplayName(name: string, strength?: string, isVariant = false): string {
	const normalizedName = name.trim().toLocaleLowerCase();
	const normalizedStrength = strength?.trim().toLocaleLowerCase();
	if (!normalizedStrength || normalizedName.includes(normalizedStrength)) return name;
	if (normalizedName.includes('stack') && !isVariant) return name;
	return `${name} – ${strength!.trim()}`;
}
