'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { Product, CartItem } from '@/types/product';
import { getDiscountedPrice } from '@/lib/pricing';

interface CartContextType {
	cartItems: CartItem[];
	addToCart: (product: Product, quantity?: number) => void;
	removeFromCart: (productId: string) => void;
	updateQuantity: (productId: string, quantity: number) => void;
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
		setCartItems((prevItems) => {
			const existingItem = prevItems.find((item) => item.id === product.id);
			if (existingItem) {
				return prevItems.map((item) => (item.id === product.id ? { ...item, quantity: item.quantity + quantity } : item));
			}
			return [...prevItems, { ...product, quantity }];
		});
	};

	const removeFromCart = (productId: string) => {
		setCartItems((prevItems) => prevItems.filter((item) => item.id !== productId));
	};

	const updateQuantity = (productId: string, quantity: number) => {
		if (quantity <= 0) {
			removeFromCart(productId);
			return;
		}
		setCartItems((prevItems) => prevItems.map((item) => (item.id === productId ? { ...item, quantity } : item)));
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
