'use client';

import { useEffect } from 'react';
import { useCart } from '@/context/CartContext';

/**
 * Clears the cart when the user lands on order confirmation with a paid order.
 * Prevents stale cart when returning to the site or opening confirmation in a new tab.
 */
export function OrderConfirmationCartClear({
	orderNumber,
	paymentStatus,
}: {
	orderNumber: string;
	paymentStatus?: string;
}) {
	const { clearCart } = useCart();

	useEffect(() => {
		if (orderNumber && paymentStatus === 'paid') {
			clearCart();
		}
		// clearCart is stable from CartContext; we only want to run when order/status change
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [orderNumber, paymentStatus]);

	return null;
}
