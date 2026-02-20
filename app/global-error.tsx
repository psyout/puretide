'use client';

import { useEffect } from 'react';

export default function GlobalError({
	error,
	reset,
}: {
	error: Error & { digest?: string };
	reset: () => void;
}) {
	useEffect(() => {
		console.error('Global error:', error);
	}, [error]);

	return (
		<html lang='en'>
			<body style={{ margin: 0, fontFamily: 'system-ui, sans-serif', background: 'linear-gradient(to bottom right, #fafafa, #e8f4f0)', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
				<div style={{ maxWidth: '28rem', margin: '0 1.5rem', padding: '2rem', background: 'rgba(232, 244, 240, 0.8)', borderRadius: '0.5rem', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)', textAlign: 'center' }}>
					<h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: '#1a5f6f', marginBottom: '0.75rem' }}>Something went wrong</h1>
					<p style={{ color: '#1a5f6f', marginBottom: '2rem' }}>
						We couldn&apos;t load the app. Please try again or refresh the page.
					</p>
					<button
						type='button'
						onClick={reset}
						style={{
							background: '#1a5f6f',
							color: '#fff',
							fontWeight: 600,
							padding: '0.75rem 1.5rem',
							border: 'none',
							borderRadius: '0.375rem',
							cursor: 'pointer',
						}}>
						Try again
					</button>
				</div>
			</body>
		</html>
	);
}
