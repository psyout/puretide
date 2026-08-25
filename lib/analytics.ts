import type { CartItem, Product } from '@/types/product';

export const GA_MEASUREMENT_ID = 'G-Q15SG115W4';
export const GA_CURRENCY = 'CAD';

export type AnalyticsItem = {
	item_id: string;
	item_name: string;
	item_category?: string;
	item_variant?: string;
	price: number;
	quantity: number;
};

type EcommerceEventParams = Record<string, unknown> & {
	currency?: typeof GA_CURRENCY;
	value?: number;
	items?: AnalyticsItem[];
};

declare global {
	interface Window {
		dataLayer?: unknown[];
		gtag?: (...args: unknown[]) => void;
	}
}

export function trackEvent(eventName: string, params: EcommerceEventParams = {}): void {
	if (typeof window === 'undefined') return;
	window.dataLayer = window.dataLayer || [];
	window.gtag = window.gtag || function gtag(...args: unknown[]) {
		window.dataLayer?.push(args);
	};
	window.gtag('event', eventName, params);
}

export function toAnalyticsItem(product: Product | CartItem, quantity = 'quantity' in product ? product.quantity : 1, price = product.price): AnalyticsItem {
	return {
		item_id: String(product.id),
		item_name: product.name,
		...(product.category ? { item_category: product.category } : {}),
		...(product.mg ? { item_variant: product.mg } : {}),
		price: Number(price.toFixed(2)),
		quantity,
	};
}

export function ecommerceValue(items: AnalyticsItem[]): number {
	return Number(items.reduce((sum, item) => sum + item.price * item.quantity, 0).toFixed(2));
}
