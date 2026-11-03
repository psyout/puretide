'use client';

import { useEffect, useMemo, useState } from 'react';
import {
	ArrowUpDown,
	BadgePercent,
	BarChart3,
	Check,
	ChevronDown,
	CircleCheckBig,
	Copy,
	FileCheck2,
	FileX2,
	HandCoins,
	HeartHandshake,
	LogOut,
	Megaphone,
	MoreHorizontal,
	Package,
	Pencil,
	RefreshCw,
	Search,
	Send,
	ShoppingCart,
	ShoppingBag,
	Tag,
	Trash2,
	UserPlus,
	Users,
	X,
} from 'lucide-react';
import { products as fallbackProducts } from '@/lib/products';
import { resolveProductCoaFile } from '@/lib/productCoa';
import type { Product, PromoCode, PromoCodeKind } from '@/types/product';
import AbandonedCartsPanel from '@/components/AbandonedCartsPanel';
import AffiliatesPanel from '@/components/AffiliatesPanel';

const clampStock = (value: number) => Math.max(0, Math.min(9999, value));
const clampPrice = (value: number) => Math.max(0, Number(value.toFixed(2)));

const toSlug = (value: string) =>
	value
		.trim()
		.toLowerCase()
		.replace(/[^a-z0-9\s-]/g, '')
		.replace(/\s+/g, '-')
		.replace(/-+/g, '-');

const formatCompactList = (values: unknown[], visibleItems: number, separator = ', ') => {
	const items = Array.from(new Set(values.map((value) => String(value ?? '').trim()).filter(Boolean)));
	if (items.length <= visibleItems) return items.join(separator);
	return `${items.slice(0, visibleItems).join(separator)}${separator}… +${items.length - visibleItems} more`;
};

type FriendsFamilyEntry = {
	email: string;
	isActive: boolean;
	note?: string;
};

type DashboardUserProfile = {
	name?: string;
	nickname?: string;
	given_name?: string;
	email?: string;
	picture?: string;
};

type PromoSort = 'sheet' | 'code-asc' | 'discount-desc' | 'discount-asc' | 'active-first';
type ClientSort = 'sheet' | 'email-asc' | 'name-asc' | 'orders-desc' | 'spent-desc' | 'recent';
type OrderSort = 'sheet' | 'newest' | 'oldest' | 'total-desc' | 'total-asc' | 'customer-asc';
type ProductSort = 'zoho' | 'name-asc' | 'stock-desc' | 'stock-asc' | 'price-desc' | 'price-asc' | 'status';

const PROMO_KIND_DETAILS: Record<PromoCodeKind, { label: string; shortLabel: string; description: string }> = {
	affiliate: { label: 'Affiliate codes', shortLabel: 'affiliate code', description: 'Partner codes with commission tracking' },
	promo: { label: 'Campaign promos', shortLabel: 'campaign promo', description: 'Scheduled and time-sensitive offers' },
	general: { label: 'General discounts', shortLabel: 'general discount', description: 'Simple, evergreen discount codes' },
};

