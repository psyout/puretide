'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function DashboardLoginPage() {
	const [secret, setSecret] = useState('');
	const [error, setError] = useState<string | null>(null);
	const [loading, setLoading] = useState(false);
	const router = useRouter();

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		setError(null);
		setLoading(true);
		try {
			const res = await fetch('/api/dashboard/session', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ secret: secret.trim() }),
				credentials: 'include',
			});
			const data = (await res.json()) as { ok?: boolean; error?: string };
			if (res.ok && data.ok) {
				router.push('/dashboard/stock');
				router.refresh();
			} else {
				setError(data.error ?? 'Invalid secret.');
			}
		} catch (e) {
			setError(e instanceof Error ? e.message : 'Something went wrong.');
		} finally {
			setLoading(false);
		}
	};

	return (
		<div className='min-h-screen bg-[#efefef] flex items-center justify-center p-6'>
			<div className='w-full max-w-sm rounded-2xl border border-black/5 bg-white p-8 shadow-sm'>
				<div className='flex items-center gap-3 mb-6'>
					<div className='h-10 w-10 rounded-xl bg-[#111111] text-white flex items-center justify-center font-bold'>P</div>
					<div>
						<p className='text-lg font-semibold text-[#1f1f1f]'>Dashboard</p>
						<p className='text-xs text-[#8d8d8d]'>Sign in</p>
					</div>
				</div>
				<form onSubmit={handleSubmit} className='space-y-4'>
					<div>
						<label htmlFor='secret' className='block text-sm font-medium text-[#4a4a4a] mb-2'>
							Secret
						</label>
						<input
							id='secret'
							type='password'
							value={secret}
							onChange={(e) => setSecret(e.target.value)}
							placeholder='Enter dashboard secret'
							className='w-full px-4 py-3 border border-black/10 rounded-lg text-[#2f2f2f] focus:outline-none focus:border-[#6c5dd3] focus:ring-2 focus:ring-[#6c5dd3]/20'
							autoComplete='current-password'
							required
						/>
					</div>
					{error && (
						<div className='rounded-lg bg-rose-50 border border-rose-200 px-4 py-3 text-sm text-rose-800'>{error}</div>
					)}
					<button
						type='submit'
						disabled={loading}
						className='w-full bg-[#6c5dd3] text-white font-semibold py-3 rounded-lg hover:bg-[#5b4ec7] disabled:opacity-50'>
						{loading ? 'Signing in...' : 'Sign in'}
					</button>
				</form>
			</div>
		</div>
	);
}
