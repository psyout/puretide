'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { Product, CartItem } from '@/types/product';

interface CartContextType {
	cartItems: CartItem[];
	addToCart: (product: Product) => void;
	removeFromCart: (productId: string) => void;
	updateQuantity: (productId: string, quantity: number) => void;
	clearCart: () => void;
	getTotal: () => number;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

export function CartProvider({ children }: { children: React.ReactNode }) {
	const [cartItems, setCartItems] = useState<CartItem[]>([]);

	// Load cart from localStorage on mount (client-side only)
	useEffect(() => {
		if (typeof window !== 'undefined') {
			const savedCart = localStorage.getItem('privacy-shop-cart');
			if (savedCart) {
				try {
					setCartItems(JSON.parse(savedCart));
				} catch (e) {
					// Invalid JSON, start fresh
				}
			}
		}
	}, []);

	// Save cart to localStorage whenever it changes
	useEffect(() => {
		if (typeof window !== 'undefined') {
			localStorage.setItem('privacy-shop-cart', JSON.stringify(cartItems));
		}
	}, [cartItems]);

	const addToCart = (product: Product) => {
		setCartItems((prevItems) => {
			const existingItem = prevItems.find((item) => item.id === product.id);
			if (existingItem) {
				return prevItems.map((item) => (item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item));
			}
			return [...prevItems, { ...product, quantity: 1 }];
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
		return cartItems.reduce((total, item) => total + item.price * item.quantity, 0);
	};

	return (
		<CartContext.Provider
			value={{
				cartItems,
				addToCart,
				removeFromCart,
				updateQuantity,
				clearCart,
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
