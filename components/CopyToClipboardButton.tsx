'use client';

import { useState } from 'react';

export function CopyToClipboardButton({ value, label }: { value: string; label: string }) {
	const [status, setStatus] = useState<'idle' | 'copied' | 'failed'>('idle');

	const onCopy = async () => {
		try {
			await navigator.clipboard.writeText(value);
			setStatus('copied');
			setTimeout(() => setStatus('idle'), 1500);
		} catch {
			setStatus('failed');
			setTimeout(() => setStatus('idle'), 1500);
		}
	};

	return (
		<button
			type='button'
			onClick={onCopy}
			className='shrink-0 rounded-md border border-deep-tidal-teal/20 bg-mineral-white px-3 py-1.5 text-sm font-semibold text-deep-tidal-teal-800 hover:bg-deep-tidal-teal/5'
			aria-label={label}
			title={label}>
			{status === 'copied' ? 'Copied' : status === 'failed' ? 'Copy failed' : 'Copy'}
		</button>
	);
}
