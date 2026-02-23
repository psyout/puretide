'use client';

import { useEffect, useMemo, useState } from 'react';
import { Trash2, Copy } from 'lucide-react';
import { products as fallbackProducts } from '@/lib/products';
import type { Product, PromoCode } from '@/types/product';

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
		subtitle: '',
		description: '',
		details: '',
		price: 0,
		stock: 0,
		image: fallbackImage,
		category: 'General',
		mg: '',
		icons: [],
		status: 'draft',
	};
};

export default function StockDashboardPage() {
	const [rows, setRows] = useState<Product[]>(fallbackProducts);
	const [isDirty, setIsDirty] = useState(false);
	const [isLoading, setIsLoading] = useState(true);
	const [activeTab, setActiveTab] = useState<'products' | 'orders' | 'promos' | 'clients'>('products');
	const [searchValue, setSearchValue] = useState('');
	const [expandedId, setExpandedId] = useState<string | null>(null);

	const [orders, setOrders] = useState<Array<Record<string, unknown>>>([]);
	const [ordersLoading, setOrdersLoading] = useState(false);
	const [ordersError, setOrdersError] = useState<string | null>(null);

	const [promoCodes, setPromoCodes] = useState<PromoCode[]>([]);
	const [promoCodesLoading, setPromoCodesLoading] = useState(false);
	const [promoCodesDirty, setPromoCodesDirty] = useState(false);
	const [promoCodesError, setPromoCodesError] = useState<string | null>(null);

	const [clients, setClients] = useState<Array<Record<string, unknown>>>([]);
	const [clientsLoading, setClientsLoading] = useState(false);
	const [clientsError, setClientsError] = useState<string | null>(null);

	const [productsError, setProductsError] = useState<string | null>(null);
	const [saveError, setSaveError] = useState<string | null>(null);
	const [savePromosError, setSavePromosError] = useState<string | null>(null);

	useEffect(() => {
		const load = async () => {
			try {
				setProductsError(null);
				const response = await fetch('/api/stock');
				const data = (await response.json()) as { ok?: boolean; items?: Product[]; error?: string };
				if (response.ok && data.ok && data.items) {
					setRows(data.items);
				} else {
					setProductsError(data.error ?? 'Failed to load products.');
				}
			} catch (e) {
				setProductsError(e instanceof Error ? e.message : 'Failed to load products.');
			} finally {
				setIsLoading(false);
			}
		};
		void load();
	}, []);

	useEffect(() => {
		if (activeTab !== 'orders') return;
		let cancelled = false;
		setOrdersLoading(true);
		setOrdersError(null);
		(async () => {
			try {
				const response = await fetch('/api/dashboard/orders', { credentials: 'include' });
				const data = (await response.json()) as { ok?: boolean; orders?: Array<Record<string, unknown>>; error?: string };
				if (cancelled) return;
				if (response.ok && data.ok && data.orders) {
					setOrders(data.orders);
				} else {
					setOrdersError(data.error ?? (response.status === 401 ? 'Unauthorized. Sign in at /dashboard/login.' : 'Failed to load orders.'));
				}
			} catch (e) {
				if (!cancelled) setOrdersError(e instanceof Error ? e.message : 'Failed to load orders.');
			} finally {
				if (!cancelled) setOrdersLoading(false);
			}
		})();
		return () => {
			cancelled = true;
		};
	}, [activeTab]);

	useEffect(() => {
		if (activeTab !== 'promos') return;
		let cancelled = false;
		setPromoCodesLoading(true);
		setPromoCodesError(null);
		(async () => {
			try {
				const response = await fetch('/api/dashboard/promo', { credentials: 'include' });
				const data = (await response.json()) as { ok?: boolean; codes?: PromoCode[]; error?: string };
				if (cancelled) return;
				if (response.ok && data.ok && data.codes) {
					setPromoCodes(data.codes);
				} else {
					setPromoCodesError(data.error ?? 'Failed to load promo codes.');
				}
			} catch (e) {
				if (!cancelled) setPromoCodesError(e instanceof Error ? e.message : 'Failed to load promo codes.');
			} finally {
				if (!cancelled) setPromoCodesLoading(false);
			}
		})();
		return () => {
			cancelled = true;
		};
	}, [activeTab]);

	useEffect(() => {
		if (activeTab !== 'clients') return;
		let cancelled = false;
		setClientsLoading(true);
		setClientsError(null);
		(async () => {
			try {
				const response = await fetch('/api/dashboard/clients', { credentials: 'include' });
				const data = (await response.json()) as { ok?: boolean; clients?: Array<Record<string, unknown>>; error?: string };
				if (cancelled) return;
				if (response.ok && data.ok && data.clients) {
					setClients(data.clients);
				} else {
					setClientsError(data.error ?? 'Failed to load clients.');
				}
			} catch (e) {
				if (!cancelled) setClientsError(e instanceof Error ? e.message : 'Failed to load clients.');
			} finally {
				if (!cancelled) setClientsLoading(false);
			}
		})();
		return () => {
			cancelled = true;
		};
	}, [activeTab]);

	const updateRow = (id: string, next: Partial<Product>) => {
		setRows((prev) => prev.map((product) => (product.id === id ? { ...product, ...next } : product)));
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
		setSaveError(null);
		const response = await fetch('/api/dashboard/stock', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ items: rows }),
			credentials: 'include',
		});
		const data = (await response.json()) as { ok?: boolean; error?: string };
		if (response.ok && data.ok) {
			setIsDirty(false);
		} else {
			setSaveError(data.error ?? (response.status === 401 ? 'Unauthorized. Sign in at /dashboard/login.' : 'Failed to save.'));
		}
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

	const handleDuplicateProduct = (product: Product) => {
		const newId = typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `p_${Date.now()}`;
		const duplicated: Product = {
			...product,
			id: newId,
			slug: `${product.slug}-copy-${newId.slice(-6)}`,
			name: `${product.name} (Copy)`,
			status: 'draft',
		};
		setRows((prev) => [duplicated, ...prev]);
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

	const handlePromoChange = (index: number, field: keyof PromoCode, value: string | number | boolean) => {
		setPromoCodes((prev) => {
			const next = [...prev];
			next[index] = { ...next[index], [field]: value };
			return next;
		});
		setPromoCodesDirty(true);
	};

	const handleAddPromo = () => {
		setPromoCodes((prev) => [...prev, { code: '', discount: 0, active: true }]);
		setPromoCodesDirty(true);
	};

	const handleRemovePromo = (index: number) => {
		setPromoCodes((prev) => prev.filter((_, i) => i !== index));
		setPromoCodesDirty(true);
	};

	const handleSavePromos = async () => {
		setSavePromosError(null);
		const response = await fetch('/api/dashboard/promo', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ codes: promoCodes.filter((p) => p.code.trim()) }),
			credentials: 'include',
		});
		const data = (await response.json()) as { ok?: boolean; error?: string };
		if (response.ok && data.ok) {
			setPromoCodesDirty(false);
		} else {
			setSavePromosError(data.error ?? (response.status === 401 ? 'Unauthorized. Use dashboard login.' : 'Failed to save promo codes.'));
		}
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
							<a
								href='/dashboard/login'
								onClick={async (e) => {
									e.preventDefault();
									await fetch('/api/dashboard/signout', { method: 'POST', credentials: 'include' });
									window.location.href = '/dashboard/login';
								}}
								className='w-full text-left px-4 py-3 rounded-xl transition-colors bg-white border border-black/5 hover:bg-[#f4f4f7] block text-rose-600 hover:text-rose-700'>
								Sign out
							</a>
							<button
								onClick={() => setActiveTab('products')}
								className={`w-full text-left px-4 py-3 rounded-xl transition-colors ${
									activeTab === 'products' ? 'bg-[#6c5dd3] text-white' : 'bg-white border border-black/5 hover:bg-[#f4f4f7]'
								}`}>
								Products
							</button>
							<button
								onClick={() => setActiveTab('orders')}
								className={`w-full text-left px-4 py-3 rounded-xl transition-colors ${
									activeTab === 'orders' ? 'bg-[#6c5dd3] text-white' : 'bg-white border border-black/5 hover:bg-[#f4f4f7]'
								}`}>
								Orders
							</button>
							<button
								onClick={() => setActiveTab('promos')}
								className={`w-full text-left px-4 py-3 rounded-xl transition-colors ${
									activeTab === 'promos' ? 'bg-[#6c5dd3] text-white' : 'bg-white border border-black/5 hover:bg-[#f4f4f7]'
								}`}>
								Promo Codes
							</button>
							<button
								onClick={() => setActiveTab('clients')}
								className={`w-full text-left px-4 py-3 rounded-xl transition-colors ${
									activeTab === 'clients' ? 'bg-[#6c5dd3] text-white' : 'bg-white border border-black/5 hover:bg-[#f4f4f7]'
								}`}>
								Clients
							</button>
						</nav>
					</aside>

					<section className='flex flex-col gap-6'>
						{activeTab === 'products' && (
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
								{(productsError || saveError) && (
									<div className='rounded-lg bg-rose-50 border border-rose-200 px-4 py-3 text-sm text-rose-800'>
										{productsError ?? saveError}
									</div>
								)}
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
						)}

						{activeTab === 'orders' && (
							<div className='rounded-2xl border border-black/5 bg-white shadow-sm p-6'>
								<h2 className='text-xl font-semibold text-[#1f1f1f] mb-4'>Recent Orders</h2>
								{ordersError && (
									<div className='rounded-lg bg-rose-50 border border-rose-200 px-4 py-3 text-sm text-rose-800 mb-4'>{ordersError}</div>
								)}
								{ordersLoading ? (
									<div className='text-[#6a6a6a] py-8'>Loading orders...</div>
								) : orders.length === 0 ? (
									<div className='text-[#6a6a6a] py-8'>{ordersError ? 'Could not load orders.' : 'No orders yet.'}</div>
								) : (
									<div className='divide-y divide-black/5 overflow-x-auto'>
										<table className='w-full min-w-[640px]'>
											<thead>
												<tr className='text-left text-xs uppercase tracking-wide text-[#9b9b9b]'>
													<th className='pb-3 pr-6 font-medium'>Order #</th>
													<th className='pb-3 pr-6 font-medium'>Customer</th>
													<th className='pb-3 pr-6 font-medium'>Products</th>
													<th className='pb-3 pr-6 font-medium'>Date</th>
													<th className='pb-3 pr-6 font-medium'>Payment</th>
													<th className='pb-3 pl-6 text-right font-medium'>Total</th>
												</tr>
											</thead>
											<tbody className='text-sm text-[#2f2f2f]'>
												{orders.slice(0, 50).map((order) => {
													const c = order.customer as Record<string, string> | undefined;
													const cart = (order.cartItems as Array<Record<string, unknown>>) ?? [];
													const date = order.createdAt ? new Date(String(order.createdAt)).toLocaleDateString() : '-';
													const products = cart
														.map((item) => `${String(item.name ?? 'Item')}${Number(item.quantity ?? 1) > 1 ? ` ×${item.quantity}` : ''}`)
														.join(', ');
													const payment = order.paymentMethod === 'creditcard' ? 'Card' : order.paymentMethod === 'etransfer' ? 'E-Transfer' : String(order.paymentMethod ?? '-');
													return (
														<tr key={String(order.id)} className='border-t border-black/5'>
															<td className='py-4 pr-6 font-medium'>{String(order.orderNumber ?? order.id ?? '-')}</td>
															<td className='py-4 pr-6'>{c ? `${c.firstName} ${c.lastName}` : '-'}</td>
															<td className='py-4 pr-6 text-[#6a6a6a]'>{products || '-'}</td>
															<td className='py-4 pr-6'>{date}</td>
															<td className='py-4 pr-6'>{payment}</td>
															<td className='py-4 pl-6 text-right'>${Number(order.total ?? 0).toFixed(2)}</td>
														</tr>
													);
												})}
											</tbody>
										</table>
									</div>
								)}
							</div>
						)}

						{activeTab === 'promos' && (
							<div className='rounded-2xl border border-black/5 bg-white shadow-sm p-6'>
								<div className='flex items-center justify-between mb-4'>
									<h2 className='text-xl font-semibold text-[#1f1f1f]'>Promo Codes</h2>
									<div className='flex gap-2'>
										<button
											onClick={handleAddPromo}
											className='bg-[#6c5dd3] text-white font-semibold px-4 py-2 rounded-lg hover:bg-[#5b4ec7]'>
											+ Add Code
										</button>
										<button
											onClick={handleSavePromos}
											disabled={!promoCodesDirty}
											className='bg-[#111111] text-white font-semibold px-4 py-2 rounded-lg disabled:bg-[#bdbdbd]'>
											Save
										</button>
									</div>
								</div>
								{(promoCodesError || savePromosError) && (
									<div className='rounded-lg bg-rose-50 border border-rose-200 px-4 py-3 text-sm text-rose-800 mb-4'>
										{promoCodesError ?? savePromosError}
									</div>
								)}
								{promoCodesLoading ? (
									<div className='text-[#6a6a6a] py-8'>Loading promo codes...</div>
								) : promoCodes.length === 0 ? (
									<div className='text-[#6a6a6a] py-8'>No promo codes. Add one to get started.</div>
								) : (
									<div className='space-y-4'>
										{promoCodes.map((promo, i) => (
											<div
												key={i}
												className='flex flex-wrap items-center gap-4 p-4 rounded-lg border border-black/5 bg-[#f4f4f7]'>
												<input
													type='text'
													value={promo.code}
													onChange={(e) => handlePromoChange(i, 'code', e.target.value.toUpperCase())}
													placeholder='CODE'
													className='w-28 px-3 py-2 border border-black/10 rounded text-sm font-mono'
												/>
												<input
													type='number'
													min={0}
													max={100}
													value={promo.discount}
													onChange={(e) => handlePromoChange(i, 'discount', Number(e.target.value) || 0)}
													className='w-20 px-3 py-2 border border-black/10 rounded text-sm'
												/>
												<span className='text-[#6a6a6a] text-sm'>% off</span>
												<label className='flex items-center gap-2'>
													<input
														type='checkbox'
														checked={promo.active}
														onChange={(e) => handlePromoChange(i, 'active', e.target.checked)}
													/>
													<span className='text-sm'>Active</span>
												</label>
												<button
													onClick={() => handleRemovePromo(i)}
													className='text-rose-600 hover:text-rose-700 text-sm'>
													Remove
												</button>
											</div>
										))}
									</div>
								)}
							</div>
						)}

						{activeTab === 'clients' && (
							<div className='rounded-2xl border border-black/5 bg-white shadow-sm p-6'>
								<h2 className='text-xl font-semibold text-[#1f1f1f] mb-4'>Clients</h2>
								{clientsError && (
									<div className='rounded-lg bg-rose-50 border border-rose-200 px-4 py-3 text-sm text-rose-800 mb-4'>{clientsError}</div>
								)}
								{clientsLoading ? (
									<div className='text-[#6a6a6a] py-8'>Loading clients...</div>
								) : clients.length === 0 ? (
									<div className='text-[#6a6a6a] py-8'>No clients yet.</div>
								) : (
									<div className='divide-y divide-black/5 overflow-x-auto'>
										<div className='grid grid-cols-[1.5fr_1fr_1fr_auto_auto] gap-4 pb-3 text-xs uppercase tracking-wide text-[#9b9b9b]'>
											<span>Email</span>
											<span>Name</span>
											<span>Orders</span>
											<span>Total</span>
											<span>Last Order</span>
										</div>
										{clients.map((client, i) => (
											<div
												key={String(client.email ?? i)}
												className='grid grid-cols-[1.5fr_1fr_1fr_auto_auto] gap-4 py-4 text-sm text-[#2f2f2f]'>
												<span className='font-medium'>{String(client.email ?? '-')}</span>
												<span>{[String(client.firstName ?? ''), String(client.lastName ?? '')].filter(Boolean).join(' ') || '-'}</span>
												<span>{Number(client.ordersCount ?? 0)}</span>
												<span>${Number(client.totalSpent ?? 0).toFixed(2)}</span>
												<span>{String(client.lastOrderDate ?? '-')}</span>
											</div>
										))}
									</div>
								)}
							</div>
						)}

						{activeTab === 'products' && (
							<div className='grid grid-cols-1 gap-4'>
								{isLoading && <div className='rounded-2xl border border-black/5 bg-white shadow-sm p-6 text-[#6a6a6a]'>Loading stock from Google Sheets...</div>}
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
													<div
														key={product.id}
														className='px-6 py-4'>
														<div className='grid grid-cols-[minmax(220px,2.5fr)_minmax(140px,1.5fr)_minmax(90px,0.8fr)_minmax(90px,0.8fr)_minmax(140px,1fr)_minmax(130px,0.8fr)] gap-5 items-center text-left'>
															<div className='text-sm font-semibold text-[#2f2f2f] text-left'>
																{product.name}
																{product.mg && <sup className='text-xs ml-0.5 align-top opacity-70'>{product.mg}</sup>}
															</div>
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
															<div className='flex items-center justify-start gap-4'>
																<button
																	type='button'
																	onClick={() => toggleExpanded(product.id)}
																	className='px-3 py-1.5 rounded-lg border border-black/10 text-sm font-semibold text-[#2f2f2f] hover:bg-[#f4f4f7]'>
																	{expandedId === product.id ? 'Close' : 'Edit'}
																</button>
																<button
																	type='button'
																	onClick={() => handleDuplicateProduct(product)}
																	className='inline-flex h-9 w-9 items-center justify-center text-[#6c5dd3] hover:text-[#5b4ec7] hover:bg-[#6c5dd3]/10'
																	title='Duplicate'>
																	<Copy className='h-4 w-4' />
																</button>
																<button
																	type='button'
																	onClick={() => handleDeleteProduct(product.id)}
																	className='inline-flex h-9 w-9 items-center justify-center text-rose-700 hover:text-rose-800 hover:bg-rose-50'>
																	<Trash2 className='h-4 w-4' />
																</button>
															</div>
														</div>

														{expandedId === product.id && (
															<div className='mt-4 border-t border-black/5 pt-4'>
																<div className='grid grid-cols-1 lg:grid-cols-6 gap-4'>
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
																		<label className='block text-xs uppercase tracking-wide text-[#7a7a7a] mb-2'>Subtitle</label>
																		<input
																			type='text'
																			value={product.subtitle ?? ''}
																			onChange={(event) => updateRow(product.id, { subtitle: event.target.value })}
																			placeholder='e.g. BPC157 10mg + TB500 10mg'
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
																	<div>
																		<label className='block text-xs uppercase tracking-wide text-[#7a7a7a] mb-2'>Milligrams (mg)</label>
																		<input
																			type='text'
																			value={product.mg ?? ''}
																			onChange={(event) => updateRow(product.id, { mg: event.target.value })}
																			placeholder='e.g. 5mg'
																			className='w-full bg-white border border-black/10 rounded-lg px-4 py-2 text-sm text-[#2f2f2f] focus:outline-none focus:border-[#6c5dd3] focus:ring-2 focus:ring-[#6c5dd3]/20'
																		/>
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
