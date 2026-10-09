'use client';

import { CartProvider } from '@/context/CartContext';
import CartDrawer from '@/components/CartDrawer';
import type { PromoCode } from '@/types/product';

export function Providers({ children, automaticPromotion }: { children: React.ReactNode; automaticPromotion?: PromoCode | null }) {
	return (
		<CartProvider automaticPromotion={automaticPromotion}>
			{children}
			<CartDrawer />
		</CartProvider>
	);
}
