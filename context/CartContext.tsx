'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { Product, CartItem } from '@/types/product';
import { getDiscountedPrice } from '@/lib/pricing';

interface CartContextType {
	cartItems: CartItem[];
	addToCart: (product: Product, quantity?: number) => void;
	removeFromCart: (productId: string) => void;
	updateQuantity: (productId: string, quantity: number, maxQuantity?: number) => void;
	clearCart: () => void;
	getItemPrice: (item: CartItem) => number;
	getTotal: () => number;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

export function CartProvider({ children }: { children: React.ReactNode }) {
	const [cartItems, setCartItems] = useState<CartItem[]>([]);
	const [isInitialized, setIsInitialized] = useState(false);

	const getItemPrice = (item: CartItem) => {
		return getDiscountedPrice(item.price, item.quantity);
	};

	const CART_MAX_QUANTITY = 99;

	// Load cart from localStorage on mount (client-side only)
	useEffect(() => {
		if (typeof window !== 'undefined') {
			const savedCart = localStorage.getItem('privacy-shop-cart');
			if (savedCart) {
				try {
					const parsedCart = JSON.parse(savedCart);
					if (Array.isArray(parsedCart)) {
						setCartItems(parsedCart);
					}
				} catch (e) {
					console.error('Failed to parse cart from localStorage:', e);
					localStorage.removeItem('privacy-shop-cart');
				}
			}
			setIsInitialized(true);
		}
	}, []);

	// Save cart to localStorage whenever it changes, but only after initialization
	useEffect(() => {
		if (isInitialized && typeof window !== 'undefined') {
			localStorage.setItem('privacy-shop-cart', JSON.stringify(cartItems));
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
