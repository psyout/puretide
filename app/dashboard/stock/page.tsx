'use client';

import { useEffect, useMemo, useState } from 'react';
import { Trash2 } from 'lucide-react';
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

const buildNewProduct = (fallbackImage: string): Product => {
	const id = typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `p_${Date.now()}`;
	return {
		id,
		slug: `product-${id.slice(-6)}`,
		name: 'New Product',
		description: '',
		details: '',
		price: 0,
		stock: 0,
		image: fallbackImage,
		category: 'General',
		icons: [],
		status: 'draft',
	};
};

export default function StockDashboardPage() {
	const [rows, setRows] = useState<Product[]>(fallbackProducts);
	const [isDirty, setIsDirty] = useState(false);
	const [isLoading, setIsLoading] = useState(true);
	const [activeTab, setActiveTab] = useState<'products' | 'inventory' | 'alerts'>('products');
	const [searchValue, setSearchValue] = useState('');
	const [expandedId, setExpandedId] = useState<string | null>(null);

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

	const handleImageChange = (id: string, value: string) => {
		updateRow(id, { image: value.trim() });
	};

	const handleCategoryChange = (id: string, value: string) => {
		updateRow(id, { category: value.trim() });
	};

	const handleIconsChange = (id: string, value: string) => {
		const icons = value
			.split(',')
			.map((icon) => icon.trim())
			.filter(Boolean);
		updateRow(id, { icons });
	};

	const handleStatusChange = (id: string, value: Product['status']) => {
		updateRow(id, { status: value ?? 'published' });
	};

	const getStatusBadge = (status?: Product['status']) => {
		switch (status) {
			case 'published':
				return 'bg-emerald-100 text-emerald-700';
			case 'draft':
				return 'bg-gray-100 text-gray-600';
			case 'inactive':
				return 'bg-rose-100 text-rose-700';
			case 'stock-out':
				return 'bg-amber-100 text-amber-700';
			default:
				return 'bg-emerald-100 text-emerald-700';
		}
	};

	const getStatusLabel = (status?: Product['status']) => {
		switch (status) {
			case 'published':
				return 'Published';
			case 'draft':
				return 'Draft List';
			case 'inactive':
				return 'Inactive';
			case 'stock-out':
				return 'Stock Out';
			default:
				return 'Published';
		}
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

	const handleAddProduct = () => {
		const fallbackImage = fallbackProducts[0]?.image ?? '/bottles/v01.webp';
		setRows((prev) => [buildNewProduct(fallbackImage), ...prev]);
		setIsDirty(true);
	};

	const handleDeleteProduct = (id: string) => {
		const target = rows.find((item) => item.id === id);
		if (!target) {
			return;
		}
		const confirmed = window.confirm(`Delete "${target.name}"? This cannot be undone.`);
		if (!confirmed) {
			return;
		}
		setRows((prev) => prev.filter((item) => item.id !== id));
		setIsDirty(true);
	};

	const toggleExpanded = (id: string) => {
		setExpandedId((prev) => (prev === id ? null : id));
	};

	const filteredRows = useMemo(() => {
		const query = searchValue.trim().toLowerCase();
		if (!query) {
			return rows;
		}
		return rows.filter((product) => {
			const haystack = `${product.name} ${product.slug} ${product.category}`.toLowerCase();
			return haystack.includes(query);
		});
	}, [rows, searchValue]);

	return (
		<div className='min-h-screen bg-[#efefef]'>
			<div className='container mx-auto px-6 py-12'>
				<div className='grid grid-cols-1 lg:grid-cols-[260px_1fr] gap-6'>
					<aside className='rounded-2xl border border-black/5 bg-white p-6 shadow-sm h-fit top-6'>
						<div className='flex items-center gap-3 mb-6'>
							<div className='h-10 w-10 rounded-xl bg-[#111111] text-white flex items-center justify-center font-bold'>P</div>
							<div>
								<p className='text-lg font-semibold text-[#1f1f1f]'>Pure Tide</p>
								<p className='text-xs text-[#8d8d8d] uppercase tracking-wide'>Admin</p>
							</div>
						</div>
						<nav className='space-y-2 text-sm text-[#4a4a4a]'>
							<button
								onClick={() => setActiveTab('products')}
								className={`w-full text-left px-4 py-3 rounded-xl transition-colors ${
									activeTab === 'products'
										? 'bg-[#6c5dd3] text-white'
										: 'bg-white border border-black/5 hover:bg-[#f4f4f7]'
								}`}>
								Products
							</button>
							<button
								onClick={() => setActiveTab('inventory')}
								className={`w-full text-left px-4 py-3 rounded-xl transition-colors ${
									activeTab === 'inventory'
										? 'bg-[#6c5dd3] text-white'
										: 'bg-white border border-black/5 hover:bg-[#f4f4f7]'
								}`}>
								Inventory
							</button>
							<button
								onClick={() => setActiveTab('alerts')}
								className={`w-full text-left px-4 py-3 rounded-xl transition-colors ${
									activeTab === 'alerts'
										? 'bg-[#6c5dd3] text-white'
										: 'bg-white border border-black/5 hover:bg-[#f4f4f7]'
								}`}>
								Alerts
							</button>
						</nav>
					</aside>

					<section className='flex flex-col gap-6'>
						<div className='rounded-2xl border border-black/5 bg-white p-6 shadow-sm flex flex-col gap-4'>
							<div className='flex flex-wrap items-center justify-between gap-4'>
								<div>
									<h1 className='text-2xl font-semibold text-[#1f1f1f]'>Products List</h1>
									<p className='text-[#7a7a7a] text-sm mt-1'>Manage products in Google Sheets</p>
								</div>
								<div className='flex flex-wrap items-center gap-2'>
									<button
										onClick={handleAddProduct}
										className='bg-[#6c5dd3] text-white font-semibold px-4 py-2 rounded-lg hover:bg-[#5b4ec7]'>
										+ Add Product
									</button>
									<button
										onClick={handleSave}
										disabled={!isDirty}
										className='bg-[#111111] text-white font-semibold px-4 py-2 rounded-lg disabled:bg-[#bdbdbd]'>
										Save changes
									</button>
									<button
										onClick={handleReset}
										className='bg-white border border-black/10 text-[#2f2f2f] font-medium px-4 py-2 rounded-lg hover:bg-[#f5f5f5]'>
										Reset
									</button>
								</div>
							</div>
							<div className='flex flex-wrap items-center justify-between gap-4'>
								<div className='relative w-full max-w-sm'>
									<input
										type='text'
										value={searchValue}
										onChange={(event) => setSearchValue(event.target.value)}
										placeholder='Search product...'
										className='w-full bg-white border border-black/10 rounded-lg px-4 py-2 text-sm text-[#2f2f2f] focus:outline-none focus:border-[#6c5dd3] focus:ring-2 focus:ring-[#6c5dd3]/20'
									/>
								</div>
								{isDirty && <span className='text-xs text-[#7a7a7a]'>Unsaved changes</span>}
							</div>
						</div>

						{activeTab === 'alerts' && (
							<div className='rounded-2xl border border-black/5 bg-white shadow-sm p-6 text-[#6a6a6a]'>
								Low-stock alerts are sent by the scheduled job on the server. Update stock in Google Sheets and alerts will go out automatically.
							</div>
						)}

						{activeTab === 'inventory' && (
							<div className='rounded-2xl border border-black/5 bg-white shadow-sm p-6'>
								<div className='grid grid-cols-[2fr_1fr_1fr] items-center text-left text-xs uppercase tracking-wide text-[#9b9b9b] pb-3 border-b border-black/5'>
									<span>Product name</span>
									<span>Stock</span>
									<span>Status</span>
								</div>
								<div className='divide-y divide-black/5'>
									{filteredRows.map((product) => (
										<div
											key={product.id}
											className='grid grid-cols-[2fr_1fr_1fr] items-center text-left py-4 text-sm text-[#2f2f2f]'>
											<span className='font-medium'>{product.name}</span>
											<span className='text-[#6a6a6a]'>{product.stock}</span>
											<span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${getStatusBadge(product.status)}`}>
												{getStatusLabel(product.status)}
											</span>
										</div>
									))}
									{filteredRows.length === 0 && (
										<div className='py-6 text-sm text-[#6a6a6a]'>No products found.</div>
									)}
								</div>
							</div>
						)}

						{activeTab === 'products' && (
							<div className='grid grid-cols-1 gap-4'>
								{isLoading && (
									<div className='rounded-2xl border border-black/5 bg-white shadow-sm p-6 text-[#6a6a6a]'>
										Loading stock from Google Sheets...
									</div>
								)}
								{!isLoading && filteredRows.length > 0 && (
									<div className='rounded-2xl border border-black/5 bg-[#f4f4f7] shadow-sm overflow-x-auto'>
										<div className='min-w-[980px]'>
											<div className='px-6 py-3 text-xs uppercase tracking-wide text-[#8d8d8d] border-b border-black/5'>
												<div className='grid grid-cols-[minmax(220px,2.5fr)_minmax(140px,1.5fr)_minmax(90px,0.8fr)_minmax(90px,0.8fr)_minmax(140px,1fr)_minmax(130px,0.8fr)] gap-5 items-center text-left'>
												<span>Product name</span>
												<span>Category</span>
												<span>Stock</span>
												<span>Price</span>
												<span>Status</span>
												<span>Action</span>
												</div>
											</div>
											<div className='divide-y divide-black/5 bg-white'>
												{filteredRows.map((product) => (
													<div key={product.id} className='px-6 py-4'>
														<div className='grid grid-cols-[minmax(220px,2.5fr)_minmax(140px,1.5fr)_minmax(90px,0.8fr)_minmax(90px,0.8fr)_minmax(140px,1fr)_minmax(130px,0.8fr)] gap-5 items-center text-left'>
														<div className='text-sm font-semibold text-[#2f2f2f] text-left'>{product.name}</div>
														<div className='text-sm text-[#6a6a6a]'>{product.category}</div>
														<div className='text-sm text-[#2f2f2f]'>
															{product.stock}
															{product.stock <= 5 && <span className='ml-2 text-xs text-amber-700'>Low Stock</span>}
														</div>
														<div className='text-sm text-[#2f2f2f]'>${product.price}</div>
														<div>
															<select
																value={product.status ?? 'published'}
																onChange={(event) => handleStatusChange(product.id, event.target.value as Product['status'])}
																className={`inline-flex w-auto rounded-full px-3 py-1 text-sm font-semibold ${getStatusBadge(product.status)} border border-transparent focus:outline-none focus:ring-2 focus:ring-[#6c5dd3]/20`}>
																<option value='published'>Published</option>
																<option value='draft'>Draft List</option>
																<option value='inactive'>Inactive</option>
																<option value='stock-out'>Stock Out</option>
															</select>
														</div>
														<div className='flex items-center justify-start gap-2'>
															<button
																type='button'
																onClick={() => toggleExpanded(product.id)}
																className='px-3 py-1.5 rounded-lg border border-black/10 text-sm font-semibold text-[#2f2f2f] hover:bg-[#f4f4f7]'>
																{expandedId === product.id ? 'Close' : 'Edit'}
															</button>
															<button
																type='button'
																onClick={() => handleDeleteProduct(product.id)}
																className='inline-flex h-9 w-9 items-center justify-center rounded-full border border-black/10 text-rose-700 hover:text-rose-800 hover:bg-rose-50'>
																<Trash2 className='h-4 w-4' />
															</button>
														</div>
													</div>

													{expandedId === product.id && (
														<div className='mt-4 border-t border-black/5 pt-4'>
															<div className='grid grid-cols-1 lg:grid-cols-[2fr_1fr_1fr_1fr] gap-4'>
																<div>
																<label className='block text-xs uppercase tracking-wide text-[#7a7a7a] mb-2'>Title</label>
																	<input
																		type='text'
																		value={product.name}
																		onChange={(event) => handleTitleChange(product.id, event.target.value)}
																		placeholder='Title'
																	className='w-full bg-white border border-black/10 rounded-lg px-4 py-2 text-sm text-[#2f2f2f] focus:outline-none focus:border-[#6c5dd3] focus:ring-2 focus:ring-[#6c5dd3]/20'
																	/>
																</div>
																<div>
																<label className='block text-xs uppercase tracking-wide text-[#7a7a7a] mb-2'>Price</label>
																	<input
																		type='number'
																		min={0}
																		step='0.01'
																		value={product.price}
																		onChange={(event) => handlePriceChange(product.id, event.target.value)}
																		placeholder='Price'
																	className='w-full bg-white border border-black/10 rounded-lg px-4 py-2 text-sm text-[#2f2f2f] focus:outline-none focus:border-[#6c5dd3] focus:ring-2 focus:ring-[#6c5dd3]/20'
																	/>
																</div>
																<div>
																<label className='block text-xs uppercase tracking-wide text-[#7a7a7a] mb-2'>Stock</label>
																	<input
																		type='number'
																		min={0}
																		max={9999}
																		value={product.stock}
																		onChange={(event) => handleStockChange(product.id, event.target.value)}
																		placeholder='Stock'
																	className='w-full bg-white border border-black/10 rounded-lg px-4 py-2 text-sm text-[#2f2f2f] focus:outline-none focus:border-[#6c5dd3] focus:ring-2 focus:ring-[#6c5dd3]/20'
																	/>
																</div>
																<div>
																<label className='block text-xs uppercase tracking-wide text-[#7a7a7a] mb-2'>Status</label>
																	<select
																		value={product.status ?? 'published'}
																		onChange={(event) => handleStatusChange(product.id, event.target.value as Product['status'])}
																	className='w-full bg-white border border-black/10 rounded-lg px-4 py-2 text-sm text-[#2f2f2f] focus:outline-none focus:border-[#6c5dd3] focus:ring-2 focus:ring-[#6c5dd3]/20'>
																		<option value='published'>Published</option>
																		<option value='draft'>Draft List</option>
																		<option value='inactive'>Inactive</option>
																		<option value='stock-out'>Stock Out</option>
																	</select>
																</div>
															</div>
															<div className='mt-4 grid grid-cols-1 lg:grid-cols-2 gap-4'>
																<div>
																<label className='block text-xs uppercase tracking-wide text-[#7a7a7a] mb-2'>Image URL</label>
																	<input
																		type='text'
																		value={product.image}
																		onChange={(event) => handleImageChange(product.id, event.target.value)}
																		placeholder='Image URL'
																	className='w-full bg-white border border-black/10 rounded-lg px-4 py-2 text-sm text-[#2f2f2f] focus:outline-none focus:border-[#6c5dd3] focus:ring-2 focus:ring-[#6c5dd3]/20'
																	/>
																</div>
																<div>
																<label className='block text-xs uppercase tracking-wide text-[#7a7a7a] mb-2'>Category</label>
																	<input
																		type='text'
																		value={product.category}
																		onChange={(event) => handleCategoryChange(product.id, event.target.value)}
																		placeholder='Category'
																	className='w-full bg-white border border-black/10 rounded-lg px-4 py-2 text-sm text-[#2f2f2f] focus:outline-none focus:border-[#6c5dd3] focus:ring-2 focus:ring-[#6c5dd3]/20'
																	/>
																</div>
																<div className='lg:col-span-2'>
																<label className='block text-xs uppercase tracking-wide text-[#7a7a7a] mb-2'>Description</label>
																	<textarea
																		rows={2}
																		value={product.description}
																		onChange={(event) => updateRow(product.id, { description: event.target.value })}
																		placeholder='Short description'
																	className='w-full bg-white border border-black/10 rounded-lg px-4 py-2 text-sm text-[#2f2f2f] focus:outline-none focus:border-[#6c5dd3] focus:ring-2 focus:ring-[#6c5dd3]/20'
																	/>
																</div>
																<div className='lg:col-span-2'>
																<label className='block text-xs uppercase tracking-wide text-[#7a7a7a] mb-2'>Details</label>
																	<textarea
																		rows={3}
																		value={product.details ?? ''}
																		onChange={(event) => updateRow(product.id, { details: event.target.value })}
																		placeholder='Details'
																	className='w-full bg-white border border-black/10 rounded-lg px-4 py-2 text-sm text-[#2f2f2f] focus:outline-none focus:border-[#6c5dd3] focus:ring-2 focus:ring-[#6c5dd3]/20'
																	/>
																</div>
																<div className='lg:col-span-2'>
																<label className='block text-xs uppercase tracking-wide text-[#7a7a7a] mb-2'>Icons (comma separated)</label>
																	<input
																		type='text'
																		value={(product.icons ?? []).join(', ')}
																		onChange={(event) => handleIconsChange(product.id, event.target.value)}
																		placeholder='Icons (comma separated)'
																	className='w-full bg-white border border-black/10 rounded-lg px-4 py-2 text-sm text-[#2f2f2f] focus:outline-none focus:border-[#6c5dd3] focus:ring-2 focus:ring-[#6c5dd3]/20'
																	/>
																</div>
															</div>
														</div>
													)}
													</div>
												))}
											</div>
										</div>
									</div>
								)}
							</div>
						)}
					</section>
				</div>
			</div>
		</div>
	);
}
