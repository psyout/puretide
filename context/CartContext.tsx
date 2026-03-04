'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { Product, CartItem } from '@/types/product';
import { getDiscountedPrice } from '@/lib/pricing';

export type PaymentMethod = 'etransfer' | 'creditcard';

interface CartContextType {
	cartItems: CartItem[];
	paymentMethod: PaymentMethod;
	setPaymentMethod: (method: PaymentMethod) => void;
	addToCart: (product: Product, quantity?: number) => void;
	removeFromCart: (productId: string) => void;
	updateQuantity: (productId: string, quantity: number, maxQuantity?: number) => void;
	clearCart: () => void;
	getItemPrice: (item: CartItem) => number;
	getTotal: () => number;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

const PAYMENT_STORAGE_KEY = 'privacy-shop-payment-method';
const CART_STORAGE_KEY = 'privacy-shop-cart';
const CART_MAX_QUANTITY = 99;

function sanitizeCartItem(raw: unknown): CartItem | null {
	if (!raw || typeof raw !== 'object') return null;
	const item = raw as Partial<CartItem>;
	const id = typeof item.id === 'string' ? item.id.trim() : '';
	const slug = typeof item.slug === 'string' ? item.slug.trim() : id;
	const name = typeof item.name === 'string' ? item.name.trim() : '';
	const quantity = Number(item.quantity);
	const price = Number(item.price);
	const stock = Number(item.stock);

	if (!id || !name || !Number.isFinite(quantity) || quantity <= 0 || !Number.isFinite(price) || price < 0) {
		return null;
	}

	const safeStock = Number.isFinite(stock) && stock >= 0 ? stock : CART_MAX_QUANTITY;
	const maxQuantity = Math.min(Math.max(1, safeStock), CART_MAX_QUANTITY);

	return {
		id,
		slug,
		name,
		subtitle: typeof item.subtitle === 'string' ? item.subtitle : undefined,
		description: typeof item.description === 'string' ? item.description : '',
		details: typeof item.details === 'string' ? item.details : undefined,
		icons: Array.isArray(item.icons) ? item.icons.filter((entry): entry is string => typeof entry === 'string') : undefined,
		price,
		stock: safeStock,
		image: typeof item.image === 'string' ? item.image : '',
		category: typeof item.category === 'string' ? item.category : '',
		mg: typeof item.mg === 'string' ? item.mg : undefined,
		status: item.status,
		quantity: Math.min(Math.floor(quantity), maxQuantity),
	};
}

export function CartProvider({ children }: { children: React.ReactNode }) {
	const [cartItems, setCartItems] = useState<CartItem[]>([]);
	const [paymentMethod, setPaymentMethodState] = useState<PaymentMethod>('etransfer');
	const [isInitialized, setIsInitialized] = useState(false);

	const setPaymentMethod = (method: PaymentMethod) => {
		setPaymentMethodState(method);
		if (typeof window !== 'undefined') {
			localStorage.setItem(PAYMENT_STORAGE_KEY, method);
		}
	};

	const getItemPrice = (item: CartItem) => {
		return getDiscountedPrice(item.price, item.quantity);
	};

	// Load cart and payment method from localStorage on mount (client-side only)
	useEffect(() => {
		if (typeof window !== 'undefined') {
			const savedCart = localStorage.getItem(CART_STORAGE_KEY);
			if (savedCart) {
				try {
					const parsedCart = JSON.parse(savedCart);
					if (Array.isArray(parsedCart)) {
						const sanitized = parsedCart
							.map((entry) => sanitizeCartItem(entry))
							.filter((entry): entry is CartItem => entry != null);
						setCartItems(sanitized);
					}
				} catch (e) {
					console.error('Failed to parse cart from localStorage:', e);
					localStorage.removeItem(CART_STORAGE_KEY);
				}
			}
			// Always default to e-transfer on first render of a session.
			// When credit card is disabled via env, keep e-transfer.
			setPaymentMethodState('etransfer');
			localStorage.setItem(PAYMENT_STORAGE_KEY, 'etransfer');
			setIsInitialized(true);
		}
	}, []);

	// Save cart to localStorage whenever it changes, but only after initialization
	useEffect(() => {
		if (isInitialized && typeof window !== 'undefined') {
			localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cartItems));
		}
	}, [cartItems, isInitialized]);

	const addToCart = (product: Product, quantity = 1) => {
		const stock = Number(product.stock) || 0;
		const maxQ = stock > 0 ? Math.min(stock, CART_MAX_QUANTITY) : CART_MAX_QUANTITY;
		const toAdd = Math.min(Math.max(1, quantity), maxQ);
		setCartItems((prevItems) => {
			const existingItem = prevItems.find((item) => item.id === product.id);
			if (existingItem) {
				const newQ = Math.min(existingItem.quantity + toAdd, maxQ);
				return prevItems.map((item) => (item.id === product.id ? { ...item, quantity: newQ } : item));
			}
			return [...prevItems, { ...product, quantity: toAdd }];
		});
	};

	const removeFromCart = (productId: string) => {
		setCartItems((prevItems) => prevItems.filter((item) => item.id !== productId));
	};

	const updateQuantity = (productId: string, quantity: number, maxQuantity?: number) => {
		if (quantity <= 0) {
			removeFromCart(productId);
			return;
		}
		const capped = maxQuantity != null ? Math.min(quantity, Math.max(0, maxQuantity)) : Math.min(quantity, CART_MAX_QUANTITY);
		setCartItems((prevItems) => prevItems.map((item) => (item.id === productId ? { ...item, quantity: capped } : item)));
	};

	const clearCart = () => {
		setCartItems([]);
	};

	const getTotal = () => {
		return cartItems.reduce((total, item) => total + getItemPrice(item) * item.quantity, 0);
	};

	return (
		<CartContext.Provider
			value={{
				cartItems,
				paymentMethod,
				setPaymentMethod,
				addToCart,
				removeFromCart,
				updateQuantity,
				clearCart,
				getItemPrice,
				getTotal,
			}}>
			{children}
		</CartContext.Provider>
	);
}

export function useCart() {
	const context = useContext(CartContext);
	if (context === undefined) {
		throw new Error('useCart must be used within a CartProvider');
	}
	return context;
}
