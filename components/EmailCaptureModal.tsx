'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface EmailCaptureModalProps {
	isOpen: boolean;
	onClose: () => void;
	onSuccess?: () => void;
	triggerRef?: React.RefObject<HTMLElement>;
}

export default function EmailCaptureModal({ isOpen, onClose, onSuccess, triggerRef }: EmailCaptureModalProps) {
	const [email, setEmail] = useState('');
	const [error, setError] = useState('');
	const [isLoading, setIsLoading] = useState(false);
	const [isSuccess, setIsSuccess] = useState(false);
	const modalRef = useRef<HTMLDivElement>(null);
	const emailInputRef = useRef<HTMLInputElement>(null);
	const previouslyFocusedRef = useRef<HTMLElement | null>(null);

	const handleClose = useCallback(() => {
		if (!isLoading) {
			onClose();
			setEmail('');
			setError('');
			setIsSuccess(false);
			setTimeout(() => {
				if (triggerRef?.current) {
					triggerRef.current.focus();
					return;
				}
				previouslyFocusedRef.current?.focus();
			}, 0);
		}
	}, [isLoading, onClose, triggerRef]);

	// Focus management
	useEffect(() => {
		if (isOpen && !isSuccess) {
			emailInputRef.current?.focus();
		}
	}, [isOpen, isSuccess]);

	// Handle ESC key
	useEffect(() => {
		const handleEscape = (e: KeyboardEvent) => {
			if (e.key === 'Escape' && isOpen) {
				onClose();
			}
		};

		if (isOpen) {
			document.addEventListener('keydown', handleEscape);
		}

		return () => {
			document.removeEventListener('keydown', handleEscape);
		};
	}, [isOpen, onClose]);

	useEffect(() => {
		if (!isOpen) return;
		previouslyFocusedRef.current = document.activeElement as HTMLElement | null;
	}, [isOpen]);

	// Focus trap
	useEffect(() => {
		if (!isOpen || !modalRef.current) return;

		const focusableElements = modalRef.current.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
		const firstElement = focusableElements[0] as HTMLElement;
		const lastElement = focusableElements[focusableElements.length - 1] as HTMLElement;

		const handleTab = (e: KeyboardEvent) => {
			if (e.key !== 'Tab') return;

			if (e.shiftKey) {
				if (document.activeElement === firstElement) {
					e.preventDefault();
					lastElement.focus();
				}
			} else {
				if (document.activeElement === lastElement) {
					e.preventDefault();
					firstElement.focus();
				}
			}
		};

		document.addEventListener('keydown', handleTab);
		return () => document.removeEventListener('keydown', handleTab);
	}, [isOpen]);

	// Click outside to close
	useEffect(() => {
		if (!isOpen) return;

		const handlePointerDown = (e: MouseEvent) => {
			const target = e.target as Node | null;
			if (!target) return;
			if (!modalRef.current) return;
			if (!modalRef.current.contains(target)) {
				handleClose();
			}
		};

		document.addEventListener('mousedown', handlePointerDown);
		return () => document.removeEventListener('mousedown', handlePointerDown);
	}, [isOpen, handleClose]);

	const validateEmail = (email: string): boolean => {
		const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
		return emailRegex.test(email);
	};

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		setError('');

		if (!email.trim()) {
			setError('Please enter your email address');
			return;
		}

		if (!validateEmail(email)) {
			setError('Please enter a valid email address');
			return;
		}

		setIsLoading(true);

		try {
			const response = await fetch('/api/newsletter/subscribe', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
				},
				body: JSON.stringify({ email }),
			});

			const data = await response.json();

			if (!response.ok) {
				if (response.status === 409) {
					setError('This email has already subscribed');
				} else {
					setError(data.error || 'Something went wrong. Please try again.');
				}
				return;
			}

			setIsSuccess(true);
			onSuccess?.();

			setTimeout(() => {
				handleClose();
			}, 2500);
		} catch (err) {
			setError('Something went wrong. Please try again.');
		} finally {
			setIsLoading(false);
		}
	};

	return (
		<AnimatePresence>
			{isOpen && (
				<>
					{/* Floating widget */}
					<motion.div
						ref={modalRef}
						initial={{ x: 40, opacity: 0 }}
						animate={{ x: 0, opacity: 1 }}
						exit={{ x: 40, opacity: 0 }}
						transition={{ duration: 0.25, ease: 'easeOut' }}
						className='fixed left-4 right-4 top-[calc(max(var(--top-stack-height,0px),140px)+43px)] sm:left-auto sm:right-4 sm:w-[420px] sm:max-w-[440px] sm:top-[calc(max(var(--top-stack-height,0px),88px)+45px)] z-[130]'
						role='dialog'
						aria-modal='true'
						aria-labelledby='modal-title'>
						<div className='bg-white rounded-xl shadow-2xl p-6 sm:p-6 max-h-[80vh] overflow-y-auto z-10'>
							{isSuccess ? (
								<motion.div
									initial={{ opacity: 0, scale: 0.9 }}
									animate={{ opacity: 1, scale: 1 }}
									className='text-center py-10'>
									<div className='w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4'>
										<svg
											xmlns='http://www.w3.org/2000/svg'
											fill='none'
											viewBox='0 0 24 24'
											strokeWidth={2}
											stroke='currentColor'
											className='w-8 h-8 text-green-600'>
											<path
												strokeLinecap='round'
												strokeLinejoin='round'
												d='M4.5 12.75l6 6 9-13.5'
											/>
										</svg>
									</div>
									<h3
										id='modal-title'
										className='text-xl font-semibold text-deep-tidal-teal-700 mb-2'>
										You&apos;re all set!
									</h3>
									<p className='text-gray-600'>You&apos;re all set! Check your inbox for your 10% OFF code.</p>
									<button
										type='button'
										onClick={handleClose}
										className='mt-6 w-full bg-deep-tidal-teal-700 text-white py-2.5 rounded-lg font-semibold hover:bg-deep-tidal-teal-800 transition-colors focus:outline-none focus:ring-2 focus:ring-deep-tidal-teal-700 focus:ring-offset-2'>
										Got it
									</button>
								</motion.div>
							) : (
								<>
									<div className='flex justify-between items-start mb-4'>
										<div>
											<h2
												id='modal-title'
												className='text-xl font-semibold text-deep-tidal-teal-700'>
												Get 10% OFF Your First Order
											</h2>
											<p className='text-sm text-gray-600 mt-1'>Enter your email to unlock 10% OFF and receive exclusive offers and product updates</p>
										</div>
										<button
											type='button'
											onClick={handleClose}
											disabled={isLoading}
											aria-label='Close modal'
											className='text-gray-400 hover:text-gray-600 transition-colors p-1 focus:outline-none focus:ring-2 focus:ring-deep-tidal-teal-700 rounded disabled:opacity-50 disabled:cursor-not-allowed'>
											<svg
												xmlns='http://www.w3.org/2000/svg'
												fill='none'
												viewBox='0 0 24 24'
												strokeWidth={2}
												stroke='currentColor'
												className='w-6 h-6'>
												<path
													strokeLinecap='round'
													strokeLinejoin='round'
													d='M6 18L18 6M6 6l12 12'
												/>
											</svg>
										</button>
									</div>

									<form
										onSubmit={handleSubmit}
										className='space-y-4'>
										<div>
											<label
												htmlFor='email-input'
												className='block text-sm font-medium text-gray-700 mb-1'>
												Email Address
											</label>
											<input
												ref={emailInputRef}
												id='email-input'
												type='email'
												value={email}
												onChange={(e) => setEmail(e.target.value)}
												placeholder='you@example.com'
												disabled={isLoading}
												className={`w-full px-4 py-2.5 border rounded-lg focus:outline-none focus:ring-2 focus:ring-deep-tidal-teal-700 focus:border-transparent transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
													error ? 'border-red-500' : 'border-gray-300'
												}`}
												aria-invalid={error ? 'true' : 'false'}
												aria-describedby={error ? 'email-error' : undefined}
											/>
											{error && (
												<p
													id='email-error'
													className='mt-1 text-sm text-red-600'
													role='alert'>
													{error}
												</p>
											)}
										</div>

										<button
											type='submit'
											disabled={isLoading}
											className='w-full bg-deep-tidal-teal-700 text-white py-2.5 rounded-lg font-semibold hover:bg-deep-tidal-teal-800 transition-colors focus:outline-none focus:ring-2 focus:ring-deep-tidal-teal-700 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2'>
											{isLoading ? (
												<>
													<svg
														className='animate-spin h-5 w-5 text-white'
														xmlns='http://www.w3.org/2000/svg'
														fill='none'
														viewBox='0 0 24 24'>
														<circle
															className='opacity-25'
															cx='12'
															cy='12'
															r='10'
															stroke='currentColor'
															strokeWidth='4'
														/>
														<path
															className='opacity-75'
															fill='currentColor'
															d='M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z'
														/>
													</svg>
													Processing...
												</>
											) : (
												'Subscribe & get code'
											)}
										</button>
									</form>

									<p className='text-xs text-gray-500 text-left mt-4'>By subscribing, you agree to receive promotional emails. You can unsubscribe at any time.</p>
								</>
							)}
						</div>
					</motion.div>
				</>
			)}
		</AnimatePresence>
	);
}
