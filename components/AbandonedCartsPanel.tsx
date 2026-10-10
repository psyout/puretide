'use client';

import { useEffect, useMemo, useState } from 'react';

type CartStatus = 'waiting' | 'sending' | 'sent' | 'recovered' | 'suppressed' | 'failed';
type Cart = {
	id: string;
	email: string;
	firstName?: string;
	items: Array<{ id: string; quantity: number }>;
	status: CartStatus;
	lastActivityAt: string;
	sendAfter: string;
	sentAt?: string;
	recoveredAt?: string;
	clickedAt?: string;
	lastError?: string;
};
type Settings = { enabled: boolean; delayMinutes: number; retentionDays: number; updatedAt: string };
type Readiness = { deploymentEnabled: boolean; businessAddressConfigured: boolean; contactEmailConfigured: boolean; tokenSecretConfigured: boolean; smtpConfigured: boolean };

export default function AbandonedCartsPanel() {
	const [carts, setCarts] = useState<Cart[]>([]);
	const [settings, setSettings] = useState<Settings | null>(null);
	const [readiness, setReadiness] = useState<Readiness | null>(null);
	const [loading, setLoading] = useState(true);
	const [saving, setSaving] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [message, setMessage] = useState<string | null>(null);
	const [testEmail, setTestEmail] = useState('');
	const [actionId, setActionId] = useState<string | null>(null);

	const load = async () => {
		setLoading(true);
		setError(null);
		try {
			const response = await fetch('/api/dashboard/abandoned-carts', { credentials: 'include', cache: 'no-store' });
			const data = (await response.json()) as { ok?: boolean; carts?: Cart[]; settings?: Settings; readiness?: Readiness; error?: string };
			if (!response.ok || !data.ok || !data.settings) throw new Error(data.error ?? 'Failed to load abandoned carts.');
			setCarts(data.carts ?? []);
			setSettings(data.settings);
			setReadiness(data.readiness ?? null);
		} catch (caught) {
			setError(caught instanceof Error ? caught.message : 'Failed to load abandoned carts.');
		} finally {
			setLoading(false);
		}
	};

	useEffect(() => {
		void load();
	}, []);

	const counts = useMemo(() => {
		const result: Record<CartStatus, number> = { waiting: 0, sending: 0, sent: 0, recovered: 0, suppressed: 0, failed: 0 };
		for (const cart of carts) result[cart.status] += 1;
		return result;
	}, [carts]);

	const save = async () => {
		if (!settings) return;
		if (settings.enabled && readiness && Object.values(readiness).some((value) => !value)) {
			setError('Complete every readiness check before enabling live reminders.');
			return;
		}
		if (settings.enabled && !window.confirm('Enable live abandoned-cart reminders? Only explicitly opted-in carts will be eligible, and cron must also be configured.')) return;
		setSaving(true);
		setError(null);
		setMessage(null);
		try {
			const response = await fetch('/api/dashboard/abandoned-carts', {
				method: 'PUT',
				headers: { 'Content-Type': 'application/json' },
				credentials: 'include',
				body: JSON.stringify(settings),
			});
			const data = (await response.json()) as { ok?: boolean; settings?: Settings; error?: string };
			if (!response.ok || !data.ok || !data.settings) throw new Error(data.error ?? 'Failed to save settings.');
			setSettings(data.settings);
			setMessage(data.settings.enabled ? 'Cart reminders enabled.' : 'Cart reminders paused.');
		} catch (caught) {
			setError(caught instanceof Error ? caught.message : 'Failed to save settings.');
		} finally {
			setSaving(false);
		}
	};

	const action = async (actionName: 'retry' | 'suppress' | 'send-test', id?: string) => {
		setActionId(id ?? actionName);
		setError(null);
		setMessage(null);
		try {
			const response = await fetch('/api/dashboard/abandoned-carts', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				credentials: 'include',
				body: JSON.stringify({ action: actionName, id, email: testEmail }),
			});
			const data = (await response.json()) as { ok?: boolean; message?: string; error?: string };
			if (!response.ok || !data.ok) throw new Error(data.error ?? 'Action failed.');
			setMessage(data.message ?? 'Action completed.');
			await load();
		} catch (caught) {
			setError(caught instanceof Error ? caught.message : 'Action failed.');
		} finally {
			setActionId(null);
		}
	};

	if (loading || !settings) return <div className='rounded-2xl border border-black/5 bg-white p-6 shadow-sm text-[#6a6a6a]'>Loading abandoned carts…</div>;

	return (
		<div className='rounded-2xl border border-black/5 bg-white p-6 shadow-sm'>
			<div className='flex flex-wrap items-start justify-between gap-4 mb-5'>
				<div>
					<h2 className='text-xl font-semibold text-[#1f1f1f]'>Abandoned Carts</h2>
					<p className='text-sm text-[#7a7a7a] mt-1'>One consent-based reminder per cart</p>
				</div>
				<button
					onClick={() => void load()}
					className='rounded-lg border border-black/10 px-4 py-2 text-sm font-semibold hover:bg-[#f4f4f7]'>
					Refresh
				</button>
			</div>
			{readiness && !readiness.deploymentEnabled && (
				<div className='rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 mb-4'>
					Deployment capture is off. Set <code>ABANDONED_CART_FEATURE_ENABLED=true</code> in the server environment, then restart the application before testing.
				</div>
			)}
			{readiness && (
				<div className='rounded-xl border border-black/10 p-4 mb-4'>
					<h3 className='font-semibold mb-2'>Readiness</h3>
					<div className='grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2 text-sm'>
						{Object.entries({
							Deployment: readiness.deploymentEnabled,
							'Business address': readiness.businessAddressConfigured,
							'Contact email': readiness.contactEmailConfigured,
							'Signing secret': readiness.tokenSecretConfigured,
							SMTP: readiness.smtpConfigured,
						}).map(([label, ready]) => (
							<div
								key={label}
								className={`rounded-lg px-3 py-2 ${ready ? 'bg-emerald-50 text-emerald-800' : 'bg-amber-50 text-amber-900'}`}>
								{ready ? '✓' : '○'} {label}
							</div>
						))}
					</div>
				</div>
			)}
			{error && <div className='rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800 mb-4'>{error}</div>}
			{message && <div className='rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800 mb-4'>{message}</div>}

			<div className='grid grid-cols-2 md:grid-cols-6 gap-3 mb-6'>
				{(['waiting', 'sending', 'sent', 'recovered', 'suppressed', 'failed'] as CartStatus[]).map((status) => (
					<div
						key={status}
						className='rounded-xl bg-[#f4f4f7] p-3'>
						<p className='text-xs uppercase text-[#7a7a7a]'>{status}</p>
						<p className='text-2xl font-semibold'>{counts[status]}</p>
					</div>
				))}
			</div>

			<div className='rounded-xl border border-black/10 p-4 mb-6'>
				<div className='grid grid-cols-1 md:grid-cols-3 gap-4 items-end'>
					<label className='text-sm text-[#2f2f2f]'>
						<span className='block mb-1 font-medium'>Live sending</span>
						<select
							value={settings.enabled ? 'enabled' : 'paused'}
							onChange={(event) => setSettings({ ...settings, enabled: event.target.value === 'enabled' })}
							className='w-full rounded-lg border border-black/10 px-3 py-2'>
							<option value='paused'>Paused</option>
							<option value='enabled'>Enabled</option>
						</select>
					</label>
					<label className='text-sm text-[#2f2f2f]'>
						<span className='block mb-1 font-medium'>Delay (minutes)</span>
						<input
							type='number'
							min={30}
							max={10080}
							value={settings.delayMinutes}
							onChange={(event) => setSettings({ ...settings, delayMinutes: Number(event.target.value) })}
							className='w-full rounded-lg border border-black/10 px-3 py-2'
						/>
					</label>
					<label className='text-sm text-[#2f2f2f]'>
						<span className='block mb-1 font-medium'>Retention (days)</span>
						<input
							type='number'
							min={1}
							max={365}
							value={settings.retentionDays}
							onChange={(event) => setSettings({ ...settings, retentionDays: Number(event.target.value) })}
							className='w-full rounded-lg border border-black/10 px-3 py-2'
						/>
					</label>
				</div>
				<button
					onClick={save}
					disabled={saving}
					className='mt-4 rounded-lg bg-[#111] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50'>
					{saving ? 'Saving…' : 'Save settings'}
				</button>
			</div>

			<div className='rounded-xl border border-black/10 p-4 mb-6'>
				<h3 className='font-semibold mb-2'>Test delivery</h3>
				<p className='text-sm text-[#7a7a7a] mb-3'>Uses the most recent captured test cart and never changes its send status.</p>
				<div className='flex flex-col sm:flex-row gap-2'>
					<input
						type='email'
						value={testEmail}
						onChange={(event) => setTestEmail(event.target.value)}
						placeholder='Your test email'
						className='flex-1 rounded-lg border border-black/10 px-3 py-2'
					/>
					<button
						onClick={() => void action('send-test')}
						disabled={actionId !== null}
						className='rounded-lg bg-deep-tidal-teal px-4 py-2 text-sm font-semibold text-white hover:bg-deep-tidal-teal-600 disabled:opacity-50'>
						Send test
					</button>
				</div>
			</div>

			{carts.length === 0 ? (
				<p className='py-8 text-[#6a6a6a]'>No opted-in carts have been captured.</p>
			) : (
				<div className='overflow-x-auto'>
					<table className='w-full min-w-[900px]'>
						<thead>
							<tr className='text-left text-xs uppercase tracking-wide text-[#9b9b9b]'>
								<th className='pb-3 pr-5'>Customer</th>
								<th className='pb-3 pr-5'>Items</th>
								<th className='pb-3 pr-5'>Status</th>
								<th className='pb-3 pr-5'>Last activity</th>
								<th className='pb-3 pr-5'>Scheduled / sent</th>
								<th className='pb-3'>Actions</th>
							</tr>
						</thead>
						<tbody className='text-sm'>
							{carts.map((cart) => (
								<tr
									key={cart.id}
									className='border-t border-black/5'>
									<td className='py-4 pr-5'>
										<div className='font-medium'>{cart.firstName || 'Customer'}</div>
										<div className='text-[#6a6a6a]'>{cart.email}</div>
									</td>
									<td className='py-4 pr-5'>{cart.items.reduce((sum, item) => sum + item.quantity, 0)}</td>
									<td className='py-4 pr-5'>
										<span className='rounded-full bg-[#f4f4f7] px-2.5 py-1 text-xs font-semibold'>{cart.status}</span>
										{cart.lastError && <div className='mt-1 max-w-xs text-xs text-rose-700'>{cart.lastError}</div>}
									</td>
									<td className='py-4 pr-5'>{new Date(cart.lastActivityAt).toLocaleString()}</td>
									<td className='py-4 pr-5'>{cart.sentAt ? `Sent ${new Date(cart.sentAt).toLocaleString()}` : new Date(cart.sendAfter).toLocaleString()}</td>
									<td className='py-4'>
										<div className='flex gap-2'>
											{cart.status === 'failed' && (
												<button
													onClick={() => void action('retry', cart.id)}
													disabled={actionId !== null}
													className='rounded-lg bg-[#111] px-3 py-1.5 text-xs font-semibold text-white'>
													Retry
												</button>
											)}
											{['waiting', 'failed'].includes(cart.status) && (
												<button
													onClick={() => void action('suppress', cart.id)}
													disabled={actionId !== null}
													className='rounded-lg border border-black/10 px-3 py-1.5 text-xs font-semibold'>
													Suppress
												</button>
											)}
										</div>
									</td>
								</tr>
							))}
						</tbody>
					</table>
				</div>
			)}
		</div>
	);
}
