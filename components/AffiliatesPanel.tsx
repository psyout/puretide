'use client';

import { useEffect, useState } from 'react';
import { BadgeDollarSign, CalendarDays, ChevronDown, ReceiptText, Users } from 'lucide-react';
import type { AffiliateReport } from '@/lib/affiliateCommissions';

const currentMonth = () => {
	const now = new Date();
	const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Vancouver', year: 'numeric', month: '2-digit' }).formatToParts(now);
	return `${parts.find((part) => part.type === 'year')?.value}-${parts.find((part) => part.type === 'month')?.value}`;
};

const money = new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD' });

export default function AffiliatesPanel() {
	const [month, setMonth] = useState(currentMonth);
	const [report, setReport] = useState<AffiliateReport | null>(null);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		let cancelled = false;
		setLoading(true);
		setError(null);
		(async () => {
			try {
				const response = await fetch(`/api/dashboard/affiliates?month=${encodeURIComponent(month)}`, { credentials: 'include', cache: 'no-store' });
				const data = (await response.json()) as { ok?: boolean; report?: AffiliateReport; error?: string };
				if (cancelled) return;
				if (!response.ok || !data.ok || !data.report) throw new Error(data.error ?? 'Failed to load affiliate payouts.');
				setReport(data.report);
			} catch (loadError) {
				if (!cancelled) setError(loadError instanceof Error ? loadError.message : 'Failed to load affiliate payouts.');
			} finally {
				if (!cancelled) setLoading(false);
			}
		})();
		return () => {
			cancelled = true;
		};
	}, [month]);

	return (
		<div className='rounded-2xl border border-black/5 bg-white p-6 shadow-sm'>
			<div className='mb-6 flex flex-wrap items-start justify-between gap-4'>
				<div>
					<h2 className='text-xl font-semibold text-[#1f1f1f]'>Affiliate Payouts</h2>
					<p className='mt-1 text-sm text-[#6a6a6a]'>Conversions include placed orders. Commission becomes owed once payment is confirmed and is calculated on merchandise after the promo discount.</p>
				</div>
				<label className='flex items-center gap-2 rounded-lg border border-black/10 bg-white px-3 py-2'>
					<CalendarDays className='h-4 w-4 text-[#6a6a6a]' aria-hidden='true' />
					<span className='sr-only'>Payout month</span>
					<input
						type='month'
						value={month}
						onChange={(event) => setMonth(event.target.value)}
						className='bg-transparent text-sm font-medium text-[#2f2f2f] outline-none'
					/>
				</label>
			</div>

			{error && <div className='mb-4 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800'>{error}</div>}
			{loading ? (
				<div className='py-10 text-sm text-[#6a6a6a]'>Calculating affiliate payouts…</div>
			) : report ? (
				<>
					<div className='mb-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4'>
						<div className='rounded-xl bg-[#f4f4f7] p-4'>
							<div className='flex items-center gap-2 text-sm text-[#6a6a6a]'><Users className='h-4 w-4' /> Affiliates</div>
							<p className='mt-2 text-2xl font-semibold text-[#1f1f1f]'>{report.affiliates.length}</p>
						</div>
						<div className='rounded-xl bg-[#f4f4f7] p-4'>
							<div className='flex items-center gap-2 text-sm text-[#6a6a6a]'><ReceiptText className='h-4 w-4' /> Conversions</div>
							<p className='mt-2 text-2xl font-semibold text-[#1f1f1f]'>{report.usageCount}</p>
							<p className='mt-1 text-xs text-[#7a7a7a]'>{report.paidUsageCount} paid</p>
						</div>
						<div className='rounded-xl bg-[#f4f4f7] p-4'>
							<div className='flex items-center gap-2 text-sm text-[#6a6a6a]'><BadgeDollarSign className='h-4 w-4' /> Affiliate revenue</div>
							<p className='mt-2 text-2xl font-semibold text-[#1f1f1f]'>{money.format(report.commissionableRevenue)}</p>
						</div>
						<div className='rounded-xl bg-eucalyptus-50 p-4'>
							<div className='flex items-center gap-2 text-sm text-deep-tidal-teal'><BadgeDollarSign className='h-4 w-4' /> Total owed</div>
							<p className='mt-2 text-2xl font-semibold text-deep-tidal-teal'>{money.format(report.totalCommission)}</p>
							{report.pendingCommission > 0 && <p className='mt-1 text-xs text-[#6a6a6a]'>{money.format(report.pendingCommission)} pending payment</p>}
						</div>
					</div>

					{report.affiliates.length === 0 ? (
						<div className='rounded-xl border border-dashed border-black/10 px-4 py-12 text-center'>
							<p className='font-medium text-[#2f2f2f]'>No affiliate conversions for this month</p>
							<p className='mt-1 text-sm text-[#6a6a6a]'>Assign an affiliate name and commission percentage to a promo code, then paid orders using that code will appear here.</p>
						</div>
					) : (
						<div className='space-y-3'>
							{report.affiliates.map((affiliate) => (
								<details key={affiliate.code} className='group overflow-hidden rounded-xl border border-black/5 bg-[#f8f8fa]'>
									<summary className='grid cursor-pointer list-none gap-3 px-4 py-4 sm:grid-cols-[minmax(180px,1.4fr)_repeat(3,minmax(100px,0.7fr))_24px] sm:items-center [&::-webkit-details-marker]:hidden'>
										<div>
											<p className='font-semibold text-[#1f1f1f]'>{affiliate.affiliateName}</p>
											<p className='text-sm font-mono text-[#6a6a6a]'>{affiliate.code} · {affiliate.commissionPercentage}%</p>
										</div>
										<div><p className='text-xs uppercase tracking-wide text-[#8d8d8d]'>Conversions</p><p className='font-semibold'>{affiliate.usageCount} <span className='text-xs font-normal text-[#7a7a7a]'>({affiliate.paidUsageCount} paid)</span></p></div>
										<div><p className='text-xs uppercase tracking-wide text-[#8d8d8d]'>Revenue</p><p className='font-semibold'>{money.format(affiliate.commissionableRevenue)}</p></div>
										<div><p className='text-xs uppercase tracking-wide text-[#8d8d8d]'>Owed</p><p className='font-semibold text-deep-tidal-teal'>{money.format(affiliate.totalCommission)}</p>{affiliate.pendingCommission > 0 && <p className='text-xs text-[#7a7a7a]'>{money.format(affiliate.pendingCommission)} pending</p>}</div>
										<ChevronDown className='hidden h-5 w-5 text-[#6a6a6a] transition-transform group-open:rotate-180 sm:block' />
									</summary>
									<div className='overflow-x-auto border-t border-black/5 bg-white'>
										<table className='min-w-full text-left text-sm'>
											<thead className='bg-[#f4f4f7] text-xs uppercase tracking-wide text-[#7a7a7a]'><tr><th className='px-4 py-3'>Order</th><th className='px-4 py-3'>Date</th><th className='px-4 py-3'>Customer</th><th className='px-4 py-3'>Status</th><th className='px-4 py-3 text-right'>Order amount</th><th className='px-4 py-3 text-right'>Commission base</th><th className='px-4 py-3 text-right'>Commission</th></tr></thead>
											<tbody className='divide-y divide-black/5'>
												{affiliate.orders.map((order) => (
													<tr key={order.orderNumber}>
														<td className='px-4 py-3 font-mono'>{order.orderNumber}</td>
														<td className='px-4 py-3 whitespace-nowrap'>{new Date(order.createdAt).toLocaleDateString('en-CA', { timeZone: report.timeZone })}</td>
														<td className='px-4 py-3'>{order.customerName}</td>
														<td className='px-4 py-3'><span className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${order.paymentStatus === 'paid' ? 'bg-eucalyptus-100 text-deep-tidal-teal' : 'bg-amber-100 text-amber-800'}`}>{order.paymentStatus === 'paid' ? 'Paid' : 'Awaiting payment'}</span></td>
														<td className='px-4 py-3 text-right'>{money.format(order.orderTotal)}</td>
														<td className='px-4 py-3 text-right'>{money.format(order.commissionableAmount)}</td>
														<td className={`px-4 py-3 text-right font-semibold ${order.paymentStatus === 'paid' ? 'text-deep-tidal-teal' : 'text-[#7a7a7a]'}`}>{money.format(order.commissionAmount)}{order.paymentStatus !== 'paid' && <span className='ml-1 text-xs font-normal'>(pending)</span>}</td>
													</tr>
												))}
											</tbody>
										</table>
									</div>
								</details>
							))}
						</div>
					)}
				</>
			) : null}
		</div>
	);
}
