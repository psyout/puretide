'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useCart } from '@/context/CartContext';
import type { CartItem } from '@/types/product';

export default function RecoverCartPage() {
	const router = useRouter();
	const searchParams = useSearchParams();
	const { restoreCart } = useCart();
	const [error, setError] = useState<string | null>(null);
	const startedRef = useRef(false);

	useEffect(() => {
		if (startedRef.current) return;
		startedRef.current = true;
		const token = searchParams.get('token');
		if (!token) {
			setError('This recovery link is incomplete.');
			return;
		}
		let cancelled = false;
		void (async () => {
			try {
				const response = await fetch(`/api/abandoned-carts/recover?token=${encodeURIComponent(token)}`, { cache: 'no-store' });
				const data = (await response.json()) as { ok?: boolean; items?: CartItem[]; error?: string };
				if (!response.ok || !data.ok || !data.items?.length) throw new Error(data.error ?? 'Unable to recover this cart.');
				if (cancelled) return;
				restoreCart(data.items);
				router.replace('/cart');
			} catch (caught) {
				if (!cancelled) setError(caught instanceof Error ? caught.message : 'Unable to recover this cart.');
			}
		})();
		return () => {
			cancelled = true;
		};
	}, [restoreCart, router, searchParams]);

	return (
		<main className='min-h-screen bg-gradient-to-br from-mineral-white via-deep-tidal-teal-50 to-eucalyptus-50 flex items-center justify-center px-6'>
			<div className='max-w-lg w-full rounded-2xl bg-white border border-black/10 shadow-lg p-8 text-center'>
				<h1 className='text-2xl font-bold text-deep-tidal-teal-800 mb-3'>{error ? 'We could not restore your cart' : 'Restoring your cart…'}</h1>
				<p className='text-deep-tidal-teal-600'>{error ?? 'Checking current prices and availability.'}</p>
				{error && (
					<button onClick={() => router.replace('/')} className='mt-6 rounded-lg bg-deep-tidal-teal px-5 py-3 font-semibold text-white'>
						Continue shopping
					</button>
				)}
			</div>
		</main>
	);
}
