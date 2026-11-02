'use client';

import { useEffect, useState } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';

export default function OrderAttributionConsent({ publicParameter }: { publicParameter: string }) {
	const pathname = usePathname();
	const searchParams = useSearchParams();
	const [visible, setVisible] = useState(false);
	const [saving, setSaving] = useState(false);

	useEffect(() => {
		if (!searchParams.has(publicParameter)) return;
		setVisible(window.localStorage.getItem('puretide-analytics-consent') == null);
	}, [publicParameter, searchParams]);

	async function choose(allowed: boolean) {
		setSaving(true);
		try {
			const query = searchParams.toString();
			const response = await fetch('/api/attribution/consent', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ allowed, landingPath: `${pathname}${query ? `?${query}` : ''}` }),
			});
			if (!response.ok) throw new Error('Consent request failed');
			window.localStorage.setItem('puretide-analytics-consent', allowed ? 'allowed' : 'declined');
			setVisible(false);
		} catch {
			setSaving(false);
		}
	}

	if (!visible) return null;
	return (
		<div className='fixed inset-x-4 bottom-4 z-[100] mx-auto max-w-xl rounded-2xl border border-deep-tidal-teal-200 bg-white p-5 shadow-2xl'>
			<p className='text-sm leading-6 text-deep-tidal-teal-900'>
				Allow anonymous campaign attribution for this test visit? We send only anonymous visit and order references with placed/paid status—no customer, product, or payment details.
			</p>
			<div className='mt-4 flex justify-end gap-3'>
				<button type='button' disabled={saving} onClick={() => choose(false)} className='rounded-full border border-deep-tidal-teal-300 px-4 py-2 text-sm font-semibold text-deep-tidal-teal-800 disabled:opacity-50'>
					Decline
				</button>
				<button type='button' disabled={saving} onClick={() => choose(true)} className='rounded-full bg-deep-tidal-teal-800 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50'>
					Allow
				</button>
			</div>
		</div>
	);
}
