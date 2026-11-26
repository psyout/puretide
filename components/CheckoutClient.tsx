'use client';

import { useCart } from '@/context/CartContext';
import { readStoredCartPromo, storeCartPromo } from '@/lib/cartPromo';
import { useRouter } from 'next/navigation';
import { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { hasProductImage } from '@/lib/productImage';
import ProductImagePlaceholder from '@/components/ProductImagePlaceholder';
import { Plus, Minus, Trash2, Loader2 } from 'lucide-react';
import TermsContent from './TermsContent';
import { SHIPPING_COSTS, getEffectiveShippingCost, FREE_SHIPPING_THRESHOLD } from '@/lib/constants';
import { AUTOMATIC_SITEWIDE_PROMO_CODE, getSalePrice } from '@/lib/promo';
import StoreBreadcrumb from './StoreBreadcrumb';
import { getProductDisplayName } from '@/lib/productVariant';

const ETRANSFER_PROVIDER = String(process.env.NEXT_PUBLIC_ETRANSFER_PROVIDER ?? 'manual').toLowerCase() === 'bluepeak' ? 'bluepeak' : 'manual';
const FRIENDS_FAMILY_ENABLED = String(process.env.NEXT_PUBLIC_FRIENDS_FAMILY_ENABLED ?? '').toLowerCase() === 'true';
const ABANDONED_CART_STORAGE_KEY = 'puretide-abandoned-cart-id';
const ABANDONED_CART_CONSENT_TEXT = 'Email me one reminder about items left in my cart. I can unsubscribe at any time.';
const CANADIAN_PROVINCES = [
	{ name: 'British Columbia', code: 'BC' },
	{ name: 'Alberta', code: 'AB' },
	{ name: 'Manitoba', code: 'MB' },
	{ name: 'New Brunswick', code: 'NB' },
	{ name: 'Newfoundland and Labrador', code: 'NL' },
	{ name: 'Nova Scotia', code: 'NS' },
	{ name: 'Ontario', code: 'ON' },
	{ name: 'Prince Edward Island', code: 'PE' },
	{ name: 'Quebec', code: 'QC' },
	{ name: 'Saskatchewan', code: 'SK' },
	{ name: 'Northwest Territories', code: 'NT' },
	{ name: 'Nunavut', code: 'NU' },
	{ name: 'Yukon', code: 'YT' },
] as const;

function capitalizeWords(str: string): string {
	return str.replace(/\b\w+/g, (word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase());
}

function isTrustedPaymentRedirect(urlRaw: string): boolean {
	try {
		const url = new URL(urlRaw);
		return url.origin === 'https://api.gatewaylinx.com' && url.pathname.startsWith('/checkout/') && !url.username && !url.password;
	} catch {
		return false;
	}
}

export default function CheckoutClient({ enableCreditCard }: { enableCreditCard: boolean }) {
	const { cartItems, getTotal, clearCart, getItemPrice, updateQuantity, removeFromCart, paymentMethod, setPaymentMethod, automaticPromotion: scheduledPromotion } = useCart();
	const router = useRouter();
	useEffect(() => {
		if (!enableCreditCard && paymentMethod === 'creditcard') setPaymentMethod('etransfer');
	}, [enableCreditCard, paymentMethod, setPaymentMethod]);

	const initialFormData = {
		firstName: '',
		lastName: '',
		country: 'Canada',
		email: '',
		phone: '',
		address: '',
		addressLine2: '',
		city: '',
		province: 'British Columbia',
		zipCode: '',
		orderNotes: '',
	};
	const initialShippingAddress = {
		address: '',
		addressLine2: '',
		city: '',
		province: 'British Columbia',
		zipCode: '',
	};
	const [formData, setFormData] = useState({
		...initialFormData,
	});
	const [isProcessing, setIsProcessing] = useState(false);
	const submissionInProgressRef = useRef(false);
	const [hasSubmitted, setHasSubmitted] = useState(false);
	const [showPromoInput, setShowPromoInput] = useState(true);
	const [showOrderNotes, setShowOrderNotes] = useState(false);
	const [promoCode, setPromoCode] = useState(scheduledPromotion?.code ?? '');
	const [appliedPromoCode, setAppliedPromoCode] = useState<string | null>(scheduledPromotion?.code ?? null);
	const [appliedDiscount, setAppliedDiscount] = useState<number>(scheduledPromotion?.discount ?? 0);
	const [appliedFreeShipping, setAppliedFreeShipping] = useState(scheduledPromotion?.freeShipping ?? false);
	const [appliedProductIds, setAppliedProductIds] = useState<string[]>(scheduledPromotion?.productIds ?? []);
	const [promoError, setPromoError] = useState<string | null>(null);
	const [isVerifyingPromo, setIsVerifyingPromo] = useState(false);
	const promoRevalidateTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	const [shipToDifferentAddress, setShipToDifferentAddress] = useState(false);
	const shippingMethod = 'express';
	const [agreedToTerms, setAgreedToTerms] = useState(false);
	const [abandonedCartConsent, setAbandonedCartConsent] = useState(false);
	const [abandonedCartAvailability, setAbandonedCartAvailability] = useState<{ available: boolean; businessAddress?: string; contactEmail?: string }>({ available: false });
	const abandonedCartConsentAtRef = useRef<string | null>(null);
	const [showTermsModal, setShowTermsModal] = useState(false);
	const [checkoutError, setCheckoutError] = useState<string | null>(null);
	const [shippingAddress, setShippingAddress] = useState({
		...initialShippingAddress,
	});
	const idempotencyKeyRef = useRef<string | null>(null);
	const [friendsFamilyExpanded, setFriendsFamilyExpanded] = useState(false);
	const [friendsFamilyStartLoading, setFriendsFamilyStartLoading] = useState(false);
	const [friendsFamilyVerifyLoading, setFriendsFamilyVerifyLoading] = useState(false);
	const [friendsFamilyMessage, setFriendsFamilyMessage] = useState<string | null>(null);
	const [friendsFamilyError, setFriendsFamilyError] = useState<string | null>(null);
	const [friendsFamilyCode, setFriendsFamilyCode] = useState('');
	const [friendsFamilyVerified, setFriendsFamilyVerified] = useState(false);
	const [friendsFamilyEligible, setFriendsFamilyEligible] = useState<boolean | null>(null);
	const getOrCreateIdempotencyKey = () => {
		if (!idempotencyKeyRef.current) {
			idempotencyKeyRef.current = typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function' ? crypto.randomUUID() : `idem-${Date.now()}-${Math.random().toString(36).slice(2)}`;
		}
		return idempotencyKeyRef.current;
	};

	// When promo is applied, do not stack with volume discount: use raw subtotal and apply promo only
	const subtotalWithVolume = getTotal();
	const subtotalRaw = cartItems.reduce((s, item) => s + item.price * item.quantity, 0);
	const promoApplied = appliedPromoCode != null && (appliedDiscount > 0 || appliedFreeShipping);
	const subtotal = promoApplied ? subtotalRaw : subtotalWithVolume;
	const promoEligibleSubtotal = cartItems.reduce((sum, item) => (appliedProductIds.length === 0 || appliedProductIds.includes(String(item.id)) ? sum + item.price * item.quantity : sum), 0);
	const discountAmount = Number((promoEligibleSubtotal * (appliedDiscount / 100)).toFixed(2));
	const subtotalAfterDiscounts = Number((subtotal - discountAmount).toFixed(2));
	const qualifiesFreeShipping = subtotalAfterDiscounts > FREE_SHIPPING_THRESHOLD;
	const destinationZipCode = shipToDifferentAddress ? shippingAddress.zipCode : formData.zipCode;
	const destinationProvince = shipToDifferentAddress ? shippingAddress.province : formData.province;
	const shippingCost = appliedFreeShipping || qualifiesFreeShipping ? 0 : getEffectiveShippingCost(destinationZipCode, destinationProvince);
	const useCreditCard = enableCreditCard && paymentMethod === 'creditcard';
	const cardFee = useCreditCard ? Number(((subtotal - discountAmount) * 0.05).toFixed(2)) : 0;
	const total = Number((subtotal + shippingCost - discountAmount + cardFee).toFixed(2));
	const CREDIT_CARD_LIMIT = 500;
	const isCreditCardOverLimit = useCreditCard && total > CREDIT_CARD_LIMIT;
	const isCreditCardDisabled = total > CREDIT_CARD_LIMIT;

	const isPromoEligibleItem = (item: (typeof cartItems)[0]) => appliedProductIds.length === 0 || appliedProductIds.includes(String(item.id));
	const getDisplayPrice = (item: (typeof cartItems)[0]) => (promoApplied && appliedDiscount > 0 && isPromoEligibleItem(item) ? getSalePrice(item.price, appliedDiscount) : getItemPrice(item));

	// Canadian postal code
	const isValidCanadianPostalCode = (zip: string) => /^[A-Za-z]\d[A-Za-z]\s?\d[A-Za-z]\d$/.test((zip || '').trim().replace(/\s{2,}/g, ' '));
	const normalizedZip = (zip: string) => (zip || '').trim().replace(/\s/g, '');
	const billingZipInvalidFormat = normalizedZip(formData.zipCode).length > 0 && !isValidCanadianPostalCode(formData.zipCode);
	const shippingZipInvalidFormat = shipToDifferentAddress && normalizedZip(shippingAddress.zipCode).length > 0 && !isValidCanadianPostalCode(shippingAddress.zipCode);
	const hasInvalidPostalCodeFormat = billingZipInvalidFormat || shippingZipInvalidFormat;

	useEffect(() => {
		if (cartItems.length === 0 && !hasSubmitted) {
			router.push('/cart');
		}
	}, [cartItems.length, hasSubmitted, router]);

	useEffect(() => {
		if (!showTermsModal) return;

		const previousOverflow = document.body.style.overflow;
		const handleKeyDown = (event: KeyboardEvent) => {
			if (event.key === 'Escape') setShowTermsModal(false);
		};

		document.body.style.overflow = 'hidden';
		document.addEventListener('keydown', handleKeyDown);

		return () => {
			document.body.style.overflow = previousOverflow;
			document.removeEventListener('keydown', handleKeyDown);
		};
	}, [showTermsModal]);

	useEffect(() => {
		if (scheduledPromotion) {
			setPromoCode(scheduledPromotion.code);
			setAppliedPromoCode(scheduledPromotion.code);
			setAppliedDiscount(scheduledPromotion.discount);
			setAppliedFreeShipping(Boolean(scheduledPromotion.freeShipping));
			setAppliedProductIds(scheduledPromotion.productIds ?? []);
			storeCartPromo({
				code: scheduledPromotion.code,
				discount: scheduledPromotion.discount,
				freeShipping: Boolean(scheduledPromotion.freeShipping),
				productIds: scheduledPromotion.productIds ?? [],
			});
			return;
		}
		const storedPromo = readStoredCartPromo();
		if (!storedPromo) {
			return;
		}
		if (storedPromo.code === AUTOMATIC_SITEWIDE_PROMO_CODE && !scheduledPromotion) {
			storeCartPromo(null);
			return;
		}
		setPromoCode(storedPromo.code);
		setAppliedPromoCode(storedPromo.code);
		setAppliedDiscount(storedPromo.discount);
		setAppliedFreeShipping(storedPromo.freeShipping);
		setAppliedProductIds(storedPromo.productIds ?? []);
		setShowPromoInput(true);
	}, [scheduledPromotion]);

	useEffect(() => {
		if (scheduledPromotion || appliedPromoCode !== AUTOMATIC_SITEWIDE_PROMO_CODE) return;
		setPromoCode('');
		setAppliedPromoCode(null);
		setAppliedDiscount(0);
		setAppliedFreeShipping(false);
		setAppliedProductIds([]);
		storeCartPromo(null);
	}, [appliedPromoCode, scheduledPromotion]);

	useEffect(() => {
		let cancelled = false;
		void fetch('/api/abandoned-carts', { cache: 'no-store' })
			.then(async (response) => (response.ok ? response.json() : { available: false }))
			.then((data: { available?: boolean; businessAddress?: string; contactEmail?: string }) => {
				if (!cancelled) setAbandonedCartAvailability({ available: data.available === true, businessAddress: data.businessAddress, contactEmail: data.contactEmail });
			})
			.catch(() => undefined);
		return () => {
			cancelled = true;
		};
	}, []);

	useEffect(() => {
		if (!abandonedCartAvailability.available || !abandonedCartConsent) return;
		const email = formData.email.trim().toLowerCase();
		if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || cartItems.length === 0) return;
		const timeout = setTimeout(() => {
			let id = localStorage.getItem(ABANDONED_CART_STORAGE_KEY);
			if (!id) {
				id = typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function' ? crypto.randomUUID() : `cart_${Date.now()}_${Math.random().toString(36).slice(2)}`;
				localStorage.setItem(ABANDONED_CART_STORAGE_KEY, id);
			}
			if (!abandonedCartConsentAtRef.current) abandonedCartConsentAtRef.current = new Date().toISOString();
			void fetch('/api/abandoned-carts', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					id,
					email,
					firstName: formData.firstName,
					consent: true,
					consentAt: abandonedCartConsentAtRef.current,
					consentText: ABANDONED_CART_CONSENT_TEXT,
					items: cartItems.map((item) => ({ id: item.id, quantity: item.quantity })),
				}),
			}).catch(() => undefined);
		}, 800);
		return () => clearTimeout(timeout);
	}, [abandonedCartAvailability.available, abandonedCartConsent, cartItems, formData.email, formData.firstName]);

	const cancelAbandonedCartReminder = () => {
		setAbandonedCartConsent(false);
		abandonedCartConsentAtRef.current = null;
		const id = typeof window !== 'undefined' ? localStorage.getItem(ABANDONED_CART_STORAGE_KEY) : null;
		if (id) {
			localStorage.removeItem(ABANDONED_CART_STORAGE_KEY);
			void fetch('/api/abandoned-carts', {
				method: 'DELETE',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ id }),
			}).catch(() => undefined);
		}
	};

	const clearAbandonedCartClientState = () => {
		setAbandonedCartConsent(false);
		abandonedCartConsentAtRef.current = null;
		if (typeof window !== 'undefined') localStorage.removeItem(ABANDONED_CART_STORAGE_KEY);
	};

	useEffect(() => {
		if (!FRIENDS_FAMILY_ENABLED) return;
		let cancelled = false;
		(async () => {
			try {
				const response = await fetch('/api/friends-family/status', { method: 'POST', credentials: 'include' });
				const data = (await response.json()) as { ok?: boolean; verified?: boolean };
				if (!cancelled && response.ok && data.ok) {
					setFriendsFamilyVerified(Boolean(data.verified));
				}
			} catch {
				// ignore
			}
		})();
		return () => {
			cancelled = true;
		};
	}, []);

	// When user navigates back from hosted checkout (bfcache restore), reset processing state so they can edit and resubmit
	useEffect(() => {
		const onPageShow = (e: PageTransitionEvent) => {
			if (e.persisted) {
				clearSubmissionState();
				setHasSubmitted(false);
			}
		};
		window.addEventListener('pageshow', onPageShow);
		return () => window.removeEventListener('pageshow', onPageShow);
	}, []);

	const handleApplyPromo = async () => {
		if (scheduledPromotion) return;
		if (!promoCode.trim()) return;
		setIsVerifyingPromo(true);
		setPromoError(null);

		try {
			const normalizedCode = promoCode.trim().toUpperCase();
			const response = await fetch('/api/promo/verify', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ code: normalizedCode, subtotal: subtotalRaw, cartItems: cartItems.map(({ id, price, quantity }) => ({ id, price, quantity })) }),
			});

			const data = (await response.json()) as { ok?: boolean; discount?: number; freeShipping?: boolean; productIds?: string[]; error?: string };
			if (data.ok) {
				const discount = Number(data.discount ?? 0);
				const freeShipping = Boolean(data.freeShipping);
				const productIds = Array.isArray(data.productIds) ? data.productIds.map(String) : [];
				setAppliedDiscount(discount);
				setAppliedFreeShipping(freeShipping);
				setAppliedProductIds(productIds);
				setAppliedPromoCode(normalizedCode);
				setPromoError(null);
				storeCartPromo({ code: normalizedCode, discount, freeShipping, productIds });
			} else {
				setPromoError(data.error || 'Invalid code');
				setAppliedDiscount(0);
				setAppliedFreeShipping(false);
				setAppliedProductIds([]);
				setAppliedPromoCode(null);
				storeCartPromo(null);
			}
		} catch (error) {
			setPromoError('Failed to verify code');
			setAppliedDiscount(0);
			setAppliedFreeShipping(false);
			setAppliedProductIds([]);
			setAppliedPromoCode(null);
			storeCartPromo(null);
		} finally {
			setIsVerifyingPromo(false);
		}
	};

	const handleClearPromo = () => {
		if (scheduledPromotion) return;
		setPromoCode('');
		setAppliedPromoCode(null);
		setAppliedDiscount(0);
		setAppliedFreeShipping(false);
		setAppliedProductIds([]);
		setPromoError(null);
		storeCartPromo(null);
	};

	useEffect(() => {
		if (!appliedPromoCode) return;
		if (promoRevalidateTimeoutRef.current) {
			clearTimeout(promoRevalidateTimeoutRef.current);
		}
		const controller = new AbortController();
		promoRevalidateTimeoutRef.current = setTimeout(async () => {
			setIsVerifyingPromo(true);
			try {
				const response = await fetch('/api/promo/verify', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ code: appliedPromoCode, subtotal: subtotalRaw, cartItems: cartItems.map(({ id, price, quantity }) => ({ id, price, quantity })) }),
					signal: controller.signal,
				});
				const data = (await response.json()) as { ok?: boolean; discount?: number; freeShipping?: boolean; productIds?: string[]; error?: string };
				if (data.ok) {
					const discount = Number(data.discount ?? 0);
					const freeShipping = Boolean(data.freeShipping);
					const productIds = Array.isArray(data.productIds) ? data.productIds.map(String) : [];
					setAppliedDiscount(discount);
					setAppliedFreeShipping(freeShipping);
					setAppliedProductIds(productIds);
					setPromoError(null);
					storeCartPromo({ code: appliedPromoCode, discount, freeShipping, productIds });
					return;
				}

				setPromoError(data.error || 'Invalid code');
				setAppliedDiscount(0);
				setAppliedFreeShipping(false);
				setAppliedProductIds([]);
				setAppliedPromoCode(null);
				storeCartPromo(null);
			} catch (error) {
				if (error instanceof DOMException && error.name === 'AbortError') {
					return;
				}
				setPromoError('Failed to verify code');
				setAppliedDiscount(0);
				setAppliedFreeShipping(false);
				setAppliedProductIds([]);
				setAppliedPromoCode(null);
				storeCartPromo(null);
			} finally {
				setIsVerifyingPromo(false);
			}
		}, 300);

		return () => {
			controller.abort();
			if (promoRevalidateTimeoutRef.current) {
				clearTimeout(promoRevalidateTimeoutRef.current);
			}
		};
	}, [appliedPromoCode, subtotalRaw, cartItems]);

	const buildPayload = () => {
		// Capitalize name and address fields
		const capitalizedCustomer = {
			...formData,
			firstName: capitalizeWords(formData.firstName),
			lastName: capitalizeWords(formData.lastName),
			address: capitalizeWords(formData.address),
			addressLine2: formData.addressLine2 ? capitalizeWords(formData.addressLine2) : '',
			city: capitalizeWords(formData.city),
			province: capitalizeWords(formData.province),
		};
		const capitalizedShippingAddress = shipToDifferentAddress
			? {
					...shippingAddress,
					address: capitalizeWords(shippingAddress.address),
					addressLine2: shippingAddress.addressLine2 ? capitalizeWords(shippingAddress.addressLine2) : '',
					city: capitalizeWords(shippingAddress.city),
					province: capitalizeWords(shippingAddress.province),
				}
			: undefined;

		return {
			customer: capitalizedCustomer,
			shipToDifferentAddress,
			shippingAddress: capitalizedShippingAddress,
			shippingMethod,
			paymentMethod: useCreditCard ? 'creditcard' : 'etransfer',
			cardFee: useCreditCard ? cardFee : 0,
			promoCode: promoApplied ? (appliedPromoCode ?? undefined) : undefined,
			discountAmount: discountAmount || undefined,
			subtotal,
			shippingCost,
			total,
			idempotencyKey: getOrCreateIdempotencyKey(),
			cartItems: cartItems.map((item) => ({
				id: item.id,
				name: getProductDisplayName(item.name, item.mg, item.id !== item.slug),
				price: item.price,
				quantity: item.quantity,
				image: item.image ?? '',
				description: item.description ?? '',
			})),
		};
	};

	const clearSubmissionState = () => {
		submissionInProgressRef.current = false;
		setIsProcessing(false);
	};

	const resetCheckoutState = () => {
		setFormData({ ...initialFormData });
		setShipToDifferentAddress(false);
		setShippingAddress({ ...initialShippingAddress });
		setAgreedToTerms(false);
		clearAbandonedCartClientState();
		setShowTermsModal(false);
		setCheckoutError(null);
		setPromoCode('');
		setAppliedPromoCode(null);
		setAppliedDiscount(0);
		setAppliedFreeShipping(false);
		setAppliedProductIds([]);
		setPromoError(null);
		setShowPromoInput(false);
		storeCartPromo(null);
		setHasSubmitted(false);
		clearSubmissionState();
		setPaymentMethod('etransfer');
	};

	// When we successfully create an order, we want to navigate away (confirmation page or external card provider)
	// without triggering the "empty cart" redirect effect on this checkout page.
	// Keeping hasSubmitted=true prevents the cart-empty guard from redirecting to /cart mid-navigation.
	const resetCheckoutStateForExit = (keepSubmissionLoading = false) => {
		setFormData({ ...initialFormData });
		setShipToDifferentAddress(false);
		setShippingAddress({ ...initialShippingAddress });
		setAgreedToTerms(false);
		clearAbandonedCartClientState();
		setShowTermsModal(false);
		setCheckoutError(null);
		setPromoCode('');
		setAppliedPromoCode(null);
		setAppliedDiscount(0);
		setAppliedFreeShipping(false);
		setAppliedProductIds([]);
		setPromoError(null);
		setShowPromoInput(false);
		storeCartPromo(null);
		if (!keepSubmissionLoading) clearSubmissionState();
		setPaymentMethod('etransfer');
	};

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		if (submissionInProgressRef.current) return;
		submissionInProgressRef.current = true;
		setIsProcessing(true);
		setHasSubmitted(true);
		setCheckoutError(null);

		if (!agreedToTerms) {
			clearSubmissionState();
			return;
		}
		if (hasInvalidPostalCodeFormat) {
			setCheckoutError('Please enter a valid Canadian postal code (e.g. A1A 1A1).');
			clearSubmissionState();
			return;
		}
		if (useCreditCard && total > CREDIT_CARD_LIMIT) {
			setCheckoutError('Credit card payments are limited to $500 per transaction. Please select another payment method or split your order.');
			clearSubmissionState();
			return;
		}

		try {
			if (useCreditCard) {
				const response = await fetch('/api/creditcard/create', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify(buildPayload()),
				});
				const data = await response.json();
				if (!response.ok) {
					throw new Error(data.error ?? 'Failed to start payment');
				}
				if (data.ok && data.redirectUrl) {
					if (!isTrustedPaymentRedirect(data.redirectUrl)) {
						throw new Error('Received an invalid payment redirect URL. Please contact support.');
					}

					resetCheckoutStateForExit(true);
					window.location.href = data.redirectUrl;
					return;
				}
				throw new Error('Invalid response from payment');
			}

			const response = await fetch('/api/orders', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(buildPayload()),
			});

			const data = await response.json();
			if (!response.ok) {
				throw new Error(data?.error ?? 'Failed to store order');
			}
			const orderNumber = data.orderNumber ?? '';
			const confirmationToken = data.confirmationToken ?? '';
			if (!orderNumber) {
				setCheckoutError('Your order was received but we could not show the confirmation. Please check your email or contact us.');
				setIsProcessing(false);
				setHasSubmitted(false);
				return;
			}
			if (!confirmationToken) {
				setCheckoutError('Your order was received but the confirmation link is missing. Please check your email or contact us.');
				setIsProcessing(false);
				setHasSubmitted(false);
				return;
			}

			if (ETRANSFER_PROVIDER === 'bluepeak' && !(FRIENDS_FAMILY_ENABLED && friendsFamilyVerified)) {
				// Reserve autodeposit email for this order (server-side BluePeak call)
				try {
					const response = await fetch('/api/payments/etransfer/create', {
						method: 'POST',
						headers: { 'Content-Type': 'application/json' },
						body: JSON.stringify({ orderNumber, confirmationToken, idempotencyKey: getOrCreateIdempotencyKey() }),
					});
					if (!response.ok) {
						const data = await response.json().catch(() => ({}));
						console.warn('BluePeak checkout creation failed:', data.error || 'Unknown error');
						// If this fails, the order-confirmation page can still show fallback instructions.
					}
				} catch (error) {
					console.warn('BluePeak checkout creation error:', error);
					// If this fails, the order-confirmation page can still show fallback instructions.
				}
			}

			// Order successfully created; navigate to confirmation first, then clear cart.
			// Keeping hasSubmitted=true avoids the empty-cart redirect race on this page.
			const confirmationUrl = `/order-confirmation?orderNumber=${encodeURIComponent(orderNumber)}&token=${encodeURIComponent(confirmationToken)}`;
			router.push(confirmationUrl);
			clearCart();
			resetCheckoutStateForExit();
		} catch (error) {
			console.error('Checkout error', error);
			setCheckoutError(error instanceof Error ? error.message : 'We could not place your order. Please try again.');
			clearSubmissionState();
			setHasSubmitted(false);
		}
	};

	if (cartItems.length === 0) {
		return null;
	}

	// Show full-page loader for all payment processing
	if (isProcessing) {
		return (
			<div className='fixed inset-0 bg-gradient-to-br from-mineral-white via-deep-tidal-teal-50 to-eucalyptus-50 z-50 flex items-center justify-center'>
				<div className='text-center'>
					<div className='w-16 h-16 border-4 border-deep-tidal-teal-200 border-t-deep-tidal-teal rounded-full animate-spin mx-auto mb-6'></div>
					<h2 className='text-2xl font-bold text-deep-tidal-teal-800 mb-3'>Processing your order</h2>
					<p className='text-deep-tidal-teal-600 max-w-md'>Please wait while we create your order...</p>
				</div>
			</div>
		);
	}

	return (
		<div className='checkout-page min-h-screen bg-gradient-to-br from-mineral-white via-deep-tidal-teal-50 to-eucalyptus-50'>
			<div className='max-w-6xl mx-auto px-6 pt-32 pb-24'>
				<StoreBreadcrumb items={[{ label: 'Shop', href: '/#products' }, { label: 'Cart', href: '/cart' }, { label: 'Checkout' }]} />
				<h1 className='text-3xl font-bold mb-8 text-deep-tidal-teal-800'>Checkout</h1>

				<div className='checkout-layout grid grid-cols-1 gap-8 lg:grid-cols-3'>
					<div className='order-1 min-w-0 lg:order-1 lg:col-span-2'>
						<div className='space-y-5'>
						<div className='checkout-form-card bento-card p-5'>
							{/* Contact Information */}
							<div className='pb-4 border-b border-deep-tidal-teal/10 mb-4'>
								<h2 className='mb-4 text-lg font-semibold text-deep-tidal-teal-800'>Contact Information</h2>
								<div>
									<label className='block text-[0.9rem]  mb-2 text-deep-tidal-teal-800'>Email Address *</label>
									<input
										type='email'
										form='checkout-form'
										value={formData.email}
										onChange={(e) => setFormData({ ...formData, email: e.target.value })}
										autoComplete='email'
										className='w-full bg-white border border-black/10 rounded px-4 py-2 text-deep-tidal-teal-800 focus:outline-none focus:border-deep-tidal-teal focus:ring-2 focus:ring-deep-tidal-teal mb-1'
										required
									/>
									<p className='text-xs text-deep-tidal-teal-600 mt-1 flex items-center gap-2'>
										<svg
											className='w-3 h-3 inline'
											fill='none'
											stroke='currentColor'
											viewBox='0 0 24 24'>
											<path
												strokeLinecap='round'
												strokeLinejoin='round'
												strokeWidth={1.5}
												d='M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z'
											/>
										</svg>
										Your email is only used for order confirmation.
									</p>
								</div>
							</div>

							{/* Billing Details */}
							<div>
								<h2 className='mb-4 text-lg font-semibold text-deep-tidal-teal-800'>Billing Details</h2>
								<form
									id='checkout-form'
									onSubmit={handleSubmit}
									aria-busy={isProcessing}
									className='space-y-4'>
									<fieldset
										disabled={isProcessing}
										className='space-y-4'>
										<div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
											<div>
												<label className='block text-[0.9rem] font-regular mb-1 text-deep-tidal-teal-800'>First name *</label>
												<input
													type='text'
													value={formData.firstName}
													onChange={(e) => {
														setFormData({ ...formData, firstName: e.target.value });
														if (checkoutError?.includes('First name')) setCheckoutError(null);
													}}
													onBlur={(e) => {
														const capitalized = capitalizeWords(e.target.value);
														if (capitalized !== e.target.value) {
															setFormData((prev) => ({ ...prev, firstName: capitalized }));
														}
													}}
													autoComplete='given-name'
													className='w-full bg-white border border-black/10 rounded px-4 py-2 text-deep-tidal-teal-800 focus:outline-none focus:border-deep-tidal-teal focus:ring-2 focus:ring-deep-tidal-teal'
													required
												/>
												{checkoutError && checkoutError.includes('First name') && <p className='mt-1.5 text-red-700 text-xs'>{checkoutError}</p>}
											</div>
											<div>
												<label className='block text-[0.9rem] font-regular mb-1 text-deep-tidal-teal-800'>Last name *</label>
												<input
													type='text'
													value={formData.lastName}
													onChange={(e) => {
														setFormData({ ...formData, lastName: e.target.value });
														if (checkoutError?.includes('Last name')) setCheckoutError(null);
													}}
													onBlur={(e) => {
														const capitalized = capitalizeWords(e.target.value);
														if (capitalized !== e.target.value) {
															setFormData((prev) => ({ ...prev, lastName: capitalized }));
														}
													}}
													autoComplete='family-name'
													className='w-full bg-white border border-black/10 rounded px-4 py-2 text-deep-tidal-teal-800 focus:outline-none focus:border-deep-tidal-teal focus:ring-2 focus:ring-deep-tidal-teal'
													required
												/>
												{checkoutError && checkoutError.includes('Last name') && <p className='mt-1.5 text-red-700 text-xs'>{checkoutError}</p>}
											</div>
										</div>

										<div>
											<label className='block text-[0.9rem] font-regular mb-1 text-deep-tidal-teal-800'>Street address *</label>
											<input
												type='text'
												value={formData.address}
												onChange={(e) => setFormData({ ...formData, address: e.target.value })}
												onBlur={(e) => {
													const capitalized = capitalizeWords(e.target.value);
													if (capitalized !== e.target.value) {
														setFormData((prev) => ({ ...prev, address: capitalized }));
													}
												}}
												placeholder='House number and street name'
												autoComplete='address-line1'
												className='w-full bg-white border border-black/10 rounded px-4 py-2 text-deep-tidal-teal-800 focus:outline-none focus:border-deep-tidal-teal focus:ring-2 focus:ring-deep-tidal-teal'
												required
											/>
										</div>
										<div>
											<label className='block text-[0.9rem] font-regular mb-1 text-deep-tidal-teal-800'>Apartment, suite, unit, etc.</label>
											<input
												type='text'
												value={formData.addressLine2}
												onChange={(e) => setFormData({ ...formData, addressLine2: e.target.value })}
												onBlur={(e) => {
													const capitalized = capitalizeWords(e.target.value);
													if (capitalized !== e.target.value) {
														setFormData((prev) => ({ ...prev, addressLine2: capitalized }));
													}
												}}
												placeholder='Apartment, suite, unit'
												autoComplete='address-line2'
												className='w-full bg-white border border-black/10 rounded px-4 py-2 text-deep-tidal-teal-800 focus:outline-none focus:border-deep-tidal-teal focus:ring-2 focus:ring-deep-tidal-teal'
											/>
										</div>
										<div className='checkout-address-grid'>
											<div>
												<label className='block text-[0.9rem] font-regular mb-1 text-deep-tidal-teal-800'>Town / City *</label>
												<input
													type='text'
													value={formData.city}
													onChange={(e) => setFormData({ ...formData, city: e.target.value })}
													onBlur={(e) => {
														const capitalized = capitalizeWords(e.target.value);
														if (capitalized !== e.target.value) {
															setFormData((prev) => ({ ...prev, city: capitalized }));
														}
													}}
													autoComplete='address-level2'
													className='w-full bg-white border border-black/10 rounded px-4 py-2 text-deep-tidal-teal-800 focus:outline-none focus:border-deep-tidal-teal focus:ring-2 focus:ring-deep-tidal-teal'
													required
												/>
											</div>
											<div>
												<label className='block text-[0.9rem] font-regular mb-1 text-deep-tidal-teal-800'>Province *</label>
												<select
													value={formData.province}
													onChange={(e) => setFormData({ ...formData, province: e.target.value })}
													autoComplete='address-level1'
													className='w-full bg-white border border-black/10 rounded px-4 py-2 text-deep-tidal-teal-800 focus:outline-none focus:border-deep-tidal-teal focus:ring-2 focus:ring-deep-tidal-teal'
													required>
													{CANADIAN_PROVINCES.map(({ name, code }) => (
														<option
															key={code}
															value={name}>
															{code}
														</option>
													))}
												</select>
											</div>
											<div>
												<label className='block text-[0.9rem] font-regular mb-1 text-deep-tidal-teal-800'>Postal code *</label>
												<input
													type='text'
													value={formData.zipCode}
													onChange={(e) => setFormData({ ...formData, zipCode: e.target.value.toUpperCase().slice(0, 7) })}
													onBlur={(e) => {
														let v = e.target.value.toUpperCase().replace(/\s/g, '');
														if (v.length >= 4 && !v.includes(' ')) {
															v = v.slice(0, 3) + ' ' + v.slice(3);
														}
														if (v !== e.target.value) {
															setFormData((prev) => ({ ...prev, zipCode: v }));
														}
													}}
													autoComplete='postal-code'
													placeholder=''
													maxLength={7}
													className={`w-full bg-white border rounded px-4 py-2 text-deep-tidal-teal-800 focus:outline-none focus:ring-2 focus:ring-deep-tidal-teal ${billingZipInvalidFormat ? 'border-red-500 focus:border-red-500' : 'border-black/10 focus:border-deep-tidal-teal'}`}
													required
												/>
												{billingZipInvalidFormat && <p className='text-sm text-red-600 mt-1'>Please use format A1A 1A1.</p>}
											</div>
										</div>

										<div className='flex items-start gap-2 text-sm text-deep-tidal-teal-800'>
											<input
												id='checkout-ship-different'
												type='checkbox'
												checked={shipToDifferentAddress}
												onChange={(e) => setShipToDifferentAddress(e.target.checked)}
												className='mt-1'
												aria-describedby={shipToDifferentAddress ? 'shipping-address-fields' : undefined}
											/>
											<label htmlFor='checkout-ship-different'>Ship to a different address?</label>
										</div>
										{shipToDifferentAddress && (
											<div
												id='shipping-address-fields'
												className='space-y-4 rounded-lg bg-mineral-white border border-black/10 p-4'>
												<div>
													<label className='block text-[0.9rem] font-regular mb-1 text-deep-tidal-teal-800'>Street address *</label>
													<input
														type='text'
														value={shippingAddress.address}
														onChange={(e) => setShippingAddress({ ...shippingAddress, address: e.target.value })}
														onBlur={(e) => {
															const capitalized = capitalizeWords(e.target.value);
															if (capitalized !== e.target.value) {
																setShippingAddress((prev) => ({ ...prev, address: capitalized }));
															}
														}}
														placeholder='House number and street name'
														autoComplete='shipping address-line1'
														className='w-full bg-white border border-black/10 rounded px-4 py-2 text-deep-tidal-teal-800 focus:outline-none focus:border-deep-tidal-teal focus:ring-2 focus:ring-deep-tidal-teal'
														required
													/>
												</div>
												<div>
													<label className='block text-[0.9rem] font-regular mb-1 text-deep-tidal-teal-800'>Apartment, suite, unit, etc.</label>
													<input
														type='text'
														value={shippingAddress.addressLine2}
														onChange={(e) => setShippingAddress({ ...shippingAddress, addressLine2: e.target.value })}
														onBlur={(e) => {
															const capitalized = capitalizeWords(e.target.value);
															if (capitalized !== e.target.value) {
																setShippingAddress((prev) => ({ ...prev, addressLine2: capitalized }));
															}
														}}
														placeholder='Apartment, suite, unit, etc. (optional)'
														autoComplete='shipping address-line2'
														className='w-full bg-white border border-black/10 rounded px-4 py-2 text-deep-tidal-teal-800 focus:outline-none focus:border-deep-tidal-teal focus:ring-2 focus:ring-deep-tidal-teal'
													/>
												</div>
												<div className='checkout-address-grid'>
													<div>
														<label className='block text-[0.9rem] font-regular mb-1 text-deep-tidal-teal-800'>Town / City *</label>
														<input
															type='text'
															value={shippingAddress.city}
															onChange={(e) => setShippingAddress({ ...shippingAddress, city: e.target.value })}
															onBlur={(e) => {
																const capitalized = capitalizeWords(e.target.value);
																if (capitalized !== e.target.value) {
																	setShippingAddress((prev) => ({ ...prev, city: capitalized }));
																}
															}}
															autoComplete='shipping address-level2'
															className='w-full bg-white border border-black/10 rounded px-4 py-2 text-deep-tidal-teal-800 focus:outline-none focus:border-deep-tidal-teal focus:ring-2 focus:ring-deep-tidal-teal'
															required
														/>
													</div>
													<div>
														<label className='block text-[0.9rem] font-regular mb-1 text-deep-tidal-teal-800'>Province *</label>
														<select
															value={shippingAddress.province}
															onChange={(e) => setShippingAddress({ ...shippingAddress, province: e.target.value })}
															autoComplete='shipping address-level1'
															className='w-full bg-white border border-black/10 rounded px-4 py-2 text-deep-tidal-teal-800 focus:outline-none focus:border-deep-tidal-teal focus:ring-2 focus:ring-deep-tidal-teal'
															required>
															{CANADIAN_PROVINCES.map(({ name, code }) => (
																<option
																	key={code}
																	value={name}>
																	{code}
																</option>
															))}
														</select>
													</div>
													<div>
														<label className='block text-[0.9rem] font-regular mb-1 text-deep-tidal-teal-800'>Postal code *</label>
														<input
															type='text'
															value={shippingAddress.zipCode}
															onChange={(e) => setShippingAddress({ ...shippingAddress, zipCode: e.target.value.toUpperCase().slice(0, 7) })}
															onBlur={(e) => {
																let v = e.target.value.toUpperCase().replace(/\s/g, '');
																if (v.length >= 4 && !v.includes(' ')) {
																	v = v.slice(0, 3) + ' ' + v.slice(3);
																}
																if (v !== e.target.value) {
																	setShippingAddress((prev) => ({ ...prev, zipCode: v }));
																}
															}}
															autoComplete='shipping postal-code'
															placeholder='A1A 1A1'
															maxLength={7}
															className={`w-full bg-white border rounded px-4 py-2 text-deep-tidal-teal-800 focus:outline-none focus:ring-2 focus:ring-deep-tidal-teal ${shippingZipInvalidFormat ? 'border-red-500 focus:border-red-500' : 'border-black/10 focus:border-deep-tidal-teal'}`}
															required
														/>
														{shippingZipInvalidFormat && <p className='text-sm text-red-600 mt-1'>Please use format A1A 1A1.</p>}
													</div>
												</div>
											</div>
										)}
										<div>
											{!showOrderNotes ? (
												<button
													type='button'
													onClick={() => setShowOrderNotes(true)}
													className='text-deep-tidal-teal-600 hover:text-deep-tidal-teal-800 text-[0.9rem]'>
													+ Add order notes (optional)
												</button>
											) : (
												<>
													<label className='block text-[0.9rem] font-regular mb-1 text-deep-tidal-teal-800'>Order notes (optional)</label>
													<textarea
														value={formData.orderNotes}
														onChange={(e) => setFormData({ ...formData, orderNotes: e.target.value })}
														placeholder='Notes about your order, e.g. special notes for delivery.'
														className='w-full min-h-[120px] bg-white border border-black/10 rounded px-4 py-2 text-deep-tidal-teal-800 focus:outline-none focus:border-deep-tidal-teal focus:ring-2 focus:ring-deep-tidal-teal'
													/>
												</>
											)}
										</div>
									</fieldset>
								</form>
							</div>
							<div className='mt-5 border-t border-deep-tidal-teal/10 pt-4'>
								<h3 className='mb-2 text-[0.9rem] font-semibold text-deep-tidal-teal-800'>Privacy Notice</h3>
								<p className='text-sm text-deep-tidal-teal-700 text-pretty'>
									We use your details to process and support your order. Card details are entered with our payment processor.
								</p>
								{abandonedCartAvailability.available && (
									<div className='mt-4'>
										<label htmlFor='checkout-cart-reminder' className='flex cursor-pointer items-start gap-3'>
											<input
												id='checkout-cart-reminder'
												type='checkbox'
												checked={abandonedCartConsent}
												onChange={(event) => {
													if (event.target.checked) {
														abandonedCartConsentAtRef.current = new Date().toISOString();
														setAbandonedCartConsent(true);
													} else {
														cancelAbandonedCartReminder();
													}
												}}
												className='mt-0.5 h-4 w-4 rounded border-deep-tidal-teal-300 text-deep-tidal-teal focus:ring-deep-tidal-teal'
											/>
											<span className='flex-1 text-sm text-deep-tidal-teal-800'>
												Pure Tide may email me one reminder about items left in my cart. I can unsubscribe at any time. This is optional.
												{abandonedCartAvailability.businessAddress && abandonedCartAvailability.contactEmail && (
													<span className='mt-1 block text-xs text-deep-tidal-teal-600'>
														Pure Tide, {abandonedCartAvailability.businessAddress}. Contact: {abandonedCartAvailability.contactEmail}.
													</span>
												)}
											</span>
										</label>
									</div>
								)}
							</div>
						</div>

							{/* Shipping Section */}
							<div className='bento-card p-5'>
								<h2 className='mb-3 text-lg font-semibold text-deep-tidal-teal-800'>Shipping</h2>
								<div className='flex items-center gap-3 rounded-xl border border-deep-tidal-teal bg-eucalyptus-50/50 px-4 py-3 ring-1 ring-deep-tidal-teal/20'>
									<input
										type='radio'
										name='shipping-method'
										checked
										readOnly
										aria-label='Express Shipping'
										className='h-4 w-4 shrink-0 accent-deep-tidal-teal'
									/>
									<span className='min-w-0 flex-1'>
										<span className='block font-semibold text-deep-tidal-teal-900'>Express Shipping</span>
										<span className='block text-sm text-deep-tidal-teal-600'>
											{shippingCost === 0 ? 'Free shipping applied to this order.' : 'Rate updates with your delivery postal code.'}
										</span>
									</span>
									<span className='shrink-0 font-semibold text-deep-tidal-teal-800'>{shippingCost === 0 ? 'Free' : `$${shippingCost.toFixed(2)}`}</span>
								</div>
							</div>

							{/* Payment Section */}
							<div className='bento-card p-5'>
								<h2 className='mb-4 text-lg font-semibold text-deep-tidal-teal-800'>Payment Method</h2>
								<div className='space-y-3'>
									<div
										className={`overflow-hidden rounded-xl border transition-colors ${
											!useCreditCard
												? 'border-deep-tidal-teal bg-eucalyptus-50/50 ring-1 ring-deep-tidal-teal/20'
												: 'border-deep-tidal-teal/20 bg-white hover:border-deep-tidal-teal/50'
										}`}>
										<label className='block cursor-pointer px-4 py-4'>
											<span className='flex items-center gap-3'>
												<input
													type='radio'
													name='payment'
													checked={!useCreditCard}
													onChange={() => setPaymentMethod('etransfer')}
													disabled={isProcessing}
													className='h-4 w-4 shrink-0 accent-deep-tidal-teal'
												/>
												<span className='min-w-0 flex-1'>
													<span className='block font-semibold text-base text-deep-tidal-teal-900'>Interac e-Transfer</span>
													<span className='mt-0.5 block text-sm text-deep-tidal-teal-600'>No fee · Payment details shown after you place your order</span>
												</span>
											</span>
										</label>
								{FRIENDS_FAMILY_ENABLED && paymentMethod === 'etransfer' && (
									<div className='mx-4 mb-4 border-t border-deep-tidal-teal/15 pt-3'>
										<div className='flex items-start justify-between gap-4'>
											<div>
												<p className='text-sm font-semibold text-deep-tidal-teal-800'>Friends & Family verification</p>
												<p className='text-sm text-deep-tidal-teal-700 mt-1'>
													If you&apos;re eligible, you can verify your email to use the Friends & Family e-Transfer flow.
												</p>
												{friendsFamilyVerified && <p className='text-xs text-emerald-700 mt-2'>Verified session active.</p>}
											</div>
											<button
												type='button'
												onClick={() => {
													setFriendsFamilyExpanded((v) => !v);
													setFriendsFamilyError(null);
													setFriendsFamilyMessage(null);
												}}
												className='text-sm font-semibold text-deep-tidal-teal hover:text-deep-tidal-teal-600'>
												{friendsFamilyExpanded ? 'Hide' : 'Verify'}
											</button>
										</div>

										{friendsFamilyExpanded && (
											<div className='mt-4 space-y-3'>
												{(friendsFamilyError || friendsFamilyMessage) && (
													<div
														className={`rounded-lg px-4 py-3 text-sm border ${
															friendsFamilyError ? 'bg-rose-50 border-rose-200 text-rose-800' : 'bg-emerald-50 border-emerald-200 text-emerald-800'
														}`}>
														{friendsFamilyError ?? friendsFamilyMessage}
													</div>
												)}
												<div className='grid grid-cols-1 md:grid-cols-3 gap-3'>
													<button
														type='button'
														disabled={friendsFamilyStartLoading || !formData.email.trim()}
														onClick={async () => {
															setFriendsFamilyStartLoading(true);
															setFriendsFamilyError(null);
															setFriendsFamilyMessage(null);
															setFriendsFamilyEligible(null);
															try {
																const response = await fetch('/api/friends-family/start', {
																	method: 'POST',
																	headers: { 'Content-Type': 'application/json' },
																	body: JSON.stringify({ email: formData.email }),
																});
																const data = (await response.json()) as { ok?: boolean; message?: string; error?: string; eligible?: boolean };
																if (!response.ok || data.ok === false) {
																	setFriendsFamilyError(data.error ?? 'We could not send the verification email. Please try again.');
																	setFriendsFamilyEligible(false);
																	return;
																}
																setFriendsFamilyMessage(data.message ?? 'If this email is eligible, a verification code has been sent.');
																setFriendsFamilyEligible(data.eligible ?? false);
															} catch (e) {
																setFriendsFamilyError(e instanceof Error ? e.message : 'We could not send the verification email. Please try again.');
																setFriendsFamilyEligible(false);
															} finally {
																setFriendsFamilyStartLoading(false);
															}
														}}
														className='site-cta cta-primary cta-compact'>
														{friendsFamilyStartLoading ? 'Sending...' : 'Send code'}
													</button>
													{friendsFamilyEligible === true && (
														<>
															<input
																type='text'
																value={friendsFamilyCode}
																onChange={(e) => setFriendsFamilyCode(e.target.value)}
																placeholder='6-digit code'
																inputMode='numeric'
																className='w-full bg-white border border-black/10 rounded-lg px-4 py-2 text-sm text-[#2f2f2f] focus:outline-none focus:border-[#6c5dd3] focus:ring-2 focus:ring-[#6c5dd3]/20'
															/>
															<button
																type='button'
																disabled={friendsFamilyVerifyLoading || !formData.email.trim() || friendsFamilyCode.trim().length !== 6}
																onClick={async () => {
																	setFriendsFamilyVerifyLoading(true);
																	setFriendsFamilyError(null);
																	setFriendsFamilyMessage(null);
																	try {
																		const response = await fetch('/api/friends-family/verify', {
																			method: 'POST',
																			headers: { 'Content-Type': 'application/json' },
																			credentials: 'include',
																			body: JSON.stringify({ email: formData.email, code: friendsFamilyCode }),
																		});
																		const data = (await response.json()) as { ok?: boolean; error?: string };
																		if (!response.ok || !data.ok) {
																			setFriendsFamilyError(data.error ?? 'Invalid verification code.');
																			return;
																		}
																		setFriendsFamilyVerified(true);
																		setFriendsFamilyMessage('Verification successful.');
																		setFriendsFamilyCode('');
																	} catch (e) {
																		setFriendsFamilyError(e instanceof Error ? e.message : 'Failed to verify code.');
																	} finally {
																		setFriendsFamilyVerifyLoading(false);
																	}
																}}
																className='bg-[#111111] text-white font-semibold px-4 py-2 rounded-lg disabled:opacity-50'>
																{friendsFamilyVerifyLoading ? 'Verifying...' : 'Verify'}
															</button>
														</>
													)}
												</div>
											</div>
										)}
									</div>
								)}
								</div>
							</div>
								{enableCreditCard && (
									<div
										className={`mt-3 overflow-hidden rounded-xl border transition-colors ${
											isCreditCardDisabled
												? 'cursor-not-allowed border-deep-tidal-teal/15 bg-slate-50 opacity-60'
												: paymentMethod === 'creditcard'
													? 'cursor-pointer border-deep-tidal-teal bg-eucalyptus-50/50 ring-1 ring-deep-tidal-teal/20'
													: 'cursor-pointer border-deep-tidal-teal/20 bg-white hover:border-deep-tidal-teal/50'
										}`}>
										<label className={`block px-4 py-4 ${isCreditCardDisabled ? 'cursor-not-allowed' : 'cursor-pointer'}`}>
											<span className='flex items-center gap-3'>
												<input
													type='radio'
													name='payment'
													checked={paymentMethod === 'creditcard'}
													onChange={() => setPaymentMethod('creditcard')}
													disabled={isProcessing || isCreditCardDisabled}
													className='h-4 w-4 shrink-0 accent-deep-tidal-teal'
												/>
												<span className='min-w-0 flex-1'>
													<span className='block font-semibold text-base text-deep-tidal-teal-900'>Credit card</span>
													<span className='mt-0.5 block text-sm text-deep-tidal-teal-600'>5% processing fee · Secure third-party checkout</span>
												</span>
											</span>
										</label>
										{paymentMethod === 'creditcard' && !isCreditCardDisabled && (
											<div
												className='mx-4 border-t border-deep-tidal-teal/15 pb-4 pt-3'
												role='status'>
												<label
													htmlFor='card-phone'
													className='block text-sm font-semibold text-deep-tidal-teal-800'>
													Phone Number *
												</label>
												<input
													id='card-phone'
													form='checkout-form'
													type='tel'
													value={formData.phone}
													onChange={(event) => setFormData({ ...formData, phone: event.target.value })}
													autoComplete='tel'
													maxLength={32}
													pattern={String.raw`\+?[0-9 \(\)\-]{7,32}`}
													title='Use 7 to 32 characters: digits, spaces, parentheses, hyphens, and an optional +.'
													className='mt-2 w-full bg-white border border-black/10 rounded px-4 py-2 text-deep-tidal-teal-800 focus:outline-none focus:border-deep-tidal-teal focus:ring-2 focus:ring-deep-tidal-teal'
													required
												/>
												<p className='mt-2 text-sm leading-relaxed text-deep-tidal-teal-700'>
													You&apos;ll be directed to our secure third-party card processor to complete payment.
												</p>
											</div>
										)}
									</div>
								)}
								{!enableCreditCard && <p className='mt-3 text-sm text-deep-tidal-teal-700'>Credit card payments are temporarily unavailable. Please use e-transfer.</p>}
								{isCreditCardOverLimit && (
									<div className='mt-3 bg-red-50 border border-red-200 rounded-lg p-3'>
										<p className='text-sm text-red-700 leading-relaxed'>
											Credit card payments are limited to $500 per transaction. Please select another payment method or split your order.
										</p>
									</div>
								)}
							</div>

						</div>
					</div>

					<div className='order-2 min-w-0 lg:order-2 lg:col-span-1'>
						<div
							className={`checkout-summary-card bento-card sticky top-24 p-5 lg:max-h-[calc(100dvh-7rem)] lg:overflow-y-auto lg:overscroll-contain ${isProcessing ? 'pointer-events-none opacity-75' : ''}`}
							aria-busy={isProcessing}
							aria-disabled={isProcessing}>
							<div className='flex items-center justify-between mb-4 pb-4 border-b border-deep-tidal-teal/10'>
								<h2 className='text-xl font-semibold text-deep-tidal-teal-800'>Order Summary</h2>
								<Link
									href='/cart'
									className='text-sm font-semibold text-deep-tidal-teal hover:text-deep-tidal-teal-600 transition-colors flex items-center gap-1'>
									<svg
										className='w-4 h-4'
										fill='none'
										stroke='currentColor'
										viewBox='0 0 24 24'>
										<path
											strokeLinecap='round'
											strokeLinejoin='round'
											strokeWidth={2}
											d='M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z'
										/>
									</svg>
									<span className='text-sm font-semibold underline'>Edit Cart</span>
								</Link>
							</div>

							<div className='mb-4'>
								{cartItems.map((item, index) => (
									<div
										key={item.id}
										className={`flex items-center gap-3 ${index < cartItems.length - 1 ? 'pb-4 mb-4 border-b border-deep-tidal-teal/10' : ''}`}>
										{/* Product Image */}
										<div className='w-14 h-14 flex-shrink-0 rounded-lg overflow-hidden flex items-center justify-center'>
											{hasProductImage(item.image) ? (
												<Image
													src={item.image}
													alt={item.name}
													width={56}
													height={56}
													className='w-full h-full object-contain'
													unoptimized={item.image.startsWith('http')}
												/>
											) : (
												<ProductImagePlaceholder className='w-14 h-14' />
											)}
										</div>

										{/* Product Details & Price */}
										<div className='flex-1 min-w-0'>
											<h3 className='text-sm font-semibold text-deep-tidal-teal-800 leading-tight'>
												{getProductDisplayName(item.name, item.mg, item.id !== item.slug)}
											</h3>
											<p
												className={`checkout-order-price text-base font-bold mt-0.5 ${promoApplied && appliedDiscount > 0 && isPromoEligibleItem(item) ? 'text-[#b42318]' : 'text-deep-tidal-teal'}`}>
												${(getDisplayPrice(item) * item.quantity).toFixed(2)}
												{item.quantity > 1 && <span className='text-xs font-normal text-deep-tidal-teal-600 ml-1'>(${getDisplayPrice(item).toFixed(2)} ea)</span>}
											</p>
											{promoApplied && appliedDiscount > 0 && isPromoEligibleItem(item) && (
												<p className='text-xs text-deep-tidal-teal-500 line-through'>${(item.price * item.quantity).toFixed(2)}</p>
											)}
										</div>

										{/* Quantity Display */}
										<div className='text-sm text-deep-tidal-teal-600'>Qty: {item.quantity}</div>
									</div>
								))}
							</div>

							{/* Promo Code */}
							<div className='mb-4 border-t border-deep-tidal-teal/10 pt-4'>
								<button
									type='button'
									onClick={() => !scheduledPromotion && setShowPromoInput(!showPromoInput)}
									className='flex items-center justify-between text-sm text-deep-tidal-teal-800 hover:text-deep-tidal-teal w-full'>
									<span>{scheduledPromotion ? `Sitewide ${scheduledPromotion.discount}% sale applied automatically` : 'Have a promo code?'}</span>
									{!scheduledPromotion && (
										<svg
											className={`w-4 h-4 transition-transform ${showPromoInput ? 'rotate-180' : ''}`}
											fill='none'
											stroke='currentColor'
											viewBox='0 0 24 24'>
											<path
												strokeLinecap='round'
												strokeLinejoin='round'
												strokeWidth={2}
												d='M19 9l-7 7-7-7'
											/>
										</svg>
									)}
								</button>
								{showPromoInput && !scheduledPromotion && (
									<div className='space-y-2 mt-2 animate-in fade-in slide-in-from-top-2 duration-300'>
										<div className='flex gap-2'>
											<input
												type='text'
												value={promoCode}
												onChange={(e) => setPromoCode(e.target.value)}
												placeholder='Promo code'
												disabled={isVerifyingPromo || Boolean(appliedPromoCode)}
												className='flex-1 bg-white border border-black/10 rounded px-4 py-2 text-sm text-deep-tidal-teal-800 focus:outline-none focus:border-deep-tidal-teal focus:ring-2 focus:ring-deep-tidal-teal/20 disabled:opacity-50'
											/>
											{appliedPromoCode ? (
												<button
													type='button'
													onClick={handleClearPromo}
													disabled={isVerifyingPromo}
													className='site-cta cta-secondary cta-compact px-3'>
													Remove
												</button>
											) : (
												<button
													type='button'
													onClick={handleApplyPromo}
													disabled={isVerifyingPromo || !promoCode.trim()}
													className='site-cta cta-primary cta-compact'>
													{isVerifyingPromo ? '...' : 'Apply'}
												</button>
											)}
										</div>
										{promoError && <p className='text-xs text-red-500 font-medium'>{promoError}</p>}
										{(appliedDiscount > 0 || appliedFreeShipping) && (
											<p className='text-xs text-deep-tidal-teal-400 font-bold'>
												Promo applied!
												{appliedDiscount > 0 ? ` ${appliedDiscount}% off subtotal.` : ''}
												{appliedFreeShipping ? ' Free shipping.' : ''}
											</p>
										)}
									</div>
								)}
							</div>
							{/* Subtotal */}
							<div className='border-t border-deep-tidal-teal/10 pt-4 space-y-2 text-sm flex flex-col gap-3'>
								<div className='flex justify-between'>
									<span className='text-deep-tidal-teal-700 text-[15px]'>{appliedDiscount > 0 ? 'Original subtotal' : 'Subtotal'}</span>
									<span className='checkout-subtotal-price text-deep-tidal-teal-500 font-semibold text-lg'>${subtotal.toFixed(2)}</span>
								</div>
								{appliedDiscount > 0 && (
									<>
										<div className='flex justify-between text-deep-tidal-teal font-bold'>
											<span className='checkout-discount-amount text-lg'>
												{scheduledPromotion ? 'Sitewide discount' : 'Discount'} ({appliedDiscount}%)
											</span>
											<span className='checkout-discount-amount text-lg'>-${discountAmount.toFixed(2)}</span>
										</div>
										<div className='flex justify-between text-deep-tidal-teal-700'>
											<span>Merchandise subtotal</span>
											<span className='font-semibold'>${subtotalAfterDiscounts.toFixed(2)}</span>
										</div>
									</>
								)}
								<div className='border-tpt-4 flex justify-between'>
									<span className='text-deep-tidal-teal-700'>Shipping</span>
									<span className='text-deep-tidal-teal-500 font-semibold'>{shippingCost === 0 ? 'Free' : `$${shippingCost.toFixed(2)}`}</span>
								</div>

								{/* Card Fee */}
								{cardFee > 0 && (
									<div className='flex justify-between text-deep-tidal-teal-600'>
										<span>Card Fee (5%)</span>
										<span>${cardFee.toFixed(2)}</span>
									</div>
								)}

								<div className='checkout-total-row border-t border-deep-tidal-teal/10 pt-3 flex justify-between text-xl font-semibold'>
									<span className='text-deep-tidal-teal-800'>Total</span>
									<span className='text-deep-tidal-teal'>${total.toFixed(2)}</span>
								</div>
							</div>
							<div className='sticky bottom-0 z-10 mt-4 border-t border-deep-tidal-teal/10 bg-white pt-4'>
								{checkoutError && (
									<div
										role='alert'
										className='mb-4 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800'>
										<p className='min-w-0 flex-1'>{checkoutError}</p>
										<button
											type='button'
											onClick={() => setCheckoutError(null)}
											aria-label='Dismiss error'
											className='shrink-0 font-semibold text-red-700'>
											×
										</button>
									</div>
								)}
								<div className='flex items-start gap-3'>
									<input
										id='checkout-terms'
										type='checkbox'
										form='checkout-form'
										checked={agreedToTerms}
										onChange={(event) => setAgreedToTerms(event.target.checked)}
										className='mt-0.5 h-4 w-4 shrink-0 accent-deep-tidal-teal'
										required
									/>
									<span className='text-sm text-deep-tidal-teal-800'>
										<label
											htmlFor='checkout-terms'
											className='cursor-pointer'>
											I agree to the{' '}
										</label>
										<button
											type='button'
											onClick={() => setShowTermsModal(true)}
											className='font-medium text-deep-tidal-teal underline hover:text-eucalyptus'>
											Terms & Conditions
										</button>
									</span>
								</div>
								<button
									type='submit'
									form='checkout-form'
									disabled={isProcessing || isVerifyingPromo || !agreedToTerms}
									aria-busy={isProcessing}
									className='site-cta cta-primary mt-4 w-full text-[0.8rem]'>
									<span className='inline-flex items-center justify-center gap-2'>
										{isProcessing && (
											<Loader2
												className='h-5 w-5 animate-spin'
												aria-hidden='true'
											/>
										)}
										<span>
											{isProcessing
												? useCreditCard
													? 'Preparing Secure Payment...'
													: 'Placing Order...'
												: useCreditCard
													? 'Continue to Card Checkout'
													: 'Place Order'}
										</span>
									</span>
								</button>
								{!agreedToTerms && <p className='mt-2 text-center text-xs text-deep-tidal-teal-600'>Agree to the terms to continue.</p>}
							</div>
						</div>
					</div>
				</div>
			</div>

			{/* Terms & Conditions Modal */}
			{showTermsModal && (
				<div className='fixed inset-0 z-[200] flex items-center justify-center overflow-hidden bg-black/50 p-3 sm:p-6'>
					<div
						role='dialog'
						aria-modal='true'
						aria-labelledby='terms-modal-title'
						className='flex max-h-[calc(100dvh-1.5rem)] w-full max-w-3xl flex-col overflow-hidden rounded-xl bg-white shadow-2xl sm:max-h-[calc(100dvh-3rem)]'>
						<div className='flex shrink-0 items-center justify-between gap-4 border-b border-gray-200 px-4 py-3 sm:px-6 sm:py-4'>
							<h2
								id='terms-modal-title'
								className='text-xl font-bold leading-tight text-deep-tidal-teal-800 sm:text-2xl'>
								Terms & Conditions
							</h2>
							<button
								type='button'
								onClick={() => setShowTermsModal(false)}
								aria-label='Close terms and conditions'
								className='flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-3xl leading-none text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-deep-tidal-teal/40'>
								<span aria-hidden='true'>×</span>
							</button>
						</div>
						<div className='min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-5 text-deep-tidal-teal-800 sm:p-6'>
							<TermsContent />
						</div>
						<div className='grid shrink-0 grid-cols-2 gap-3 border-t border-gray-200 px-4 py-3 sm:flex sm:justify-end sm:px-6 sm:py-4'>
							<button
								type='button'
								onClick={() => setShowTermsModal(false)}
								className='site-cta cta-secondary min-h-11 sm:px-6'>
								Close
							</button>
							<button
								type='button'
								onClick={() => {
									setAgreedToTerms(true);
									setShowTermsModal(false);
								}}
								className='site-cta cta-primary min-h-11 sm:px-6'>
								I Agree
							</button>
						</div>
					</div>
				</div>
			)}
		</div>
	);
}
