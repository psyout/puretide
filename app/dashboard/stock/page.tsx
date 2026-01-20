'use client';

import { useEffect, useState } from 'react';
import { products as fallbackProducts } from '@/lib/products';
import Header from '@/components/Header';
import type { Product } from '@/types/product';

const clampStock = (value: number) => Math.max(0, Math.min(9999, value));
const clampPrice = (value: number) => Math.max(0, Number(value.toFixed(2)));

const toSlug = (value: string) =>
	value
		.trim()
		.toLowerCase()
		.replace(/[^a-z0-9\s-]/g, '')
		.replace(/\s+/g, '-')
		.replace(/-+/g, '-');

export default function StockDashboardPage() {
	const [rows, setRows] = useState<Product[]>(fallbackProducts);
	const [isDirty, setIsDirty] = useState(false);
	const [isLoading, setIsLoading] = useState(true);
	const [isAlerting, setIsAlerting] = useState(false);
	const [alertStatus, setAlertStatus] = useState<string | null>(null);

	useEffect(() => {
		const load = async () => {
			try {
				const response = await fetch('/api/stock');
				const data = (await response.json()) as { ok: boolean; items?: Product[] };
				if (data.ok && data.items) {
					setRows(data.items);
				}
			} finally {
				setIsLoading(false);
			}
		};
		void load();
	}, []);

	const updateRow = (id: string, next: Partial<Product>) => {
		setRows((prev) =>
			prev.map((product) => (product.id === id ? { ...product, ...next } : product))
		);
		setIsDirty(true);
	};

	const handleStockChange = (id: string, value: string) => {
		const numeric = Number(value);
		const safeValue = Number.isFinite(numeric) ? clampStock(numeric) : 0;
		updateRow(id, { stock: safeValue });
	};

	const handlePriceChange = (id: string, value: string) => {
		const numeric = Number(value);
		const safeValue = Number.isFinite(numeric) ? clampPrice(numeric) : 0;
		updateRow(id, { price: safeValue });
	};

	const handleTitleChange = (id: string, value: string) => {
		const trimmed = value.trim();
		updateRow(id, { name: trimmed, slug: toSlug(trimmed) });
	};

	const handleSave = async () => {
		await fetch('/api/stock', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ items: rows }),
		});
		setIsDirty(false);
	};

	const handleReset = () => {
		setRows(fallbackProducts);
		setIsDirty(true);
	};

	const handleLowStockTest = async () => {
		setIsAlerting(true);
		setAlertStatus(null);
		try {
			const response = await fetch('/api/stock/alert', { method: 'POST' });
			const data = (await response.json()) as { ok: boolean; count?: number; error?: string };
			if (!data.ok) {
				throw new Error(data.error ?? 'Failed to send alert');
			}
			const count = data.count ?? 0;
			setAlertStatus(
				count > 0
					? `Low-stock email sent for ${count} item${count === 1 ? '' : 's'}.`
					: 'No low-stock items to alert.'
			);
		} catch (error) {
			const message = error instanceof Error ? error.message : 'Failed to send alert';
			setAlertStatus(message);
		} finally {
			setIsAlerting(false);
		}
	};

	return (
		<div className='min-h-screen bg-gradient-to-br from-mineral-white via-deep-tidal-teal-50 to-eucalyptus-50'>
			<Header />
			<div className='container mx-auto px-6 py-12 pt-28'>
				<div className='flex flex-col gap-6'>
					<div className='flex flex-col gap-3'>
						<h1 className='text-3xl font-bold text-deep-tidal-teal-800'>Stock Dashboard</h1>
						<p className='text-deep-tidal-teal-700'>
							Update product details and stock. Values are saved locally in this browser.
						</p>
					</div>

					<div className='sticky top-20 z-10 bg-mineral-white/80 backdrop-blur-sm rounded-lg ui-border px-4 py-3 flex flex-wrap items-center gap-3 shadow-md'>
						<button
							onClick={handleSave}
							disabled={!isDirty}
							className='bg-deep-tidal-teal hover:bg-deep-tidal-teal-600 disabled:bg-muted-sage-400 text-mineral-white font-semibold px-5 py-2.5 rounded transition-colors'>
							Save changes
						</button>
						<button
							onClick={handleReset}
							className='bg-mineral-white ui-border text-deep-tidal-teal-800 font-semibold px-5 py-2.5 rounded transition-colors hover:bg-eucalyptus-100/40'>
							Reset to defaults
						</button>
						<button
							onClick={handleLowStockTest}
							disabled={isAlerting}
							className='bg-mineral-white ui-border text-deep-tidal-teal-800 font-semibold px-5 py-2.5 rounded transition-colors hover:bg-eucalyptus-100/40 disabled:opacity-60'>
							{isAlerting ? 'Sending alert...' : 'Send low-stock test'}
						</button>
						{isDirty && <span className='text-sm text-deep-tidal-teal-700'>Unsaved changes</span>}
						{alertStatus && <span className='text-sm text-deep-tidal-teal-700'>{alertStatus}</span>}
					</div>

					<div className='grid grid-cols-1 gap-4'>
						{isLoading && (
							<div className='bg-eucalyptus-100/60 backdrop-blur-sm rounded-lg ui-border shadow-lg p-6 text-deep-tidal-teal-700'>
								Loading stock from Google Sheets...
							</div>
						)}
						{rows.map((product) => (
							<div
								key={product.id}
								className='bg-eucalyptus-100/60 backdrop-blur-sm rounded-lg ui-border shadow-lg p-5'>
								<div className='grid grid-cols-1 lg:grid-cols-[2fr_1fr_1fr] gap-4 items-start'>
									<div>
										<label className='block text-xs uppercase tracking-wide text-deep-tidal-teal-600 mb-2'>Title</label>
										<input
											type='text'
											value={product.name}
											onChange={(event) => handleTitleChange(product.id, event.target.value)}
											className='w-full bg-mineral-white ui-border rounded px-3 py-2 text-deep-tidal-teal-800 focus:outline-none focus:border-deep-tidal-teal focus:ring-2 focus:ring-deep-tidal-teal'
										/>
										<div className='text-xs text-deep-tidal-teal-600 mt-2'>Slug: {product.slug}</div>
										<div className='text-xs text-deep-tidal-teal-600 mt-1'>Category: {product.category}</div>
									</div>
									<div>
										<label className='block text-xs uppercase tracking-wide text-deep-tidal-teal-600 mb-2'>Price</label>
										<input
											type='number'
											min={0}
											step='0.01'
											value={product.price}
											onChange={(event) => handlePriceChange(product.id, event.target.value)}
											className='w-full bg-mineral-white ui-border rounded px-3 py-2 text-deep-tidal-teal-800 focus:outline-none focus:border-deep-tidal-teal focus:ring-2 focus:ring-deep-tidal-teal'
										/>
									</div>
									<div>
										<label className='block text-xs uppercase tracking-wide text-deep-tidal-teal-600 mb-2'>Stock</label>
										<input
											type='number'
											min={0}
											max={9999}
											value={product.stock}
											onChange={(event) => handleStockChange(product.id, event.target.value)}
											className='w-full bg-mineral-white ui-border rounded px-3 py-2 text-deep-tidal-teal-800 focus:outline-none focus:border-deep-tidal-teal focus:ring-2 focus:ring-deep-tidal-teal'
										/>
									</div>
								</div>

								<details className='mt-4'>
									<summary className='cursor-pointer text-sm font-semibold text-deep-tidal-teal-800'>Edit description & details</summary>
									<div className='mt-4 grid grid-cols-1 gap-4'>
										<div>
											<label className='block text-xs uppercase tracking-wide text-deep-tidal-teal-600 mb-2'>Description</label>
										<textarea
												rows={2}
												value={product.description}
											onChange={(event) => updateRow(product.id, { description: event.target.value })}
												className='w-full bg-mineral-white ui-border rounded px-3 py-2 text-deep-tidal-teal-800 focus:outline-none focus:border-deep-tidal-teal focus:ring-2 focus:ring-deep-tidal-teal'
											/>
										</div>
										<div>
											<label className='block text-xs uppercase tracking-wide text-deep-tidal-teal-600 mb-2'>Details</label>
										<textarea
												rows={3}
												value={product.details ?? ''}
											onChange={(event) => updateRow(product.id, { details: event.target.value })}
												className='w-full bg-mineral-white ui-border rounded px-3 py-2 text-deep-tidal-teal-800 focus:outline-none focus:border-deep-tidal-teal focus:ring-2 focus:ring-deep-tidal-teal'
											/>
										</div>
									</div>
								</details>
							</div>
						))}
					</div>
				</div>
			</div>
		</div>
	);
}
