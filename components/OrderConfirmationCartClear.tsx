'use client';

import { useEffect } from 'react';
import { useCart } from '@/context/CartContext';

export function OrderConfirmationCartClear({ orderNumber, paymentStatus, paymentMethod }: { orderNumber: string; paymentStatus?: string; paymentMethod?: string }) {
	const { clearCart } = useCart();

	useEffect(() => {
		// Clear on confirmation for:
		// - e-transfer orders immediately (payment can be pending but order is successfully created)
		// - paid card orders
		// - failed orders (so user can start fresh)
		const method = String(paymentMethod ?? '')
			.trim()
			.toLowerCase();
		const isEtransfer = method === 'etransfer';
		if (orderNumber && (isEtransfer || paymentStatus === 'paid' || paymentStatus === 'failed')) {
			clearCart();
		}
		// clearCart is stable from CartContext; we only want to run when order/status change
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [orderNumber, paymentStatus, paymentMethod]);

	return null;
}