const getPromoKind = (promo: PromoCode): PromoCodeKind => {
	if (promo.kind) return promo.kind;
	if (promo.affiliateName?.trim() || Number(promo.commissionPercentage ?? 0) > 0) return 'affiliate';
	if (promo.startDate?.trim() || promo.endDate?.trim()) return 'promo';
	return 'general';
};

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
	const [availableCoaFiles, setAvailableCoaFiles] = useState<string[]>([]);
	const [isDirty, setIsDirty] = useState(false);
	const [isLoading, setIsLoading] = useState(true);
	const [productStatusUpdatingId, setProductStatusUpdatingId] = useState<string | null>(null);
	const [activeTab, setActiveTab] = useState<'products' | 'orders' | 'promos' | 'affiliates' | 'clients' | 'friends_family' | 'abandoned_carts'>('products');
	const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
	const [dashboardUser, setDashboardUser] = useState<DashboardUserProfile | null>(null);
	const [profileImageFailed, setProfileImageFailed] = useState(false);
	const [searchValue, setSearchValue] = useState('');
	const [productSort, setProductSort] = useState<ProductSort>('zoho');
	const [expandedId, setExpandedId] = useState<string | null>(null);

	const [orders, setOrders] = useState<Array<Record<string, unknown>>>([]);
	const [ordersLoading, setOrdersLoading] = useState(false);
	const [ordersError, setOrdersError] = useState<string | null>(null);
	const [orderSearchValue, setOrderSearchValue] = useState('');
	const [orderSort, setOrderSort] = useState<OrderSort>('sheet');
	const [trackingEmailLoading, setTrackingEmailLoading] = useState(false);
	const [trackingEmailError, setTrackingEmailError] = useState<string | null>(null);
	const [trackingEmailOkMessage, setTrackingEmailOkMessage] = useState<string | null>(null);
	const [completingOrderNumber, setCompletingOrderNumber] = useState<string | null>(null);
	const [orderActionMessage, setOrderActionMessage] = useState<string | null>(null);

	const handleSendTrackingEmail = async (orderNumber: string) => {
		setTrackingEmailLoading(true);
		setTrackingEmailError(null);
		setTrackingEmailOkMessage(null);
		try {
			const response = await fetch('/api/dashboard/tracking-email', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				credentials: 'include',
				body: JSON.stringify({ orderNumber }),
			});
			const data = (await response.json()) as { ok?: boolean; message?: string; error?: string };
			if (!response.ok || !data.ok) {
				setTrackingEmailError(data.error ?? (response.status === 401 ? 'Unauthorized. Sign in at /dashboard/login.' : 'Failed to send tracking email.'));
				return;
			}
			setTrackingEmailOkMessage(data.message ?? `Tracking email processed for order #${orderNumber}.`);
		} catch (e) {
			setTrackingEmailError(e instanceof Error ? e.message : 'Failed to send tracking email.');
		} finally {
			setTrackingEmailLoading(false);
		}
	};

	const handleCompleteFriendsFamilyOrder = async (orderNumber: string) => {
		if (!window.confirm(`Confirm that payment for order #${orderNumber} was received? This will decrement stock and send confirmation emails.`)) return;

		setCompletingOrderNumber(orderNumber);
		setOrdersError(null);
		setOrderActionMessage(null);
		try {
			const response = await fetch('/api/dashboard/orders', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				credentials: 'include',
				body: JSON.stringify({ orderNumber }),
			});
			const data = (await response.json()) as { ok?: boolean; message?: string; error?: string; order?: Record<string, unknown> };
			if (!response.ok || !data.ok) {
				setOrdersError(data.error ?? 'Failed to complete the order.');
				return;
			}
			if (data.order) {
				setOrders((current) => current.map((order) => (String(order.orderNumber ?? order.id) === orderNumber ? data.order! : order)));
			}
			setOrderActionMessage(data.message ?? `Order #${orderNumber} marked paid and fulfilled.`);
		} catch (e) {
			setOrdersError(e instanceof Error ? e.message : 'Failed to complete the order.');
		} finally {
			setCompletingOrderNumber(null);
		}
	};

	const [promoCodes, setPromoCodes] = useState<PromoCode[]>([]);
	const [promoCodesLoading, setPromoCodesLoading] = useState(false);
	const [promoCodesDirty, setPromoCodesDirty] = useState(false);
	const [promoCodesError, setPromoCodesError] = useState<string | null>(null);
	const [promoSearchValue, setPromoSearchValue] = useState('');
	const [promoSort, setPromoSort] = useState<PromoSort>('sheet');
	const [promoKind, setPromoKind] = useState<PromoCodeKind>('affiliate');

	const [clients, setClients] = useState<Array<Record<string, unknown>>>([]);
	const [clientsLoading, setClientsLoading] = useState(false);
	const [clientsError, setClientsError] = useState<string | null>(null);
	const [clientSearchValue, setClientSearchValue] = useState('');
	const [clientSort, setClientSort] = useState<ClientSort>('sheet');
	const [friendsFamilyEntries, setFriendsFamilyEntries] = useState<FriendsFamilyEntry[]>([]);
	const [friendsFamilyLoading, setFriendsFamilyLoading] = useState(false);
	const [friendsFamilyError, setFriendsFamilyError] = useState<string | null>(null);
	const [friendsFamilySearchValue, setFriendsFamilySearchValue] = useState('');
	const [newFriendsFamilyEmail, setNewFriendsFamilyEmail] = useState('');
	const [friendsFamilyAdding, setFriendsFamilyAdding] = useState(false);
	const [friendsFamilyUpdatingEmail, setFriendsFamilyUpdatingEmail] = useState<string | null>(null);
	const [friendsFamilyDeletingEmail, setFriendsFamilyDeletingEmail] = useState<string | null>(null);
	const [friendsFamilyEditingEmail, setFriendsFamilyEditingEmail] = useState<string | null>(null);
	const [friendsFamilyEditValue, setFriendsFamilyEditValue] = useState('');
	const [friendsFamilyMessage, setFriendsFamilyMessage] = useState<string | null>(null);
	const [surveyAnalytics, setSurveyAnalytics] = useState<{
		totalClients: number;
		withSurveyData: number;
		withoutSurveyData: number;
		sources: Record<string, number>;
		sourcePercentages: Record<string, number>;
	} | null>(null);

	const [productsError, setProductsError] = useState<string | null>(null);
	const [saveError, setSaveError] = useState<string | null>(null);
	const [savePromosError, setSavePromosError] = useState<string | null>(null);
	const [isRefreshingData, setIsRefreshingData] = useState(false);
	const [refreshDataMessage, setRefreshDataMessage] = useState<{ kind: 'success' | 'error'; text: string } | null>(null);

	const handleRefreshProductionData = async () => {
		setIsRefreshingData(true);
		setRefreshDataMessage(null);
		try {
			const response = await fetch('/api/cache/invalidate', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				credentials: 'include',
				body: JSON.stringify({ scope: 'all' }),
			});
			const data = (await response.json()) as {
				ok?: boolean;
				message?: string;
				error?: string;
				counts?: { products?: number };
			};
			if (!response.ok || !data.ok) throw new Error(data.error ?? 'Failed to refresh production data.');

			const stockResponse = await fetch('/api/dashboard/stock', { credentials: 'include', cache: 'no-store' });
			const stockData = (await stockResponse.json()) as { ok?: boolean; items?: Product[]; coaFiles?: string[] };
			if (stockResponse.ok && stockData.ok && stockData.items) {
				setRows(stockData.items);
				setAvailableCoaFiles(stockData.coaFiles ?? []);
			}
			setRefreshDataMessage({
				kind: 'success',
				text: `${data.message ?? 'Production data refreshed.'}${data.counts?.products != null ? ` ${data.counts.products} Zoho products loaded.` : ''}`,
			});
		} catch (error) {
			setRefreshDataMessage({ kind: 'error', text: error instanceof Error ? error.message : 'Failed to refresh production data.' });
		} finally {
			setIsRefreshingData(false);
		}
	};

	useEffect(() => {
		let cancelled = false;
		(async () => {
			try {
				const response = await fetch('/auth/profile', { credentials: 'include', cache: 'no-store' });
				if (!response.ok) return;
				const data = (await response.json()) as DashboardUserProfile | { user?: DashboardUserProfile };
				const profile = (data as { user?: DashboardUserProfile }).user ?? (data as DashboardUserProfile);
				if (!cancelled && profile) setDashboardUser(profile);
			} catch {
				// Legacy dashboard-secret sessions do not have an Auth0 profile.
			}
		})();
		return () => {
			cancelled = true;
		};
	}, []);

	useEffect(() => {
		const load = async () => {
			try {
				setProductsError(null);
				const response = await fetch('/api/dashboard/stock', { credentials: 'include' });
				const data = (await response.json()) as { ok?: boolean; items?: Product[]; coaFiles?: string[]; error?: string };
				if (response.ok && data.ok && data.items) {
					setRows(data.items);
					setAvailableCoaFiles(data.coaFiles ?? []);
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
		if (activeTab !== 'friends_family') return;
		let cancelled = false;
		setFriendsFamilyLoading(true);
		setFriendsFamilyError(null);
		(async () => {
			try {
				const response = await fetch('/api/dashboard/friends-family', { credentials: 'include' });
				const data = (await response.json()) as {
					ok?: boolean;
					entries?: FriendsFamilyEntry[];
					error?: string;
				};
				if (cancelled) return;
				if (response.ok && data.ok && Array.isArray(data.entries)) {
					setFriendsFamilyEntries(data.entries);
				} else {
					setFriendsFamilyError(data.error ?? (response.status === 401 ? 'Unauthorized. Sign in at /dashboard/login.' : 'Failed to load Friends & Family allowlist.'));
				}
			} catch (e) {
				if (!cancelled) setFriendsFamilyError(e instanceof Error ? e.message : 'Failed to load Friends & Family allowlist.');
			} finally {
				if (!cancelled) setFriendsFamilyLoading(false);
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
					setPromoCodes(data.codes.map((promo) => ({ ...promo, kind: getPromoKind(promo) })));
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
				const data = (await response.json()) as {
					ok?: boolean;
					clients?: Array<Record<string, unknown>>;
					surveyAnalytics?: {
						totalClients: number;
						withSurveyData: number;
						withoutSurveyData: number;
						sources: Record<string, number>;
						sourcePercentages: Record<string, number>;
					};
					error?: string;
				};
				if (cancelled) return;
				if (response.ok && data.ok && data.clients) {
					setClients(data.clients);
					if (data.surveyAnalytics) {
						setSurveyAnalytics(data.surveyAnalytics);
					}
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

	const handleStatusChange = async (id: string, value: Product['status']) => {
		if (value !== 'published' && value !== 'draft' && value !== 'inactive') return;
		setProductStatusUpdatingId(id);
		setSaveError(null);
		try {
			const response = await fetch('/api/dashboard/stock', {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				credentials: 'include',
				body: JSON.stringify({ productId: id, status: value }),
			});
			const data = (await response.json()) as { ok?: boolean; item?: Product; error?: string };
			if (!response.ok || !data.ok || !data.item) {
				setSaveError(data.error ?? 'Failed to update Website Status in Zoho Inventory.');
				return;
			}
			setRows((previous) => previous.map((product) => (product.id === id ? { ...product, status: data.item?.status } : product)));
		} catch (error) {
			setSaveError(error instanceof Error ? error.message : 'Failed to update Website Status in Zoho Inventory.');
		} finally {
			setProductStatusUpdatingId(null);
		}
	};

	const getStatusBadge = (status?: Product['status']) => {
		switch (status) {
			case 'published':
				return 'bg-eucalyptus-100 text-deep-tidal-teal';
			case 'draft':
				return 'bg-gray-100 text-gray-600';
			case 'inactive':
				return 'bg-rose-100 text-rose-700';
			case 'stock-out':
				return 'bg-amber-100 text-amber-700';
			default:
				return 'bg-eucalyptus-100 text-deep-tidal-teal';
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

	const handlePromoChange = (index: number, field: keyof PromoCode, value: string | number | boolean | string[]) => {
		setPromoCodes((prev) => {
			const next = [...prev];
			next[index] = { ...next[index], [field]: value };
			return next;
		});
		setPromoCodesDirty(true);
	};

	const handlePromoProductToggle = (index: number, productId: string, checked: boolean) => {
		const selectedIds = promoCodes[index]?.productIds ?? [];
		const nextIds = checked ? Array.from(new Set([...selectedIds, productId])) : selectedIds.filter((id) => id !== productId);
		handlePromoChange(index, 'productIds', nextIds);
	};

	const handleAddPromo = () => {
		setPromoCodes((prev) => [
			{
				code: '',
				discount: 10,
				kind: promoKind,
				freeShipping: false,
				minimumSubtotal: 0,
				productIds: [],
				affiliateName: '',
				commissionPercentage: 0,
				startDate: '',
				endDate: '',
				active: true,
			},
			...prev,
		]);
		setPromoCodesDirty(true);
	};

	const handleRemovePromo = (index: number) => {
		setPromoCodes((prev) => prev.filter((_, i) => i !== index));
		setPromoCodesDirty(true);
	};

	const handleAddFriendsFamilyEmail = async (event: React.FormEvent<HTMLFormElement>) => {
		event.preventDefault();
		const email = newFriendsFamilyEmail.trim().toLowerCase();
		if (!email) return;
		setFriendsFamilyAdding(true);
		setFriendsFamilyError(null);
		setFriendsFamilyMessage(null);
		try {
			const response = await fetch('/api/dashboard/friends-family', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				credentials: 'include',
				body: JSON.stringify({ email }),
			});
			const data = (await response.json()) as {
				ok?: boolean;
				result?: 'added' | 'reactivated' | 'existing';
				entries?: FriendsFamilyEntry[];
				error?: string;
			};
			if (!response.ok || !data.ok) throw new Error(data.error ?? 'Failed to add email.');
			if (data.entries) setFriendsFamilyEntries(data.entries);
			setNewFriendsFamilyEmail('');
			setFriendsFamilyMessage(data.result === 'existing' ? `${email} is already active.` : data.result === 'reactivated' ? `${email} was reactivated.` : `${email} was added.`);
		} catch (error) {
			setFriendsFamilyError(error instanceof Error ? error.message : 'Failed to add email.');
		} finally {
			setFriendsFamilyAdding(false);
		}
	};

	const handleFriendsFamilyStatusChange = async (email: string, isActive: boolean) => {
		setFriendsFamilyUpdatingEmail(email);
		setFriendsFamilyError(null);
		setFriendsFamilyMessage(null);
		try {
			const response = await fetch('/api/dashboard/friends-family', {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				credentials: 'include',
				body: JSON.stringify({ email, isActive }),
			});
			const data = (await response.json()) as { ok?: boolean; entries?: FriendsFamilyEntry[]; error?: string };
			if (!response.ok || !data.ok) throw new Error(data.error ?? 'Failed to update status.');
			if (data.entries) setFriendsFamilyEntries(data.entries);
			setFriendsFamilyMessage(`${email} is now ${isActive ? 'active' : 'inactive'}.`);
		} catch (error) {
			setFriendsFamilyError(error instanceof Error ? error.message : 'Failed to update status.');
		} finally {
			setFriendsFamilyUpdatingEmail(null);
		}
	};

	const handleFriendsFamilyEdit = async (email: string) => {
		const newEmail = friendsFamilyEditValue.trim().toLowerCase();
		if (!newEmail || newEmail === email) {
			setFriendsFamilyEditingEmail(null);
			return;
		}
		setFriendsFamilyUpdatingEmail(email);
		setFriendsFamilyError(null);
		setFriendsFamilyMessage(null);
		try {
			const response = await fetch('/api/dashboard/friends-family', {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				credentials: 'include',
				body: JSON.stringify({ email, newEmail }),
			});
			const data = (await response.json()) as { ok?: boolean; entries?: FriendsFamilyEntry[]; error?: string };
			if (!response.ok || !data.ok) throw new Error(data.error ?? 'Failed to update email.');
			if (data.entries) setFriendsFamilyEntries(data.entries);
			setFriendsFamilyEditingEmail(null);
			setFriendsFamilyEditValue('');
			setFriendsFamilyMessage(`${email} was changed to ${newEmail}.`);
		} catch (error) {
			setFriendsFamilyError(error instanceof Error ? error.message : 'Failed to update email.');
		} finally {
			setFriendsFamilyUpdatingEmail(null);
		}
	};

	const handleFriendsFamilyDelete = async (email: string) => {
		if (!window.confirm(`Remove ${email} from Friends & Family?`)) return;
		setFriendsFamilyDeletingEmail(email);
		setFriendsFamilyError(null);
		setFriendsFamilyMessage(null);
		try {
			const response = await fetch('/api/dashboard/friends-family', {
				method: 'DELETE',
				headers: { 'Content-Type': 'application/json' },
				credentials: 'include',
				body: JSON.stringify({ email }),
			});
			const data = (await response.json()) as { ok?: boolean; entries?: FriendsFamilyEntry[]; error?: string };
			if (!response.ok || !data.ok) throw new Error(data.error ?? 'Failed to delete email.');
			if (data.entries) setFriendsFamilyEntries(data.entries);
			setFriendsFamilyMessage(`${email} was removed.`);
		} catch (error) {
			setFriendsFamilyError(error instanceof Error ? error.message : 'Failed to delete email.');
		} finally {
			setFriendsFamilyDeletingEmail(null);
		}
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
		const visible = rows
			.map((product, index) => ({ product, index }))
			.filter(({ product }) => {
				if (!query) return true;
				const haystack = `${product.name} ${product.slug} ${product.category} ${product.sku ?? ''} ${product.status ?? ''}`.toLowerCase();
				return haystack.includes(query);
			});

		visible.sort((left, right) => {
			switch (productSort) {
				case 'name-asc':
					return left.product.name.localeCompare(right.product.name);
				case 'stock-desc':
					return right.product.stock - left.product.stock;
				case 'stock-asc':
					return left.product.stock - right.product.stock;
				case 'price-desc':
					return right.product.price - left.product.price;
				case 'price-asc':
					return left.product.price - right.product.price;
				case 'status':
					return String(left.product.status ?? '').localeCompare(String(right.product.status ?? '')) || left.product.name.localeCompare(right.product.name);
				default:
					return left.index - right.index;
			}
		});

		return visible.map(({ product }) => product);
	}, [productSort, rows, searchValue]);

	const visibleOrders = useMemo(() => {
		const query = orderSearchValue.trim().toLowerCase();
		const visible = orders
			.map((order, index) => ({ order, index }))
			.filter(({ order }) => {
				if (!query) return true;
				const customer = order.customer as Record<string, unknown> | undefined;
				const cart = (order.cartItems as Array<Record<string, unknown>> | undefined) ?? [];
				const haystack = [
					order.orderNumber,
					order.id,
					customer?.firstName,
					customer?.lastName,
					customer?.email,
					order.paymentMethod,
					order.paymentStatus,
					order.status,
					...cart.map((item) => item.name),
				]
					.map((value) => String(value ?? '').toLowerCase())
					.join(' ');
				return haystack.includes(query);
			});

		return visible.sort((a, b) => {
			const aDate = Date.parse(String(a.order.createdAt ?? '')) || 0;
			const bDate = Date.parse(String(b.order.createdAt ?? '')) || 0;
			switch (orderSort) {
				case 'newest':
					return bDate - aDate;
				case 'oldest':
					return aDate - bDate;
				case 'total-desc':
					return Number(b.order.total ?? 0) - Number(a.order.total ?? 0);
				case 'total-asc':
					return Number(a.order.total ?? 0) - Number(b.order.total ?? 0);
				case 'customer-asc': {
					const aCustomer = a.order.customer as Record<string, unknown> | undefined;
					const bCustomer = b.order.customer as Record<string, unknown> | undefined;
					const aName = `${String(aCustomer?.firstName ?? '')} ${String(aCustomer?.lastName ?? '')}`;
					const bName = `${String(bCustomer?.firstName ?? '')} ${String(bCustomer?.lastName ?? '')}`;
					return aName.localeCompare(bName);
				}
				default:
					return a.index - b.index;
			}
		});
	}, [orderSearchValue, orderSort, orders]);

	const visiblePromoCodes = useMemo(() => {
		const query = promoSearchValue.trim().toLowerCase();
		const productNames = new Map(rows.map((product) => [product.id, `${product.name} ${product.mg ?? ''}`.toLowerCase()]));
		const visible = promoCodes
			.map((promo, index) => ({ promo, index }))
			.filter(({ promo }) => {
				if (getPromoKind(promo) !== promoKind) return false;
				if (!query) return true;
				const selectedProducts = (promo.productIds ?? []).map((id) => productNames.get(id) ?? '').join(' ');
				const haystack =
					`${promo.code} ${promo.affiliateName ?? ''} ${promo.active ? 'active' : 'inactive'} ${promo.freeShipping ? 'free shipping' : ''} ${selectedProducts}`.toLowerCase();
				return haystack.includes(query);
			});

		return visible.sort((a, b) => {
			switch (promoSort) {
				case 'code-asc':
					return a.promo.code.localeCompare(b.promo.code);
				case 'discount-desc':
					return b.promo.discount - a.promo.discount;
				case 'discount-asc':
					return a.promo.discount - b.promo.discount;
				case 'active-first':
					return Number(b.promo.active) - Number(a.promo.active) || a.promo.code.localeCompare(b.promo.code);
				default:
					return a.index - b.index;
			}
		});
	}, [promoCodes, promoKind, promoSearchValue, promoSort, rows]);

	const promoKindCounts = useMemo(
		() => promoCodes.reduce<Record<PromoCodeKind, number>>((counts, promo) => ({ ...counts, [getPromoKind(promo)]: counts[getPromoKind(promo)] + 1 }), { affiliate: 0, promo: 0, general: 0 }),
		[promoCodes],
	);

	const visibleClients = useMemo(() => {
		const query = clientSearchValue.trim().toLowerCase();
		const visible = clients
			.map((client, index) => ({ client, index }))
			.filter(({ client }) => {
				if (!query) return true;
				return Object.values(client)
					.flatMap((value) => (Array.isArray(value) ? value : [value]))
					.map((value) => String(value ?? '').toLowerCase())
					.some((value) => value.includes(query));
			});

		return visible.sort((a, b) => {
			switch (clientSort) {
				case 'email-asc':
					return String(a.client.email ?? '').localeCompare(String(b.client.email ?? ''));
				case 'name-asc': {
					const aName = `${String(a.client.firstName ?? '')} ${String(a.client.lastName ?? '')}`;
					const bName = `${String(b.client.firstName ?? '')} ${String(b.client.lastName ?? '')}`;
					return aName.localeCompare(bName);
				}
				case 'orders-desc':
					return Number(b.client.ordersCount ?? 0) - Number(a.client.ordersCount ?? 0);
				case 'spent-desc':
					return Number(b.client.totalSpent ?? 0) - Number(a.client.totalSpent ?? 0);
				case 'recent':
					return (Date.parse(String(b.client.lastOrderDate ?? '')) || 0) - (Date.parse(String(a.client.lastOrderDate ?? '')) || 0);
				default:
					return a.index - b.index;
			}
		});
	}, [clientSearchValue, clientSort, clients]);

	const filteredFriendsFamilyEntries = useMemo(() => {
		const query = friendsFamilySearchValue.trim().toLowerCase();
		if (!query) return friendsFamilyEntries;
		return friendsFamilyEntries.filter((entry) => {
			const haystack = `${entry.email} ${entry.isActive ? 'active' : 'inactive'}`.toLowerCase();
			return haystack.includes(query);
		});
	}, [friendsFamilyEntries, friendsFamilySearchValue]);

	const activeFriendsFamilyCount = friendsFamilyEntries.filter((entry) => entry.isActive).length;
	const dashboardUserEmail = dashboardUser?.email?.trim() || 'Signed in';
	const dashboardUserName = [dashboardUser?.name, dashboardUser?.nickname, dashboardUser?.given_name]
		.map((value) => value?.trim())
		.find((value) => value && value.toLowerCase() !== dashboardUserEmail.toLowerCase()) || 'Signed in account';
	const dashboardUserInitial = dashboardUserName.charAt(0).toUpperCase() || 'U';
	const renderProfileAvatar = (className: string) =>
		dashboardUser?.picture && !profileImageFailed ? (
			<img
				src={dashboardUser.picture}
				alt=''
				referrerPolicy='no-referrer'
				onError={() => setProfileImageFailed(true)}
				className={`${className} rounded-full object-cover ring-1 ring-black/10`}
			/>
		) : (
			<span className={`${className} inline-flex items-center justify-center rounded-full bg-eucalyptus-100 font-semibold text-deep-tidal-teal ring-1 ring-black/5`} aria-hidden='true'>
				{dashboardUserInitial}
			</span>
		);
	const activeTabLabel = {
		clients: 'Clients',
		products: 'Products',
		orders: 'Orders',
		promos: 'Discounts',
		affiliates: 'Affiliate Payouts',
		friends_family: 'Friends & Family',
		abandoned_carts: 'Abandoned Carts',
	}[activeTab];
	const isMoreTabActive = ['promos', 'affiliates', 'friends_family', 'abandoned_carts'].includes(activeTab);

	const selectMobileTab = (tab: typeof activeTab) => {
		setActiveTab(tab);
		setIsMobileMenuOpen(false);
		window.scrollTo({ top: 0, behavior: 'smooth' });
	};

	const handleSignOut = async () => {
		await fetch('/api/dashboard/signout', { method: 'POST', credentials: 'include' });
		window.location.href = '/auth/logout?returnTo=/dashboard/login';
	};

	return (
		<div className='min-h-screen bg-[#efefef] pb-[calc(5.5rem+env(safe-area-inset-bottom))] lg:pb-0'>
			<header className='sticky top-0 z-30 border-b border-black/5 bg-white/95 px-4 py-3 shadow-sm backdrop-blur lg:hidden'>
				<div className='mx-auto flex w-full max-w-[1536px] items-center gap-3'>
					<div className='flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#111111] font-bold text-white'>P</div>
					<div className='min-w-0'>
						<p className='text-[11px] font-medium uppercase tracking-[0.14em] text-[#8d8d8d]'>Puretide dashboard</p>
						<h1 className='truncate text-base font-semibold text-[#1f1f1f]'>{activeTabLabel}</h1>
					</div>
					<div className='ml-auto flex min-w-0 items-center gap-2'>
						<div className='hidden min-w-0 text-right sm:block'>
							<p className='max-w-56 truncate text-xs font-medium text-[#4a4a4a]'>{dashboardUserEmail}</p>
						</div>
						{renderProfileAvatar('h-9 w-9 shrink-0 text-sm')}
					</div>
				</div>
			</header>

			<div className='mx-auto w-full max-w-[1536px] px-4 py-4 sm:px-6 sm:py-6 md:py-12'>
				<div className='grid grid-cols-1 lg:grid-cols-[260px_1fr] gap-6'>
					<aside className='hidden rounded-2xl border border-black/5 bg-white p-6 shadow-sm h-fit top-6 lg:block'>
						<div className='flex items-center gap-3 mb-6'>
							<div className='h-10 w-10 rounded-xl bg-[#111111] text-white flex items-center justify-center font-bold'>P</div>
							<div>
								<p className='text-lg font-semibold text-[#1f1f1f]'>Puretide</p>
								<p className='text-xs text-[#8d8d8d] uppercase tracking-wide'>Dashboard</p>
							</div>
						</div>
						<nav className='space-y-2 text-sm text-[#4a4a4a]'>
							<button
								type='button'
								onClick={handleRefreshProductionData}
								disabled={isRefreshingData}
								className='flex w-full items-center gap-3 rounded-xl bg-deep-tidal-teal px-4 py-3 text-left font-medium text-white transition-colors hover:bg-deep-tidal-teal-600 disabled:cursor-wait disabled:opacity-60'>
								<RefreshCw
									className={`h-4 w-4 shrink-0 ${isRefreshingData ? 'animate-spin' : ''}`}
									aria-hidden='true'
								/>
								<span>{isRefreshingData ? 'Refreshing data…' : 'Refresh website data'}</span>
							</button>
							{refreshDataMessage && (
								<p
									role={refreshDataMessage.kind === 'error' ? 'alert' : 'status'}
									className={`rounded-lg px-3 py-2 text-xs ${refreshDataMessage.kind === 'error' ? 'bg-rose-50 text-rose-700' : 'bg-eucalyptus-50 text-deep-tidal-teal'}`}>
									{refreshDataMessage.text}
								</p>
							)}
							<button
								onClick={() => setActiveTab('clients')}
								className={`flex w-full items-center gap-3 rounded-xl px-4 py-3 text-left transition-colors ${
									activeTab === 'clients' ? 'bg-deep-tidal-teal text-white' : 'bg-white border border-black/5 hover:bg-eucalyptus-50'
								}`}>
								<Users
									className='h-4 w-4 shrink-0'
									aria-hidden='true'
								/>
								<span>Clients</span>
							</button>
							<button
								onClick={() => setActiveTab('products')}
								className={`flex w-full items-center gap-3 rounded-xl px-4 py-3 text-left transition-colors ${
									activeTab === 'products' ? 'bg-deep-tidal-teal text-white' : 'bg-white border border-black/5 hover:bg-eucalyptus-50'
								}`}>
								<Package
									className='h-4 w-4 shrink-0'
									aria-hidden='true'
								/>
								<span>Products</span>
							</button>
							<button
								onClick={() => setActiveTab('orders')}
								className={`flex w-full items-center gap-3 rounded-xl px-4 py-3 text-left transition-colors ${
									activeTab === 'orders' ? 'bg-deep-tidal-teal text-white' : 'bg-white border border-black/5 hover:bg-eucalyptus-50'
								}`}>
								<ShoppingBag
									className='h-4 w-4 shrink-0'
									aria-hidden='true'
								/>
								<span>Orders</span>
							</button>
							<button
								onClick={() => setActiveTab('promos')}
								className={`flex w-full items-center gap-3 rounded-xl px-4 py-3 text-left transition-colors ${
									activeTab === 'promos' ? 'bg-deep-tidal-teal text-white' : 'bg-white border border-black/5 hover:bg-eucalyptus-50'
								}`}>
								<BadgePercent
									className='h-4 w-4 shrink-0'
									aria-hidden='true'
								/>
								<span>Discounts</span>
							</button>
							<button
								onClick={() => setActiveTab('affiliates')}
								className={`flex w-full items-center gap-3 rounded-xl px-4 py-3 text-left transition-colors ${
									activeTab === 'affiliates' ? 'bg-deep-tidal-teal text-white' : 'bg-white border border-black/5 hover:bg-eucalyptus-50'
								}`}>
								<HandCoins
									className='h-4 w-4 shrink-0'
									aria-hidden='true'
								/>
								<span>Affiliate Payouts</span>
							</button>

							<button
								onClick={() => setActiveTab('friends_family')}
								className={`flex w-full items-center gap-3 rounded-xl px-4 py-3 text-left transition-colors ${
									activeTab === 'friends_family' ? 'bg-deep-tidal-teal text-white' : 'bg-white border border-black/5 hover:bg-eucalyptus-50'
								}`}>
								<HeartHandshake
									className='h-4 w-4 shrink-0'
									aria-hidden='true'
								/>
								<span>Friends & Family</span>
							</button>
							<button
								onClick={() => setActiveTab('abandoned_carts')}
								className={`flex w-full items-center gap-3 rounded-xl px-4 py-3 text-left transition-colors ${
									activeTab === 'abandoned_carts' ? 'bg-deep-tidal-teal text-white' : 'bg-white border border-black/5 hover:bg-eucalyptus-50'
								}`}>
								<ShoppingCart
									className='h-4 w-4 shrink-0'
									aria-hidden='true'
								/>
								<span>Abandoned Carts</span>
							</button>
						</nav>
						<div className='mt-6 border-t border-black/5 pt-4'>
							<div className='flex min-w-0 items-center gap-3 rounded-xl bg-[#f8f8f9] p-3'>
								{renderProfileAvatar('h-10 w-10 shrink-0 text-sm')}
								<div className='min-w-0 flex-1'>
									<p className='truncate text-sm font-medium text-[#2f2f2f]' title={dashboardUserEmail}>{dashboardUserEmail}</p>
								</div>
								<button
									type='button'
									onClick={handleSignOut}
									className='inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-rose-600 transition-colors hover:bg-rose-50'
									aria-label={`Sign out ${dashboardUserEmail}`}
									title='Sign out'>
									<LogOut className='h-4 w-4' aria-hidden='true' />
								</button>
							</div>
						</div>
					</aside>

					<section className='min-w-0 flex flex-col gap-6'>
						{activeTab === 'abandoned_carts' && <AbandonedCartsPanel />}

						{activeTab === 'friends_family' && (
							<div className='rounded-2xl border border-black/5 bg-white shadow-sm p-6'>
								<div className='mb-5 flex flex-wrap items-start justify-between gap-4'>
									<div>
										<h2 className='text-xl font-semibold text-[#1f1f1f]'>Friends & Family</h2>
										<p className='mt-1 text-sm text-[#7a7a7a]'>Manage the emails eligible for Friends & Family checkout</p>
									</div>
									<form
										onSubmit={handleAddFriendsFamilyEmail}
										className='flex w-full gap-2 sm:w-auto'>
										<input
											type='email'
											value={newFriendsFamilyEmail}
											onChange={(event) => setNewFriendsFamilyEmail(event.target.value)}
											placeholder='name@example.com'
											aria-label='Friends and Family email'
											required
											className='min-w-0 flex-1 rounded-lg border border-black/10 bg-white px-3 py-2 text-sm text-[#2f2f2f] focus:border-deep-tidal-teal focus:outline-none focus:ring-2 focus:ring-deep-tidal-teal/20 sm:w-64'
										/>
										<button
											type='submit'
											disabled={friendsFamilyAdding || !newFriendsFamilyEmail.trim()}
											className='inline-flex shrink-0 items-center gap-2 rounded-lg bg-deep-tidal-teal px-4 py-2 text-sm font-semibold text-white hover:bg-deep-tidal-teal-600 disabled:opacity-50'>
											<UserPlus
												className='h-4 w-4'
												aria-hidden='true'
											/>
											{friendsFamilyAdding ? 'Adding…' : 'Add email'}
										</button>
									</form>
								</div>
								<div className='mb-5 grid grid-cols-3 gap-3'>
									<div className='rounded-xl bg-[#f4f4f7] p-3'>
										<p className='text-xs uppercase text-[#7a7a7a]'>Total</p>
										<p className='text-2xl font-semibold text-[#1f1f1f]'>{friendsFamilyEntries.length}</p>
									</div>
									<div className='rounded-xl bg-[#f4f4f7] p-3'>
										<p className='text-xs uppercase text-[#7a7a7a]'>Active</p>
										<p className='text-2xl font-semibold text-deep-tidal-teal'>{activeFriendsFamilyCount}</p>
									</div>
									<div className='rounded-xl bg-[#f4f4f7] p-3'>
										<p className='text-xs uppercase text-[#7a7a7a]'>Inactive</p>
										<p className='text-2xl font-semibold text-[#6a6a6a]'>{friendsFamilyEntries.length - activeFriendsFamilyCount}</p>
									</div>
								</div>
								{friendsFamilyError && <div className='rounded-lg bg-rose-50 border border-rose-200 px-4 py-3 text-sm text-rose-800 mb-4'>{friendsFamilyError}</div>}
								{friendsFamilyMessage && (
									<div className='mb-4 rounded-lg border border-eucalyptus-300 bg-eucalyptus-50 px-4 py-3 text-sm text-deep-tidal-teal'>{friendsFamilyMessage}</div>
								)}
								<div className='relative mb-4 w-full max-w-sm'>
									<Search
										className='pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#8d8d8d]'
										aria-hidden='true'
									/>
									<input
										type='search'
										value={friendsFamilySearchValue}
										onChange={(event) => setFriendsFamilySearchValue(event.target.value)}
										placeholder='Search email or status…'
										className='w-full rounded-lg border border-black/10 bg-white py-2 pl-9 pr-3 text-sm text-[#2f2f2f] focus:border-deep-tidal-teal focus:outline-none focus:ring-2 focus:ring-deep-tidal-teal/20'
									/>
								</div>
								{friendsFamilyLoading ? (
									<div className='text-[#6a6a6a] py-8'>Loading Friends & Family emails…</div>
								) : friendsFamilyEntries.length === 0 ? (
									<div className='text-[#6a6a6a] py-8'>No Friends & Family emails yet.</div>
								) : filteredFriendsFamilyEntries.length === 0 ? (
									<div className='text-[#6a6a6a] py-8'>No Friends & Family rows match your search.</div>
								) : (
									<div className='overflow-hidden rounded-xl border border-black/5'>
										<table className='w-full table-fixed'>
											<colgroup>
												<col style={{ width: '60%' }} />
												<col style={{ width: '25%' }} />
												<col style={{ width: '15%' }} />
											</colgroup>
											<thead className='bg-[#f4f4f7]'>
												<tr className='text-left text-xs uppercase tracking-wide text-[#9b9b9b]'>
													<th className='px-4 py-3 font-medium'>Email</th>
													<th className='px-4 py-3 font-medium'>Status</th>
													<th className='px-4 py-3 text-right font-medium'>Actions</th>
												</tr>
											</thead>
											<tbody className='divide-y divide-black/5 text-sm text-[#2f2f2f]'>
												{filteredFriendsFamilyEntries.map((entry) => (
													<tr
														key={entry.email}
														className='h-16'>
														<td className='px-4 py-3 font-medium'>
															<div className='flex min-h-10 items-center'>
																{friendsFamilyEditingEmail === entry.email ? (
																	<input
																		type='email'
																		value={friendsFamilyEditValue}
																		onChange={(event) => setFriendsFamilyEditValue(event.target.value)}
																		onKeyDown={(event) => {
																			if (event.key === 'Enter') void handleFriendsFamilyEdit(entry.email);
																			if (event.key === 'Escape') setFriendsFamilyEditingEmail(null);
																		}}
																		disabled={friendsFamilyUpdatingEmail === entry.email}
																		className='w-full max-w-md rounded-lg border border-black/10 px-3 py-2 text-sm font-normal focus:border-deep-tidal-teal focus:outline-none focus:ring-2 focus:ring-deep-tidal-teal/20'
																		autoFocus
																	/>
																) : (
																	entry.email
																)}
															</div>
														</td>
														<td className='px-4 py-3'>
															<select
																value={entry.isActive ? 'active' : 'inactive'}
																onChange={(event) => void handleFriendsFamilyStatusChange(entry.email, event.target.value === 'active')}
																disabled={friendsFamilyUpdatingEmail === entry.email || friendsFamilyDeletingEmail === entry.email}
																aria-label={`Status for ${entry.email}`}
																className={`w-auto rounded-full border border-transparent py-1.5 pl-3 pr-8 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-deep-tidal-teal/20 disabled:opacity-50 ${
																	entry.isActive ? 'bg-eucalyptus-100 text-deep-tidal-teal' : 'bg-gray-100 text-gray-600'
																}`}>
																<option value='active'>Active</option>
																<option value='inactive'>Inactive</option>
															</select>
														</td>
														<td className='px-4 py-3'>
															<div className='flex min-h-10 items-center justify-end gap-1'>
																{friendsFamilyEditingEmail === entry.email ? (
																	<>
																		<button
																			type='button'
																			onClick={() => void handleFriendsFamilyEdit(entry.email)}
																			disabled={friendsFamilyUpdatingEmail === entry.email}
																			className='inline-flex h-9 w-9 items-center justify-center rounded-lg text-deep-tidal-teal hover:bg-eucalyptus-100 disabled:opacity-50'
																			title='Save email'>
																			<Check
																				className='h-4 w-4'
																				aria-hidden='true'
																			/>
																		</button>
																		<button
																			type='button'
																			onClick={() => setFriendsFamilyEditingEmail(null)}
																			className='inline-flex h-9 w-9 items-center justify-center rounded-lg text-[#6a6a6a] hover:bg-[#f4f4f7]'
																			title='Cancel editing'>
																			<X
																				className='h-4 w-4'
																				aria-hidden='true'
																			/>
																		</button>
																	</>
																) : (
																	<button
																		type='button'
																		onClick={() => {
																			setFriendsFamilyEditingEmail(entry.email);
																			setFriendsFamilyEditValue(entry.email);
																		}}
																		className='inline-flex h-9 w-9 items-center justify-center rounded-lg text-deep-tidal-teal hover:bg-eucalyptus-100'
																		title='Edit email'>
																		<Pencil
																			className='h-4 w-4'
																			aria-hidden='true'
																		/>
																	</button>
																)}
																<button
																	type='button'
																	onClick={() => void handleFriendsFamilyDelete(entry.email)}
																	disabled={friendsFamilyDeletingEmail === entry.email || friendsFamilyUpdatingEmail === entry.email}
																	className='inline-flex h-9 w-9 items-center justify-center rounded-lg text-rose-700 hover:bg-rose-50 disabled:opacity-50'
																	title='Delete email'>
																	<Trash2
																		className='h-4 w-4'
																		aria-hidden='true'
																	/>
																</button>
															</div>
														</td>
													</tr>
												))}
											</tbody>
										</table>
									</div>
								)}
							</div>
						)}

						{activeTab === 'orders' && (
							<div className='overflow-hidden rounded-2xl border border-black/5 bg-white shadow-sm'>
								<div className='p-4 md:p-6'>
									<div className='grid items-start gap-4 2xl:grid-cols-[minmax(0,1fr)_auto]'>
										<div>
											<h2 className='text-xl font-semibold text-[#1f1f1f]'>Recent Orders</h2>
											<p className='mt-1 text-sm text-[#7a7a7a]'>{visibleOrders.length} of {orders.length} orders</p>
										</div>
										<div className='grid w-full grid-cols-1 gap-2 sm:grid-cols-[minmax(0,1fr)_auto] 2xl:w-auto 2xl:justify-self-end'>
											<label className='relative block'>
												<Search
													className='pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#8d8d8d]'
													aria-hidden='true'
												/>
												<input
													type='search'
													value={orderSearchValue}
													onChange={(event) => setOrderSearchValue(event.target.value)}
													placeholder='Search orders…'
													aria-label='Search orders'
												className='w-full rounded-lg border border-black/10 bg-white py-2.5 pl-9 pr-3 text-sm text-[#2f2f2f] focus:border-deep-tidal-teal focus:outline-none focus:ring-2 focus:ring-deep-tidal-teal/20 sm:w-64'
												/>
											</label>
											<label className='relative block'>
												<ArrowUpDown
													className='pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#8d8d8d]'
													aria-hidden='true'
												/>
												<select
													value={orderSort}
													onChange={(event) => setOrderSort(event.target.value as OrderSort)}
													aria-label='Sort orders'
												className='w-full rounded-lg border border-black/10 bg-white py-2.5 pl-9 pr-8 text-sm text-[#2f2f2f] focus:border-deep-tidal-teal focus:outline-none focus:ring-2 focus:ring-deep-tidal-teal/20 sm:w-auto'>
													<option value='sheet'>Original order</option>
													<option value='newest'>Newest first</option>
													<option value='oldest'>Oldest first</option>
													<option value='total-desc'>Highest total</option>
													<option value='total-asc'>Lowest total</option>
													<option value='customer-asc'>Customer A–Z</option>
												</select>
											</label>
										</div>
									</div>
									{ordersError && <div className='mt-4 rounded-lg bg-rose-50 border border-rose-200 px-4 py-3 text-sm text-rose-800 mb-4'>{ordersError}</div>}
									{trackingEmailError && <div className='rounded-lg bg-rose-50 border border-rose-200 px-4 py-3 text-sm text-rose-800 mb-4'>{trackingEmailError}</div>}
									{trackingEmailOkMessage && (
										<div className='rounded-lg bg-emerald-50 border border-emerald-200 px-4 py-3 text-sm text-emerald-800 mb-4'>{trackingEmailOkMessage}</div>
									)}
									{orderActionMessage && (
										<div className='rounded-lg bg-emerald-50 border border-emerald-200 px-4 py-3 text-sm text-emerald-800 mb-4'>{orderActionMessage}</div>
									)}
								</div>
								{ordersLoading ? (
									<div className='border-t border-black/5 px-6 py-8 text-[#6a6a6a]'>Loading orders...</div>
								) : orders.length === 0 ? (
									<div className='border-t border-black/5 px-6 py-8 text-[#6a6a6a]'>{ordersError ? 'Could not load orders.' : 'No orders yet.'}</div>
								) : visibleOrders.length === 0 ? (
									<div className='border-t border-black/5 bg-[#f4f4f7] px-6 py-8 text-center text-sm text-[#6a6a6a]'>No orders match your search.</div>
								) : (
									<>
										<div className='grid items-start gap-3 border-t border-black/5 bg-[#f4f4f7] p-3 md:grid-cols-2 md:p-4 lg:hidden'>
											{visibleOrders.slice(0, 50).map(({ order }) => {
												const customer = order.customer as Record<string, string> | undefined;
												const cart = (order.cartItems as Array<Record<string, unknown>>) ?? [];
												const date = order.createdAt ? new Date(String(order.createdAt)).toLocaleDateString() : '-';
												const productItems = cart.map((item) => `${String(item.name ?? 'Item')}${Number(item.quantity ?? 1) > 1 ? ` ×${item.quantity}` : ''}`);
												const products = formatCompactList(productItems, 2);
												const payment = order.paymentMethod === 'creditcard' ? 'Card' : order.paymentMethod === 'etransfer' ? 'E-Transfer' : String(order.paymentMethod ?? '-');
												const orderNumber = String(order.orderNumber ?? order.id ?? '-');
												const customerName = customer ? `${customer.firstName ?? ''} ${customer.lastName ?? ''}`.trim() : '';
												const paymentStatus = String(order.paymentStatus ?? order.status ?? '').trim();
												const isManualEtransfer =
													order.paymentMethod === 'etransfer' &&
													(order.paymentPath === 'manual' || order.paymentPath === 'manual_friends_family');
												const canFulfill = isManualEtransfer && order.paymentStatus === 'pending';
												const isFulfilled = isManualEtransfer && order.paymentStatus === 'paid';

												return (
													<article key={String(order.id)} className='overflow-hidden rounded-2xl border border-black/10 bg-white shadow-[0_1px_2px_rgba(0,0,0,0.04)]'>
														<div className='p-4'>
															<div className='flex items-start justify-between gap-3'>
																<div className='min-w-0'>
																	<p className='text-[10px] font-semibold uppercase tracking-wide text-[#7a7a7a]'>Order</p>
																	<h3 className='truncate text-base font-semibold text-[#1f1f1f]'>#{orderNumber}</h3>
																</div>
																<p className='shrink-0 text-lg font-semibold text-deep-tidal-teal'>${Number(order.total ?? 0).toFixed(2)}</p>
															</div>

															<div className='mt-4 rounded-xl bg-[#f4f4f7] p-3'>
																<p className='truncate text-sm font-semibold text-[#2f2f2f]'>{customerName || 'Unknown customer'}</p>
																<p className='truncate text-xs text-[#7a7a7a]'>{customer?.email || 'No email'}</p>
															</div>

															<dl className='mt-3 grid grid-cols-2 gap-x-4 gap-y-3 text-sm'>
																<div><dt className='text-xs text-[#7a7a7a]'>Date</dt><dd className='mt-0.5 font-medium text-[#2f2f2f]'>{date}</dd></div>
																<div><dt className='text-xs text-[#7a7a7a]'>Payment</dt><dd className='mt-0.5 font-medium text-[#2f2f2f]'>{payment}</dd></div>
																<div className='col-span-2'>
																	<dt className='text-xs text-[#7a7a7a]'>Products</dt>
																	<dd className='mt-0.5 text-[#2f2f2f]'>{products || '-'}</dd>
																</div>
															</dl>
															{paymentStatus && <span className='mt-3 inline-flex rounded-full bg-eucalyptus-50 px-2.5 py-1 text-xs font-semibold capitalize text-deep-tidal-teal'>{paymentStatus.replace(/_/g, ' ')}</span>}
														</div>

														<div className='flex gap-2 border-t border-black/5 bg-[#fafafa] p-3'>
															{isManualEtransfer && (
																<button type='button' onClick={() => handleCompleteFriendsFamilyOrder(orderNumber)} disabled={!canFulfill || completingOrderNumber !== null || orderNumber === '-'} className='inline-flex min-h-10 flex-1 items-center justify-center gap-2 rounded-xl border border-eucalyptus-300 bg-white px-3 text-sm font-semibold text-deep-tidal-teal disabled:cursor-default disabled:opacity-55'>
																	<CircleCheckBig className='h-4 w-4' aria-hidden='true' />
																	{completingOrderNumber === orderNumber ? 'Working…' : isFulfilled ? 'Fulfilled' : 'Fulfill'}
																</button>
															)}
															<button type='button' onClick={() => handleSendTrackingEmail(orderNumber)} disabled={trackingEmailLoading || orderNumber === '-'} className='inline-flex min-h-10 flex-1 items-center justify-center gap-2 rounded-xl bg-deep-tidal-teal px-3 text-sm font-semibold text-white disabled:opacity-50'>
																<Send className='h-4 w-4' aria-hidden='true' />
																{trackingEmailLoading ? 'Sending…' : 'Tracking email'}
															</button>
														</div>
													</article>
												);
											})}
										</div>

										<div className='hidden overflow-x-auto border-t border-black/5 lg:block'>
										<table className='w-full min-w-[640px]'>
											<thead className='bg-[#f4f4f7]'>
												<tr className='text-left text-xs uppercase tracking-wide text-[#9b9b9b]'>
													<th className='py-3 pl-6 pr-6 font-medium'>Order #</th>
													<th className='py-3 pr-6 font-medium'>Customer</th>
													<th className='py-3 pr-6 font-medium'>Products</th>
													<th className='py-3 pr-6 font-medium'>Date</th>
													<th className='whitespace-nowrap py-3 pr-6 font-medium'>Payment</th>
													<th className='py-3 pr-2 text-right font-medium'>Actions</th>
													<th className='py-3 pl-6 pr-6 text-right font-medium'>Total</th>
												</tr>
											</thead>
											<tbody className='text-sm text-[#2f2f2f]'>
												{visibleOrders.slice(0, 50).map(({ order }) => {
													const c = order.customer as Record<string, string> | undefined;
													const cart = (order.cartItems as Array<Record<string, unknown>>) ?? [];
													const date = order.createdAt ? new Date(String(order.createdAt)).toLocaleDateString() : '-';
													const products = cart
														.map((item) => `${String(item.name ?? 'Item')}${Number(item.quantity ?? 1) > 1 ? ` ×${item.quantity}` : ''}`)
														.join(', ');
													const payment =
														order.paymentMethod === 'creditcard'
															? 'Card'
															: order.paymentMethod === 'etransfer'
																? 'E-Transfer'
																: String(order.paymentMethod ?? '-');
													const orderNumber = String(order.orderNumber ?? order.id ?? '-');
													const isPendingManualEtransfer =
														order.paymentMethod === 'etransfer' &&
														(order.paymentPath === 'manual' || order.paymentPath === 'manual_friends_family') &&
														order.paymentStatus === 'pending';
													return (
														<tr
															key={String(order.id)}
															className='border-t border-black/5'>
															<td className='py-4 pl-6 pr-6 font-medium'>{orderNumber}</td>
															<td className='py-4 pr-6'>{c ? `${c.firstName} ${c.lastName}` : '-'}</td>
															<td className='py-4 pr-6 break-words text-[#6a6a6a]'>{products || '-'}</td>
															<td className='py-4 pr-6'>{date}</td>
															<td className='py-4 pr-6 whitespace-nowrap'>{payment}</td>
															<td className='py-4 pr-2'>
																<div className='flex items-center justify-end gap-3'>
																	{isPendingManualEtransfer && (
																		<button
																			type='button'
																			onClick={() => handleCompleteFriendsFamilyOrder(orderNumber)}
																			disabled={completingOrderNumber !== null || orderNumber === '-'}
																			className='group inline-flex items-center gap-1 text-[11px] font-semibold leading-none text-deep-tidal-teal hover:text-deep-tidal-teal-600 disabled:opacity-50'
																			title='Mark paid and fulfill'>
																			<span className='inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-eucalyptus-300 bg-white transition-colors group-hover:bg-eucalyptus-50'>
																				<CircleCheckBig
																					className='h-4 w-4'
																					aria-hidden='true'
																				/>
																			</span>
																			<span>{completingOrderNumber === orderNumber ? 'Working…' : 'Fulfill'}</span>
																		</button>
																	)}
																	<button
																		type='button'
																		onClick={() => handleSendTrackingEmail(orderNumber)}
																		disabled={trackingEmailLoading || orderNumber === '-'}
																		className='group inline-flex items-center gap-1 text-[11px] font-semibold leading-none text-deep-tidal-teal hover:text-deep-tidal-teal-600 disabled:opacity-50'
																		title='Send tracking email'>
																		<span className='inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-deep-tidal-teal-100 bg-white transition-colors group-hover:bg-deep-tidal-teal-50'>
																			<Send
																				className='h-4 w-4'
																				aria-hidden='true'
																			/>
																		</span>
																		<span>{trackingEmailLoading ? 'Sending…' : 'Tracking'}</span>
																	</button>
																</div>
															</td>
															<td className='whitespace-nowrap py-4 pl-4 pr-6 text-right'>${Number(order.total ?? 0).toFixed(2)}</td>
														</tr>
													);
												})}
											</tbody>
										</table>
										</div>
									</>
								)}
							</div>
						)}

						{activeTab === 'promos' && (
							<div className='overflow-hidden rounded-2xl border border-black/5 bg-white shadow-sm'>
								<div className='p-5 sm:p-6'>
									<div className='grid items-start gap-4 2xl:grid-cols-[minmax(0,1fr)_auto]'>
										<div className='min-w-0'>
											<h2 className='text-xl font-semibold text-[#1f1f1f]'>Discount codes</h2>
											<p className='mt-1 text-sm text-[#6a6a6a]'>Manage each type separately to keep campaigns focused and easy to track</p>
										</div>
										<div className='flex w-full flex-col items-start gap-2 2xl:w-auto 2xl:items-end 2xl:justify-self-end'>
											<div className='flex flex-wrap items-center justify-start gap-2 2xl:justify-end'>
												<label className='relative'>
													<Search
														className='pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#8d8d8d]'
														aria-hidden='true'
													/>
													<input
														type='search'
														value={promoSearchValue}
														onChange={(event) => setPromoSearchValue(event.target.value)}
														placeholder={`Search ${PROMO_KIND_DETAILS[promoKind].label.toLowerCase()}…`}
														aria-label='Search discount codes'
														className='w-56 rounded-lg border border-black/10 bg-white py-2 pl-9 pr-3 text-sm text-[#2f2f2f] focus:border-deep-tidal-teal focus:outline-none focus:ring-2 focus:ring-deep-tidal-teal/20'
													/>
												</label>
												<label className='relative'>
													<ArrowUpDown
														className='pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#8d8d8d]'
														aria-hidden='true'
													/>
													<select
														value={promoSort}
														onChange={(event) => setPromoSort(event.target.value as PromoSort)}
														aria-label='Sort discount codes'
														className='rounded-lg border border-black/10 bg-white py-2 pl-9 pr-8 text-sm text-[#2f2f2f] focus:border-deep-tidal-teal focus:outline-none focus:ring-2 focus:ring-deep-tidal-teal/20'>
														<option value='sheet'>Spreadsheet order</option>
														<option value='code-asc'>Code A–Z</option>
														<option value='discount-desc'>Highest discount</option>
														<option value='discount-asc'>Lowest discount</option>
														<option value='active-first'>Active first</option>
													</select>
												</label>
											</div>
										</div>
									</div>
								</div>

								<div className='border-t border-deep-tidal-teal/25 bg-white'>
									<div className='bg-[#f4f4f7] p-4 2xl:hidden'>
										<label className='block'>
											<span className='mb-1.5 block text-xs font-semibold uppercase tracking-wide text-[#777]'>Discount type</span>
											<select
												value={promoKind}
												onChange={(event) => setPromoKind(event.target.value as PromoCodeKind)}
												aria-label='Select discount code type'
												className='w-full rounded-lg border border-black/10 bg-white px-3 py-2.5 text-sm font-semibold text-[#2f2f2f] focus:border-deep-tidal-teal focus:outline-none focus:ring-2 focus:ring-deep-tidal-teal/20'>
												{(['affiliate', 'promo', 'general'] as const).map((kind) => (
													<option
														key={kind}
														value={kind}>
														{PROMO_KIND_DETAILS[kind].label} ({promoKindCounts[kind]})
													</option>
												))}
											</select>
										</label>
									</div>
									<div className='hidden bg-white px-5 py-4 2xl:block'>
										<div
											className='inline-flex items-center gap-1 rounded-xl bg-[#f1f1f3] p-1'
											role='tablist'
											aria-label='Discount code types'>
											{(['affiliate', 'promo', 'general'] as const).map((kind) => {
												const selected = promoKind === kind;
												const label = kind === 'affiliate' ? 'Affiliates' : kind === 'promo' ? 'Campaigns' : 'General';
												return (
													<button
														key={kind}
														type='button'
														role='tab'
														aria-selected={selected}
														onClick={() => setPromoKind(kind)}
														className={`inline-flex items-center gap-2 rounded-lg px-3.5 py-2 text-sm font-semibold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-deep-tidal-teal/30 ${
															selected
																? 'bg-white text-deep-tidal-teal shadow-sm ring-1 ring-black/5'
																: 'text-[#626262] hover:bg-white/60 hover:text-[#303030]'
														}`}>
														{kind === 'affiliate' ? (
															<HandCoins
																className='h-4 w-4'
																aria-hidden='true'
															/>
														) : kind === 'promo' ? (
															<Megaphone
																className='h-4 w-4'
																aria-hidden='true'
															/>
														) : (
															<Tag
																className='h-4 w-4'
																aria-hidden='true'
															/>
														)}
														<span>{label}</span>
														<span className={`rounded-full px-1.5 py-0.5 text-[11px] leading-none ${selected ? 'bg-eucalyptus-100' : 'bg-black/5'}`}>
															{promoKindCounts[kind]}
														</span>
													</button>
												);
											})}
										</div>
										<p className='mt-2 pl-1 text-sm text-[#777]'>{PROMO_KIND_DETAILS[promoKind].description}</p>
									</div>
									<div className='flex flex-wrap items-center justify-start gap-2 px-4 py-3 sm:px-5 2xl:justify-end'>
										<button
											type='button'
											onClick={handleAddPromo}
											className='rounded-lg bg-deep-tidal-teal px-4 py-2 text-sm font-semibold text-white hover:bg-deep-tidal-teal-600'>
											+ Add {PROMO_KIND_DETAILS[promoKind].shortLabel}
										</button>
										<button
											type='button'
											onClick={handleSavePromos}
											disabled={!promoCodesDirty}
											className='rounded-lg bg-[#111111] px-4 py-2 text-sm font-semibold text-white disabled:bg-[#bdbdbd]'>
											Save changes
										</button>
									</div>

									<div className='p-4 sm:p-5'>
										{(promoCodesError || savePromosError) && (
											<div className='rounded-lg bg-rose-50 border border-rose-200 px-4 py-3 text-sm text-rose-800 mb-4'>{promoCodesError ?? savePromosError}</div>
										)}
										{promoCodesLoading ? (
											<div className='text-[#6a6a6a] py-8'>Loading promo codes...</div>
										) : (
											<div className='-mx-4 divide-y divide-black/10 sm:-mx-5'>
												{visiblePromoCodes.length === 0 && (
													<div className='mx-4 rounded-xl border border-dashed border-black/10 bg-[#fafafa] px-4 py-10 text-center sm:mx-5'>
														<p className='text-sm font-medium text-[#454545]'>
															No {PROMO_KIND_DETAILS[promoKind].label.toLowerCase()} {promoSearchValue ? 'match your search' : 'yet'}.
														</p>
														{!promoSearchValue && <p className='mt-1 text-xs text-[#777]'>Use the add button above to create one.</p>}
													</div>
												)}
												{visiblePromoCodes.map(({ promo, index: i }) => (
													<div
														key={i}
														className='px-4 py-5 first:pt-0 last:pb-0 sm:px-5'>
														<div className='mb-4 flex flex-wrap items-center justify-between gap-3 border-b border-black/5 pb-3'>
															<div className='flex min-w-0 items-center gap-2'>
																<span
																	className={`h-2 w-2 shrink-0 rounded-full ${promo.active ? 'bg-emerald-500' : 'bg-gray-400'}`}
																	aria-hidden='true'
																/>
																<p className='truncate text-sm font-semibold text-[#252525]'>
																	{promo.code || `New ${PROMO_KIND_DETAILS[promoKind].shortLabel}`}
																</p>
															</div>
															<div className='flex items-center gap-2'>
																<select
																	value={promo.active ? 'active' : 'inactive'}
																	onChange={(event) => handlePromoChange(i, 'active', event.target.value === 'active')}
																	aria-label={`Status for discount code ${promo.code || i + 1}`}
																	className={`rounded-full border border-transparent py-1.5 pl-3 pr-8 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-deep-tidal-teal/20 ${
																		promo.active ? 'bg-eucalyptus-100 text-deep-tidal-teal' : 'bg-gray-200 text-gray-600'
																	}`}>
																	<option value='active'>Live</option>
																	<option value='inactive'>Inactive</option>
																</select>
																<button
																	type='button'
																	onClick={() => handleRemovePromo(i)}
																	className='inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-rose-700 hover:bg-rose-50'>
																	<Trash2
																		className='h-3.5 w-3.5'
																		aria-hidden='true'
																	/>
																	Remove
																</button>
															</div>
														</div>

														<div className='grid gap-4 sm:grid-cols-2 xl:grid-cols-4'>
															<label className='block'>
																<span className='mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-[#777]'>Code</span>
																<input
																	type='text'
																	value={promo.code}
																	onChange={(event) => handlePromoChange(i, 'code', event.target.value.toUpperCase())}
																	placeholder='CODE'
																	className='w-full rounded-lg border border-black/10 bg-white px-3 py-2 text-sm font-mono focus:border-deep-tidal-teal focus:outline-none'
																/>
															</label>
															<label className='block'>
																<span className='mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-[#777]'>Discount</span>
																<span className='relative block'>
																	<input
																		type='number'
																		min={0}
																		max={100}
																		value={promo.discount}
																		onChange={(event) => handlePromoChange(i, 'discount', Number(event.target.value) || 0)}
																		className='w-full rounded-lg border border-black/10 bg-white py-2 pl-3 pr-8 text-sm focus:border-deep-tidal-teal focus:outline-none'
																	/>
																	<span className='pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm text-[#6a6a6a]'>%</span>
																</span>
															</label>
															<div>
																<span className='mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-[#777]'>Products</span>
																<details className='group relative w-full text-sm'>
																	<summary className='flex cursor-pointer list-none items-center justify-between gap-2 rounded border border-black/10 bg-white px-3 py-2 text-[#2f2f2f] [&::-webkit-details-marker]:hidden'>
																		<span>{promo.productIds?.length ? `${promo.productIds.length} selected` : 'All products'}</span>
																		<ChevronDown
																			className='h-4 w-4 text-[#6a6a6a] transition-transform group-open:rotate-180'
																			aria-hidden='true'
																		/>
																	</summary>
																	<div className='absolute left-0 top-full z-20 mt-2 max-h-64 w-64 overflow-y-auto rounded-lg border border-black/10 bg-white p-2 shadow-lg'>
																		<p className='px-2 pb-2 text-xs text-[#6a6a6a]'>No selection applies the code to every product.</p>
																		{rows.map((product) => (
																			<label
																				key={product.id}
																				className='flex cursor-pointer items-center gap-2 rounded px-2 py-2 hover:bg-eucalyptus-50'>
																				<input
																					type='checkbox'
																					checked={(promo.productIds ?? []).includes(product.id)}
																					onChange={(event) => handlePromoProductToggle(i, product.id, event.target.checked)}
																					className='accent-deep-tidal-teal'
																				/>
																				<span className='truncate'>
																					{product.name}
																					{product.mg ? ` – ${product.mg}` : ''}
																				</span>
																			</label>
																		))}
																	</div>
																</details>
															</div>
															<label className='block'>
																<span className='mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-[#777]'>Minimum order</span>
																<span className='relative block'>
																	<span className='pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm text-[#6a6a6a]'>$</span>
																	<input
																		type='number'
																		min={0}
																		step='0.01'
																		value={promo.minimumSubtotal ?? 0}
																		onChange={(event) => handlePromoChange(i, 'minimumSubtotal', Number(event.target.value) || 0)}
																		className='w-full rounded-lg border border-black/10 bg-white py-2 pl-7 pr-3 text-sm focus:border-deep-tidal-teal focus:outline-none'
																	/>
																</span>
															</label>

															{promoKind === 'affiliate' && (
																<>
																	<label className='block'>
																		<span className='mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-[#777]'>
																			Affiliate name
																		</span>
																		<input
																			type='text'
																			value={promo.affiliateName ?? ''}
																			onChange={(event) => handlePromoChange(i, 'affiliateName', event.target.value)}
																			placeholder='Name or partner'
																			className='w-full rounded-lg border border-black/10 bg-white px-3 py-2 text-sm focus:border-deep-tidal-teal focus:outline-none'
																		/>
																	</label>
																	<label className='block'>
																		<span className='mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-[#777]'>Commission</span>
																		<span className='relative block'>
																			<input
																				type='number'
																				min={0}
																				max={100}
																				step='0.01'
																				value={promo.commissionPercentage ?? 0}
																				onChange={(event) => handlePromoChange(i, 'commissionPercentage', Number(event.target.value) || 0)}
																				className='w-full rounded-lg border border-black/10 bg-white py-2 pl-3 pr-8 text-sm focus:border-deep-tidal-teal focus:outline-none'
																			/>
																			<span className='pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm text-[#6a6a6a]'>
																				%
																			</span>
																		</span>
																	</label>
																</>
															)}

															{promoKind !== 'general' && (
																<>
																	<label className='block'>
																		<span className='mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-[#777]'>Starts</span>
																		<input
																			type='date'
																			value={promo.startDate ?? ''}
																			onChange={(event) => handlePromoChange(i, 'startDate', event.target.value)}
																			className='w-full rounded-lg border border-black/10 bg-white px-3 py-2 text-sm focus:border-deep-tidal-teal focus:outline-none'
																		/>
																	</label>
																	<label className='block'>
																		<span className='mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-[#777]'>Ends</span>
																		<input
																			type='date'
																			value={promo.endDate ?? ''}
																			onChange={(event) => handlePromoChange(i, 'endDate', event.target.value)}
																			className='w-full rounded-lg border border-black/10 bg-white px-3 py-2 text-sm focus:border-deep-tidal-teal focus:outline-none'
																		/>
																	</label>
																</>
															)}

															<div>
																<span className='mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-[#777]'>Shipping</span>
																<label className='flex min-h-[38px] cursor-pointer items-center gap-2 rounded-lg border border-black/10 bg-white px-3 py-2 text-sm'>
																	<input
																		type='checkbox'
																		checked={Boolean(promo.freeShipping)}
																		onChange={(event) => handlePromoChange(i, 'freeShipping', event.target.checked)}
																		className='accent-deep-tidal-teal'
																	/>
																	Free shipping
																</label>
															</div>
														</div>
													</div>
												))}
											</div>
										)}
									</div>
								</div>
							</div>
						)}

						{activeTab === 'affiliates' && <AffiliatesPanel />}

						{activeTab === 'clients' && (
							<div className='rounded-2xl border border-black/5 bg-white p-4 shadow-sm md:p-6'>
								<div className='mb-5 grid items-start gap-4 2xl:grid-cols-[minmax(0,1fr)_auto]'>
									<div>
										<h2 className='text-xl font-semibold text-[#1f1f1f]'>Clients</h2>
										<p className='mt-1 text-sm text-[#7a7a7a]'>{visibleClients.length} of {clients.length} clients</p>
									</div>
									<div className='grid w-full grid-cols-1 gap-2 sm:grid-cols-[minmax(0,1fr)_auto] 2xl:w-auto 2xl:justify-self-end'>
										<label className='relative block'>
											<Search
												className='pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#8d8d8d]'
												aria-hidden='true'
											/>
											<input
												type='search'
												value={clientSearchValue}
												onChange={(event) => setClientSearchValue(event.target.value)}
												placeholder='Search clients…'
												aria-label='Search clients'
												className='w-full rounded-lg border border-black/10 bg-white py-2.5 pl-9 pr-3 text-sm text-[#2f2f2f] focus:border-deep-tidal-teal focus:outline-none focus:ring-2 focus:ring-deep-tidal-teal/20 sm:w-64'
											/>
										</label>
										<label className='relative block'>
											<ArrowUpDown
												className='pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#8d8d8d]'
												aria-hidden='true'
											/>
											<select
												value={clientSort}
												onChange={(event) => setClientSort(event.target.value as ClientSort)}
												aria-label='Sort clients'
												className='w-full rounded-lg border border-black/10 bg-white py-2.5 pl-9 pr-8 text-sm text-[#2f2f2f] focus:border-deep-tidal-teal focus:outline-none focus:ring-2 focus:ring-deep-tidal-teal/20 sm:w-auto'>
												<option value='sheet'>Spreadsheet order</option>
												<option value='email-asc'>Email A–Z</option>
												<option value='name-asc'>Name A–Z</option>
												<option value='orders-desc'>Most orders</option>
												<option value='spent-desc'>Highest spending</option>
												<option value='recent'>Most recent order</option>
											</select>
										</label>
									</div>
								</div>

								{surveyAnalytics && (
									<details className='group mb-6 overflow-hidden rounded-xl border border-black/10 bg-white'>
										<summary className='flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 hover:bg-[#f4f4f7] [&::-webkit-details-marker]:hidden'>
											<div className='flex items-center gap-3'>
												<span className='inline-flex h-9 w-9 items-center justify-center rounded-lg bg-eucalyptus-100 text-deep-tidal-teal'>
													<BarChart3
														className='h-5 w-5'
														aria-hidden='true'
													/>
												</span>
												<div>
													<p className='text-sm font-semibold text-[#2f2f2f]'>Client insights</p>
													<p className='text-xs text-[#7a7a7a]'>Survey and acquisition statistics</p>
												</div>
											</div>
											<ChevronDown
												className='h-4 w-4 text-[#7a7a7a] transition-transform group-open:rotate-180'
												aria-hidden='true'
											/>
										</summary>
										<div className='grid grid-cols-2 gap-3 border-t border-black/5 p-4 md:grid-cols-3 xl:grid-cols-6'>
											<div className='rounded-xl bg-[#f4f4f7] p-3'>
												<p className='text-xs uppercase text-[#7a7a7a]'>Total clients</p>
												<p className='text-2xl font-semibold text-[#1f1f1f]'>{surveyAnalytics.totalClients}</p>
											</div>
											<div className='rounded-xl bg-[#f4f4f7] p-3'>
												<p className='text-xs uppercase text-[#7a7a7a]'>Survey responses</p>
												<p className='text-2xl font-semibold text-[#1f1f1f]'>
													{surveyAnalytics.withSurveyData}{' '}
													<span className='text-sm font-medium text-[#7a7a7a]'>
														({Math.round((surveyAnalytics.withSurveyData / surveyAnalytics.totalClients) * 100)}%)
													</span>
												</p>
											</div>
											{Object.entries(surveyAnalytics.sources)
												.sort(([, a], [, b]) => b - a)
												.map(([source, count]) => (
													<div
														key={source}
														className='rounded-xl bg-[#f4f4f7] p-3'>
														<p
															className='truncate text-xs uppercase text-[#7a7a7a]'
															title={source}>
															{source}
														</p>
														<p className='text-2xl font-semibold text-[#1f1f1f]'>
															{count} <span className='text-sm font-medium text-[#7a7a7a]'>({surveyAnalytics.sourcePercentages[source]}%)</span>
														</p>
													</div>
												))}
										</div>
									</details>
								)}

								{clientsError && <div className='rounded-lg bg-rose-50 border border-rose-200 px-4 py-3 text-sm text-rose-800 mb-4'>{clientsError}</div>}
								{clientsLoading ? (
									<div className='text-[#6a6a6a] py-8'>Loading clients...</div>
								) : clients.length === 0 ? (
									<div className='text-[#6a6a6a] py-8'>No clients yet.</div>
								) : visibleClients.length === 0 ? (
									<div className='rounded-lg bg-[#f4f4f7] px-4 py-8 text-center text-sm text-[#6a6a6a]'>No clients match your search.</div>
								) : (
									<>
										<div className='grid items-start gap-3 md:grid-cols-2 lg:hidden'>
											{visibleClients.map(({ client, index: i }) => {
												const firstName = String(client.firstName ?? '').trim();
												const lastName = String(client.lastName ?? '').trim();
												const email = String(client.email ?? '').trim();
												const displayName = `${firstName} ${lastName}`.trim() || email || 'Unnamed client';
												const initials = `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase() || email.charAt(0).toUpperCase() || '?';
												const address = [client.address, client.city, client.province, client.zipCode]
													.map((value) => String(value ?? '').trim())
													.filter(Boolean)
													.join(', ');
												const productItems = Array.isArray(client.products) ? client.products : String(client.products ?? '').split(',');
												const products = formatCompactList(productItems, 2);
												const discounts = formatCompactList(String(client.discount ?? '').split(';'), 1, '; ');
												const acquisition = String(client.howDidYouHear ?? '').trim();

												return (
													<article key={email || i} className='overflow-hidden rounded-2xl border border-black/10 bg-white shadow-[0_1px_2px_rgba(0,0,0,0.04)]'>
														<div className='p-4'>
															<div className='flex min-w-0 items-start gap-3'>
																<div className='flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-eucalyptus-100 text-sm font-bold text-deep-tidal-teal'>
																	{initials}
																</div>
																<div className='min-w-0 flex-1'>
																	<h3 className='truncate font-semibold text-[#1f1f1f]'>{displayName}</h3>
																	{email ? (
																		<a href={`mailto:${email}`} className='block truncate text-sm text-deep-tidal-teal underline-offset-2 hover:underline'>{email}</a>
																	) : (
																		<p className='text-sm text-[#8a8a8a]'>No email</p>
																	)}
																</div>
															</div>

															<div className='mt-4 grid grid-cols-2 gap-2'>
																<div className='rounded-xl bg-[#f4f4f7] px-3 py-2.5'>
																	<p className='text-[10px] font-semibold uppercase tracking-wide text-[#7a7a7a]'>Orders</p>
																	<p className='mt-0.5 text-lg font-semibold text-[#1f1f1f]'>{Number(client.ordersCount ?? 0)}</p>
																</div>
																<div className='rounded-xl bg-eucalyptus-50 px-3 py-2.5'>
																	<p className='text-[10px] font-semibold uppercase tracking-wide text-deep-tidal-teal/70'>Total spent</p>
																	<p className='mt-0.5 text-lg font-semibold text-deep-tidal-teal'>${Number(client.totalSpent ?? 0).toFixed(2)}</p>
																</div>
															</div>

															<div className='mt-3 flex items-center justify-between gap-3 text-xs'>
																<span className='text-[#7a7a7a]'>Last order</span>
																<span className='truncate font-medium text-[#3a3a3a]'>{String(client.lastOrderDate ?? '-')}</span>
															</div>
														</div>

														<details className='group border-t border-black/5'>
															<summary className='flex min-h-12 cursor-pointer list-none items-center justify-between px-4 py-3 text-sm font-semibold text-deep-tidal-teal [&::-webkit-details-marker]:hidden'>
																Client details
																<ChevronDown className='h-4 w-4 transition-transform group-open:rotate-180' aria-hidden='true' />
															</summary>
															<dl className='space-y-3 border-t border-black/5 bg-[#fafafa] px-4 py-4 text-sm'>
																<div>
																	<dt className='text-xs font-medium text-[#7a7a7a]'>Address</dt>
																	<dd className='mt-0.5 text-[#2f2f2f]'>{address || '-'}</dd>
																</div>
																<div>
																	<dt className='text-xs font-medium text-[#7a7a7a]'>Products</dt>
																	<dd className='mt-0.5 break-words text-[#2f2f2f]'>{products || '-'}</dd>
																</div>
																<div className='grid grid-cols-2 gap-3'>
																	<div>
																		<dt className='text-xs font-medium text-[#7a7a7a]'>Acquisition</dt>
																			<dd className='mt-0.5 text-[#2f2f2f]'>{acquisition || '-'}</dd>
																	</div>
																	<div>
																		<dt className='text-xs font-medium text-[#7a7a7a]'>Discount</dt>
																			<dd className='mt-0.5 text-[#2f2f2f]'>{discounts || '-'}</dd>
																	</div>
																</div>
															</dl>
														</details>
													</article>
												);
											})}
										</div>

										<div className='hidden overflow-x-auto rounded-xl border border-black/5 lg:block'>
											<table className='w-full min-w-[1900px] table-fixed'>
											<colgroup>
												<col style={{ width: 220 }} />
												<col style={{ width: 120 }} />
												<col style={{ width: 120 }} />
												<col style={{ width: 220 }} />
												<col style={{ width: 120 }} />
												<col style={{ width: 100 }} />
												<col style={{ width: 90 }} />
												<col style={{ width: 80 }} />
												<col style={{ width: 110 }} />
												<col style={{ width: 130 }} />
												<col style={{ width: 260 }} />
												<col style={{ width: 180 }} />
												<col style={{ width: 150 }} />
											</colgroup>
											<thead className='bg-[#f4f4f7]'>
												<tr className='text-left text-xs uppercase tracking-wide text-[#8d8d8d]'>
													<th className='px-3 py-3 font-medium'>Email</th>
													<th className='px-3 py-3 font-medium'>First Name</th>
													<th className='px-3 py-3 font-medium'>Last Name</th>
													<th className='px-3 py-3 font-medium'>Address</th>
													<th className='px-3 py-3 font-medium'>City</th>
													<th className='px-3 py-3 font-medium'>Province</th>
													<th className='px-3 py-3 font-medium'>Zip</th>
													<th className='px-3 py-3 text-right font-medium'>Orders</th>
													<th className='px-3 py-3 text-right font-medium'>Total Spent</th>
													<th className='px-3 py-3 font-medium'>Last Order</th>
													<th className='px-3 py-3 font-medium'>Products</th>
													<th className='px-3 py-3 font-medium'>How Did You Hear</th>
													<th className='px-3 py-3 font-medium'>Discount</th>
												</tr>
											</thead>
											<tbody className='divide-y divide-black/5 text-sm text-[#2f2f2f]'>
												{visibleClients.map(({ client, index: i }) => (
													<tr key={String(client.email ?? i)}>
														<td className='px-3 py-4 font-medium'>{String(client.email ?? '-')}</td>
														<td className='px-3 py-4'>{String(client.firstName ?? '-')}</td>
														<td className='px-3 py-4'>{String(client.lastName ?? '-')}</td>
														<td className='px-3 py-4'>{String(client.address ?? '-')}</td>
														<td className='px-3 py-4'>{String(client.city ?? '-')}</td>
														<td className='px-3 py-4'>{String(client.province ?? '-')}</td>
														<td className='px-3 py-4'>{String(client.zipCode ?? '-')}</td>
														<td className='px-3 py-4 text-right'>{Number(client.ordersCount ?? 0)}</td>
														<td className='px-3 py-4 text-right'>${Number(client.totalSpent ?? 0).toFixed(2)}</td>
														<td className='whitespace-nowrap px-3 py-4'>{String(client.lastOrderDate ?? '-')}</td>
														<td className='px-3 py-4'>
															{Array.isArray(client.products) ? client.products.join(', ') || '-' : String(client.products ?? '-')}
														</td>
														<td className='px-3 py-4'>{String(client.howDidYouHear ?? '-')}</td>
														<td className='px-3 py-4'>{String(client.discount ?? '-')}</td>
													</tr>
												))}
											</tbody>
										</table>
										</div>
									</>
								)}
							</div>
						)}

						{activeTab === 'products' && (
							<div className='overflow-hidden rounded-2xl border border-black/5 bg-white shadow-sm'>
								<div className='p-4 md:p-6'>
									<div className='grid items-start gap-4 2xl:grid-cols-[minmax(0,1fr)_auto]'>
										<div className='min-w-0'>
											<h1 className='text-xl font-semibold text-[#1f1f1f]'>Products List</h1>
											<p className='mt-1 text-sm font-medium text-deep-tidal-teal'>Synced from Zoho Inventory</p>
											<p className='mt-1 text-sm text-[#7a7a7a]'>{filteredRows.length} of {rows.length} products</p>
										</div>
										<div className='grid w-full grid-cols-1 gap-2 sm:grid-cols-[minmax(0,1fr)_auto] 2xl:w-auto 2xl:justify-self-end'>
											<label className='relative block'>
												<Search
													className='pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#8d8d8d]'
													aria-hidden='true'
												/>
												<input
													type='search'
													value={searchValue}
													onChange={(event) => setSearchValue(event.target.value)}
													placeholder='Search products…'
													aria-label='Search products'
												className='w-full rounded-lg border border-black/10 bg-white py-2.5 pl-9 pr-3 text-sm text-[#2f2f2f] focus:border-deep-tidal-teal focus:outline-none focus:ring-2 focus:ring-deep-tidal-teal/20 sm:w-64'
												/>
											</label>
											<label className='relative block'>
												<ArrowUpDown
													className='pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#8d8d8d]'
													aria-hidden='true'
												/>
												<select
													value={productSort}
													onChange={(event) => setProductSort(event.target.value as ProductSort)}
													aria-label='Sort products'
												className='w-full rounded-lg border border-black/10 bg-white py-2.5 pl-9 pr-8 text-sm text-[#2f2f2f] focus:border-deep-tidal-teal focus:outline-none focus:ring-2 focus:ring-deep-tidal-teal/20 sm:w-auto'>
													<option value='zoho'>Zoho order</option>
													<option value='name-asc'>Name A–Z</option>
													<option value='stock-desc'>Highest stock</option>
													<option value='stock-asc'>Lowest stock</option>
													<option value='price-desc'>Highest price</option>
													<option value='price-asc'>Lowest price</option>
													<option value='status'>Status</option>
												</select>
											</label>
										</div>
									</div>
									{(productsError || saveError) && (
										<div className='mt-4 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800'>{productsError ?? saveError}</div>
									)}
								</div>
								{isLoading && <div className='border-t border-black/5 p-6 text-[#6a6a6a]'>Loading products from Zoho Inventory...</div>}
								{!isLoading && filteredRows.length > 0 && (
									<>
										<div className='grid items-start gap-3 border-t border-black/5 bg-[#f4f4f7] p-3 md:grid-cols-2 md:p-4 lg:hidden'>
											{filteredRows.map((product) => {
												const resolvedCoa = resolveProductCoaFile(product.coaFile, availableCoaFiles);
												return (
													<article key={product.id} className='overflow-hidden rounded-2xl border border-black/10 bg-white shadow-[0_1px_2px_rgba(0,0,0,0.04)]'>
														<div className='p-4'>
															<div className='flex items-start justify-between gap-3'>
																<div className='min-w-0'>
																	<h3 className='truncate font-semibold text-[#1f1f1f]'>{product.name}{product.mg ? ` ${product.mg}` : ''}</h3>
																	<p className='mt-0.5 truncate text-xs text-[#7a7a7a]'>{product.category || 'Uncategorized'}{product.sku ? ` · ${product.sku}` : ''}</p>
																</div>
															<div className='flex shrink-0 items-center gap-1.5'>
																{resolvedCoa ? (
																	<a href={`/coa/${resolvedCoa}`} target='_blank' rel='noreferrer' className='inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-eucalyptus-100 text-deep-tidal-teal' aria-label={`View COA for ${product.name}`}>
																		<FileCheck2 className='h-4 w-4' aria-hidden='true' />
																	</a>
																) : (
																	<span className='inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-rose-50 text-rose-700' title='COA missing'>
																		<FileX2 className='h-4 w-4' aria-hidden='true' />
																	</span>
																)}
																<select value={product.status ?? 'inactive'} onChange={(event) => void handleStatusChange(product.id, event.target.value as Product['status'])} disabled={productStatusUpdatingId === product.id} aria-label={`Website Status for ${product.name}`} className={`h-8 max-w-28 rounded-full border border-transparent py-1 pl-2.5 pr-7 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-deep-tidal-teal/20 disabled:cursor-wait disabled:opacity-60 ${getStatusBadge(product.status)}`}>
																	<option value='published'>Published</option>
																	<option value='draft'>Draft</option>
																	<option value='inactive'>Inactive</option>
																	{product.status === 'stock-out' && <option value='stock-out'>Stock Out</option>}
																</select>
															</div>
															</div>

															<div className='mt-4 grid grid-cols-2 gap-2'>
																<div className={`rounded-xl px-3 py-2.5 ${product.stock <= 5 ? 'bg-amber-50' : 'bg-[#f4f4f7]'}`}>
																	<p className={`text-[10px] font-semibold uppercase tracking-wide ${product.stock <= 5 ? 'text-amber-700' : 'text-[#7a7a7a]'}`}>Stock</p>
																	<p className='mt-0.5 text-lg font-semibold text-[#1f1f1f]'>{product.stock}</p>
																	{product.stock <= 5 && <p className='text-[10px] font-semibold text-amber-700'>Low stock</p>}
																</div>
																<div className='rounded-xl bg-eucalyptus-50 px-3 py-2.5'>
																	<p className='text-[10px] font-semibold uppercase tracking-wide text-deep-tidal-teal/70'>Price</p>
																	<p className='mt-0.5 text-lg font-semibold text-deep-tidal-teal'>${Number(product.price).toFixed(2)}</p>
																</div>
															</div>
														</div>
													</article>
												);
											})}
										</div>

										<div className='hidden overflow-x-auto border-t border-black/5 bg-[#f4f4f7] lg:block'>
											<div className='min-w-[880px]'>
											<div className='px-6 py-3 text-xs uppercase tracking-wide text-[#8d8d8d] border-b border-black/5'>
												<div className='grid grid-cols-[minmax(180px,1.75fr)_minmax(130px,1.35fr)_minmax(70px,0.7fr)_minmax(70px,0.7fr)_minmax(130px,1fr)] gap-4 items-center text-left'>
													<span>Product name</span>
													<span>COA file</span>
													<span>Stock</span>
													<span>Price</span>
													<span>Status</span>
												</div>
											</div>
											<div className='divide-y divide-black/5 bg-white'>
												{filteredRows.map((product) => (
													<div
														key={product.id}
														className='px-6 py-4'>
														<div className='grid grid-cols-[minmax(180px,1.75fr)_minmax(130px,1.35fr)_minmax(70px,0.7fr)_minmax(70px,0.7fr)_minmax(130px,1fr)] gap-4 items-center text-left'>
															<div className='text-sm font-semibold text-[#2f2f2f] text-left'>
																{product.name}
																{product.mg && <sup className='text-xs ml-0.5 align-top opacity-70'>{product.mg}</sup>}
															</div>
															<div className='text-sm'>
																{resolveProductCoaFile(product.coaFile, availableCoaFiles) ? (
																	<a
																		href={`/coa/${resolveProductCoaFile(product.coaFile, availableCoaFiles)}`}
																		target='_blank'
																		rel='noreferrer'
																		title={product.coaFile}
																		className='inline-flex items-center gap-1.5 rounded-full bg-eucalyptus-100 px-2.5 py-1 font-semibold text-deep-tidal-teal hover:bg-eucalyptus-200'>
																		<FileCheck2
																			className='h-4 w-4'
																			aria-hidden='true'
																		/>
																		View COA
																	</a>
																) : (
																	<span
																		title={product.coaFile ? `File not found: ${product.coaFile}` : 'No COA file assigned'}
																		className='inline-flex items-center gap-1.5 rounded-full bg-rose-50 px-2.5 py-1 font-semibold text-rose-700'>
																		<FileX2
																			className='h-4 w-4'
																			aria-hidden='true'
																		/>
																		Missing
																	</span>
																)}
															</div>
															<div className='text-sm text-[#2f2f2f]'>
																{product.stock}
																{product.stock <= 5 && <span className='ml-2 text-xs text-amber-700'>Low Stock</span>}
															</div>
															<div className='text-sm text-[#2f2f2f]'>${product.price}</div>
															<div>
																<select
																	value={product.status ?? 'inactive'}
																	onChange={(event) => void handleStatusChange(product.id, event.target.value as Product['status'])}
																	disabled={productStatusUpdatingId === product.id}
																	aria-label={`Website Status for ${product.name}`}
																	className={`w-auto rounded-full border border-transparent py-1.5 pl-3 pr-8 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-deep-tidal-teal/20 disabled:cursor-wait disabled:opacity-60 ${getStatusBadge(product.status)}`}>
																	<option value='published'>Published</option>
																	<option value='draft'>Draft</option>
																	<option value='inactive'>Inactive</option>
																	{product.status === 'stock-out' && <option value='stock-out'>Stock Out</option>}
																</select>
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
																			className='w-full bg-white border border-black/10 rounded-lg px-4 py-2 text-sm text-[#2f2f2f] focus:outline-none focus:border-deep-tidal-teal focus:ring-2 focus:ring-deep-tidal-teal/20'
																		/>
																	</div>
																	<div>
																		<label className='block text-xs uppercase tracking-wide text-[#7a7a7a] mb-2'>Subtitle</label>
																		<input
																			type='text'
																			value={product.subtitle ?? ''}
																			onChange={(event) => updateRow(product.id, { subtitle: event.target.value })}
																			placeholder='e.g. BPC157 10mg + TB500 10mg'
																			className='w-full bg-white border border-black/10 rounded-lg px-4 py-2 text-sm text-[#2f2f2f] focus:outline-none focus:border-deep-tidal-teal focus:ring-2 focus:ring-deep-tidal-teal/20'
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
																			className='w-full bg-white border border-black/10 rounded-lg px-4 py-2 text-sm text-[#2f2f2f] focus:outline-none focus:border-deep-tidal-teal focus:ring-2 focus:ring-deep-tidal-teal/20'
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
																			className='w-full bg-white border border-black/10 rounded-lg px-4 py-2 text-sm text-[#2f2f2f] focus:outline-none focus:border-deep-tidal-teal focus:ring-2 focus:ring-deep-tidal-teal/20'
																		/>
																	</div>
																	<div>
																		<label className='block text-xs uppercase tracking-wide text-[#7a7a7a] mb-2'>Status</label>
																		<select
																			value={product.status ?? 'published'}
																			onChange={(event) => handleStatusChange(product.id, event.target.value as Product['status'])}
																			className='w-full bg-white border border-black/10 rounded-lg px-4 py-2 text-sm text-[#2f2f2f] focus:outline-none focus:border-deep-tidal-teal focus:ring-2 focus:ring-deep-tidal-teal/20'>
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
																			className='w-full bg-white border border-black/10 rounded-lg px-4 py-2 text-sm text-[#2f2f2f] focus:outline-none focus:border-deep-tidal-teal focus:ring-2 focus:ring-deep-tidal-teal/20'
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
																			className='w-full bg-white border border-black/10 rounded-lg px-4 py-2 text-sm text-[#2f2f2f] focus:outline-none focus:border-deep-tidal-teal focus:ring-2 focus:ring-deep-tidal-teal/20'
																		/>
																	</div>
																	<div>
																		<label className='block text-xs uppercase tracking-wide text-[#7a7a7a] mb-2'>Category</label>
																		<input
																			type='text'
																			value={product.category}
																			onChange={(event) => handleCategoryChange(product.id, event.target.value)}
																			placeholder='Category'
																			className='w-full bg-white border border-black/10 rounded-lg px-4 py-2 text-sm text-[#2f2f2f] focus:outline-none focus:border-deep-tidal-teal focus:ring-2 focus:ring-deep-tidal-teal/20'
																		/>
																	</div>
																	<div className='lg:col-span-2'>
																		<label className='block text-xs uppercase tracking-wide text-[#7a7a7a] mb-2'>Description</label>
																		<textarea
																			rows={2}
																			value={product.description}
																			onChange={(event) => updateRow(product.id, { description: event.target.value })}
																			placeholder='Short description'
																			className='w-full bg-white border border-black/10 rounded-lg px-4 py-2 text-sm text-[#2f2f2f] focus:outline-none focus:border-deep-tidal-teal focus:ring-2 focus:ring-deep-tidal-teal/20'
																		/>
																	</div>
																	<div className='lg:col-span-2'>
																		<label className='block text-xs uppercase tracking-wide text-[#7a7a7a] mb-2'>Details</label>
																		<textarea
																			rows={3}
																			value={product.details ?? ''}
																			onChange={(event) => updateRow(product.id, { details: event.target.value })}
																			placeholder='Details'
																			className='w-full bg-white border border-black/10 rounded-lg px-4 py-2 text-sm text-[#2f2f2f] focus:outline-none focus:border-deep-tidal-teal focus:ring-2 focus:ring-deep-tidal-teal/20'
																		/>
																	</div>
																	<div className='lg:col-span-2'>
																		<label className='block text-xs uppercase tracking-wide text-[#7a7a7a] mb-2'>Icons (comma separated)</label>
																		<input
																			type='text'
																			value={(product.icons ?? []).join(', ')}
																			onChange={(event) => handleIconsChange(product.id, event.target.value)}
																			placeholder='Icons (comma separated)'
																			className='w-full bg-white border border-black/10 rounded-lg px-4 py-2 text-sm text-[#2f2f2f] focus:outline-none focus:border-deep-tidal-teal focus:ring-2 focus:ring-deep-tidal-teal/20'
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
									</>
								)}
								{!isLoading && filteredRows.length === 0 && <div className='border-t border-black/5 p-6 text-sm text-[#6a6a6a]'>No products match your search.</div>}
							</div>
						)}
					</section>
				</div>
			</div>

			{isMobileMenuOpen && (
				<div className='fixed inset-0 z-40 md:hidden'>
					<button
						type='button'
						aria-label='Close navigation menu'
						className='absolute inset-0 bg-black/35 backdrop-blur-[2px]'
						onClick={() => setIsMobileMenuOpen(false)}
					/>
					<div
						role='dialog'
						aria-modal='true'
						aria-label='More dashboard navigation'
						className='absolute inset-x-0 bottom-0 max-h-[78vh] overflow-y-auto rounded-t-[28px] bg-white px-4 pb-[calc(6.25rem+env(safe-area-inset-bottom))] pt-3 shadow-2xl'>
						<div className='mx-auto mb-4 h-1.5 w-11 rounded-full bg-black/15' />
						<div className='mb-3 flex items-center justify-between'>
							<div>
								<p className='text-lg font-semibold text-[#1f1f1f]'>More</p>
								<p className='text-sm text-[#7a7a7a]'>Dashboard sections and account actions</p>
							</div>
							<button
								type='button'
								onClick={() => setIsMobileMenuOpen(false)}
								className='flex h-10 w-10 items-center justify-center rounded-full bg-[#f4f4f7] text-[#4a4a4a]'
								aria-label='Close menu'>
								<X className='h-5 w-5' aria-hidden='true' />
							</button>
						</div>

						<div className='grid grid-cols-2 gap-2'>
							{[
								{ tab: 'promos' as const, label: 'Discounts', icon: BadgePercent },
								{ tab: 'affiliates' as const, label: 'Affiliate Payouts', icon: HandCoins },
								{ tab: 'friends_family' as const, label: 'Friends & Family', icon: HeartHandshake },
								{ tab: 'abandoned_carts' as const, label: 'Abandoned Carts', icon: ShoppingCart },
							].map(({ tab, label, icon: Icon }) => (
								<button
									key={tab}
									type='button'
									onClick={() => selectMobileTab(tab)}
									className={`flex min-h-24 flex-col items-start justify-between rounded-2xl border p-4 text-left transition-colors ${
										activeTab === tab ? 'border-deep-tidal-teal bg-eucalyptus-50 text-deep-tidal-teal' : 'border-black/5 bg-[#f8f8f9] text-[#3f3f3f]'
									}`}>
									<Icon className='h-5 w-5' aria-hidden='true' />
									<span className='text-sm font-semibold leading-tight'>{label}</span>
								</button>
							))}
						</div>

						<div className='mt-4 space-y-2 border-t border-black/5 pt-4'>
							<div className='mb-3 flex min-w-0 items-center gap-3 rounded-2xl bg-[#f4f4f7] p-3'>
								{renderProfileAvatar('h-11 w-11 shrink-0 text-sm')}
								<div className='min-w-0 flex-1'>
									<p className='truncate text-sm font-medium text-[#2f2f2f]'>{dashboardUserEmail}</p>
								</div>
							</div>
							<button
								type='button'
								onClick={handleRefreshProductionData}
								disabled={isRefreshingData}
								className='flex min-h-12 w-full items-center gap-3 rounded-xl bg-deep-tidal-teal px-4 py-3 text-left text-sm font-medium text-white disabled:cursor-wait disabled:opacity-60'>
								<RefreshCw className={`h-4 w-4 ${isRefreshingData ? 'animate-spin' : ''}`} aria-hidden='true' />
								{isRefreshingData ? 'Refreshing data…' : 'Refresh website data'}
							</button>
							{refreshDataMessage && (
								<p role={refreshDataMessage.kind === 'error' ? 'alert' : 'status'} className={`rounded-lg px-3 py-2 text-xs ${refreshDataMessage.kind === 'error' ? 'bg-rose-50 text-rose-700' : 'bg-eucalyptus-50 text-deep-tidal-teal'}`}>
									{refreshDataMessage.text}
								</p>
							)}
							<button
								type='button'
								onClick={handleSignOut}
								className='flex min-h-12 w-full items-center gap-3 rounded-xl border border-rose-100 bg-white px-4 py-3 text-left text-sm font-medium text-rose-600'>
								<LogOut className='h-4 w-4' aria-hidden='true' />
								Sign out
							</button>
						</div>
					</div>
				</div>
			)}

			<nav aria-label='Dashboard navigation' className='fixed inset-x-0 bottom-0 z-50 border-t border-black/10 bg-white/95 pb-[env(safe-area-inset-bottom)] shadow-[0_-8px_24px_rgba(0,0,0,0.08)] backdrop-blur lg:hidden'>
				<div className='mx-auto grid h-[4.75rem] w-full max-w-[1536px] grid-cols-4 px-2 md:grid-cols-7 md:px-4'>
					{[
						{ tab: 'clients' as const, label: 'Clients', icon: Users },
						{ tab: 'products' as const, label: 'Products', icon: Package },
						{ tab: 'orders' as const, label: 'Orders', icon: ShoppingBag },
					].map(({ tab, label, icon: Icon }) => {
						const isActive = activeTab === tab;
						return (
							<button
								key={tab}
								type='button'
								onClick={() => selectMobileTab(tab)}
								aria-current={isActive ? 'page' : undefined}
								className={`relative flex min-w-0 flex-col items-center justify-center gap-1 text-[11px] font-medium ${isActive ? 'text-deep-tidal-teal' : 'text-[#707070]'}`}>
								<span className={`flex h-8 min-w-12 items-center justify-center rounded-full px-3 ${isActive ? 'bg-eucalyptus-50' : ''}`}>
									<Icon className='h-5 w-5' strokeWidth={isActive ? 2.5 : 2} aria-hidden='true' />
								</span>
								<span className='truncate'>{label}</span>
							</button>
						);
					})}
					{[
						{ tab: 'promos' as const, label: 'Discounts', icon: BadgePercent },
						{ tab: 'affiliates' as const, label: 'Affiliate Payouts', icon: HandCoins },
						{ tab: 'friends_family' as const, label: 'Friends & Family', icon: HeartHandshake },
						{ tab: 'abandoned_carts' as const, label: 'Abandoned Carts', icon: ShoppingCart },
					].map(({ tab, label, icon: Icon }) => {
						const isActive = activeTab === tab;
						return (
							<button
								key={tab}
								type='button'
								onClick={() => selectMobileTab(tab)}
								aria-current={isActive ? 'page' : undefined}
								className={`relative hidden min-w-0 flex-col items-center justify-center gap-1 text-[11px] font-medium md:flex ${isActive ? 'text-deep-tidal-teal' : 'text-[#707070]'}`}>
								<span className={`flex h-8 min-w-12 items-center justify-center rounded-full px-3 ${isActive ? 'bg-eucalyptus-50' : ''}`}>
									<Icon className='h-5 w-5' strokeWidth={isActive ? 2.5 : 2} aria-hidden='true' />
								</span>
								<span className='max-w-full truncate px-1'>{label}</span>
							</button>
						);
					})}
					<button
						type='button'
						onClick={() => setIsMobileMenuOpen(true)}
						aria-expanded={isMobileMenuOpen}
						className={`relative flex min-w-0 flex-col items-center justify-center gap-1 text-[11px] font-medium md:hidden ${isMoreTabActive || isMobileMenuOpen ? 'text-deep-tidal-teal' : 'text-[#707070]'}`}>
						<span className={`flex h-8 min-w-12 items-center justify-center rounded-full px-3 ${isMoreTabActive || isMobileMenuOpen ? 'bg-eucalyptus-50' : ''}`}>
							<MoreHorizontal className='h-5 w-5' strokeWidth={isMoreTabActive || isMobileMenuOpen ? 2.5 : 2} aria-hidden='true' />
						</span>
						<span>More</span>
					</button>
				</div>
			</nav>
		</div>
	);
}
