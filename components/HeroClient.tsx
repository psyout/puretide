'use client';

import React, { useState, useEffect } from 'react';
import Image from 'next/image';
import { LoaderCircle, ShoppingBag } from 'lucide-react';
import LogoHorizontal from './LogoHorizotal';

type HeroSlide = {
	backgroundImage?: string;
	video?: {
		src: string;
		mobileSrc?: string;
		poster: string;
	};
	variant?: 'default' | 'sale';
	eyebrow?: string;
	title?: string;
	offer?: string;
	description: React.ReactNode;
	cta?: { label: string; href: string };
};

type HeroClientProps = {
	slides: HeroSlide[];
};

export default function HeroClient({ slides }: HeroClientProps) {
	const [currentIndex, setCurrentIndex] = useState(0);
	const [isMobile, setIsMobile] = useState(false);
	const [readyVideos, setReadyVideos] = useState<Set<string>>(() => new Set());
	const [showVideoLoader, setShowVideoLoader] = useState(false);

	useEffect(() => {
		if (slides.length <= 1) return;
		const interval = setInterval(() => {
			setCurrentIndex((prevIndex) => (prevIndex + 1) % slides.length);
		}, 7000);

		return () => clearInterval(interval);
	}, [slides.length]);

	useEffect(() => {
		const m = window.matchMedia('(max-width: 639px)');
		setIsMobile(m.matches);
		const fn = () => setIsMobile(m.matches);
		m.addEventListener('change', fn);
		return () => m.removeEventListener('change', fn);
	}, []);

	const goToSlide = (index: number) => {
		setCurrentIndex(index);
	};

	const goToPrevious = () => {
		setCurrentIndex((prevIndex) => (prevIndex - 1 + slides.length) % slides.length);
	};

	const goToNext = () => {
		setCurrentIndex((prevIndex) => (prevIndex + 1) % slides.length);
	};

	const currentSlide = slides[currentIndex];
	const isSaleSlide = currentSlide.variant === 'sale';
	const hasMultipleSlides = slides.length > 1;
	const currentVideoSrc = currentSlide.video?.src;
	const currentVideoReady = !currentVideoSrc || readyVideos.has(currentVideoSrc);

	useEffect(() => {
		setShowVideoLoader(false);
		if (!currentVideoSrc || currentVideoReady) return;

		const showTimeout = window.setTimeout(() => setShowVideoLoader(true), 500);
		const hideTimeout = window.setTimeout(() => setShowVideoLoader(false), 12000);
		return () => {
			window.clearTimeout(showTimeout);
			window.clearTimeout(hideTimeout);
		};
	}, [currentVideoReady, currentVideoSrc]);

	const markVideoReady = (src: string) => {
		setReadyVideos((current) => {
			if (current.has(src)) return current;
			const next = new Set(current);
			next.add(src);
			return next;
		});
		setShowVideoLoader(false);
	};

	return (
		<section className='relative h-[100svh] w-full overflow-hidden'>
			{/* Background image/video slider */}
			<div className='absolute inset-0 w-full h-full'>
				{slides.map((slide, index) => (
					<div
						key={slide.backgroundImage || slide.video?.src}
						className={`absolute inset-0 w-full h-full transition-opacity duration-1000 ${index === currentIndex ? 'opacity-100' : 'opacity-0'}`}>
						{index === 1 ? <div className='absolute inset-0 bg-black/15 z-[1]' /> : null}
						{slide.video ? (
							<>
								<Image
									src={slide.video.poster}
									alt=''
									fill
									sizes='100vw'
									priority={index === 0}
									className='object-cover'
								/>
								<video
									autoPlay
									muted
									loop
									playsInline
									preload='auto'
									onCanPlay={() => markVideoReady(slide.video!.src)}
									onError={() => setShowVideoLoader(false)}
									className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-700 ${readyVideos.has(slide.video.src) ? 'opacity-100' : 'opacity-0'}`}>
									{slide.video.mobileSrc ? (
										<source
											media='(max-width: 639px)'
											src={slide.video.mobileSrc}
											type='video/mp4'
										/>
									) : null}
									<source
										src={slide.video.src}
										type='video/mp4'
									/>
								</video>
							</>
						) : slide.backgroundImage ? (
							<>
								{/* Image slide */}
								<div className='absolute inset-0 w-full h-full block sm:hidden blur-xs z-0'>
									<Image
										src={slide.backgroundImage}
										alt=''
										fill
										sizes='(min-width: 640px) 0vw, 100vw'
										priority={isMobile && index === 0}
										className='object-cover'
									/>
								</div>
								<Image
									src={slide.backgroundImage}
									alt={`Hero background ${index + 1}`}
									fill
									priority={!isMobile && index === 0}
									sizes='(max-width: 639px) 0vw, 100vw'
									className='object-cover hidden sm:block'
								/>
							</>
						) : null}
					</div>
				))}
				<div
					className={
						isSaleSlide
							? 'absolute inset-0 z-[2] bg-gradient-to-r from-[#062f36]/80 via-[#07343b]/55 to-[#062f36]/10'
							: 'absolute inset-0 z-[2] bg-gradient-to-b from-black/20 via-black/10 to-black/20 sm:bg-black/5'
					}
				/>
				{showVideoLoader && currentVideoSrc ? (
					<div
						className='absolute bottom-6 right-6 z-[4] flex h-10 w-10 items-center justify-center rounded-full border border-white/20 bg-deep-tidal-teal/65 text-white shadow-lg backdrop-blur-md'
						role='status'
						aria-label='Loading hero video'>
						<LoaderCircle
							className='h-5 w-5 animate-spin'
							aria-hidden='true'
						/>
					</div>
				) : null}
			</div>

			{/* Text overlay */}
			{isSaleSlide ? (
				<div
					className='absolute inset-x-0 bottom-0 z-10 flex items-center'
					style={{ top: 'var(--site-header-height, 3.75rem)' }}>
					<div className='mx-auto w-full max-w-6xl px-6 py-10 sm:px-8 lg:px-6'>
						<div className='max-w-[42rem] text-left text-white'>
							<Image
								src='/mineral-white-logo-simple.svg'
								alt='Pure Tide'
								width={1146}
								height={181}
								priority
								className='mb-7 h-auto w-44 drop-shadow-xl sm:mb-9 sm:w-60'
							/>
							<p className='mb-4 text-xs font-semibold uppercase tracking-[0.35em] text-muted-sage-200 sm:text-sm'>{currentSlide.eyebrow}</p>
							<h1 className='max-w-3xl text-[clamp(3rem,8vw,6.75rem)] font-bold uppercase leading-[0.9] tracking-[-0.035em] text-white drop-shadow-lg'>{currentSlide.title}</h1>
							<p className='mt-6 text-[clamp(2rem,4.5vw,4rem)] font-bold uppercase leading-none tracking-[-0.025em] text-[#78c9e7]'>{currentSlide.offer}</p>
							<p className='mt-6 max-w-2xl text-pretty text-base leading-relaxed text-white/95 sm:text-xl'>{currentSlide.description}</p>
							{currentSlide.cta ? (
								<a
									href={currentSlide.cta.href}
									className='sale-purchase-cta mt-8 inline-flex min-h-14 items-center justify-center gap-3 rounded-sm bg-white px-10 text-sm font-bold uppercase tracking-[0.18em] text-deep-tidal-teal-900 transition-colors duration-200 hover:bg-[#78c9e7] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white sm:min-w-72'>
									<span
										className='relative inline-flex h-6 w-6 shrink-0 items-center justify-center'
										aria-hidden='true'>
										<ShoppingBag
											className='sale-purchase-icon h-5 w-5'
											strokeWidth={1.8}
										/>
										<span className='sale-purchase-item' />
									</span>
									<span>{currentSlide.cta.label}</span>
								</a>
							) : null}
						</div>
					</div>
				</div>
			) : (
				<div
					className='absolute inset-x-0 bottom-0 z-10 flex items-center justify-center'
					style={{ top: 'var(--site-header-height, 3.75rem)' }}>
					<div className='mx-auto flex max-w-6xl flex-col items-center px-6 text-center text-pretty'>
						<div className='mb-4 lg:mb-6'>
							<LogoHorizontal
								className='mx-auto h-24 w-auto drop-shadow-2xl sm:h-28 md:h-32 lg:h-36'
								fillColor='fill-white drop-shadow-xl/50'
							/>
						</div>
						<p
							className='flex min-h-36 max-w-sm items-center justify-center text-base leading-relaxed text-white drop-shadow-[0_2px_10px_rgba(0,0,0,0.65)] sm:min-h-48 sm:max-w-lg sm:text-xl md:text-2xl lg:min-h-[5.25rem] lg:max-w-2xl lg:text-xl'
							aria-live='polite'>
							<span>{currentSlide.description}</span>
						</p>
					</div>
				</div>
			)}

			{/* Navigation arrows */}
			{hasMultipleSlides ? (
				<>
					<button
						onClick={goToPrevious}
						className='absolute left-4 top-1/2 z-20 hidden -translate-y-1/2 transform rounded-full bg-deep-tidal-teal/70 p-3 backdrop-blur-sm transition-all duration-300 hover:bg-deep-tidal-teal-600 sm:block group'
						style={{ top: 'calc((100% + var(--site-header-height, 3.75rem)) / 2)' }}
						aria-label='Previous slide'>
						<svg
							className='w-6 h-6 text-white group-hover:scale-110 transition-transform'
							fill='none'
							stroke='currentColor'
							viewBox='0 0 24 24'>
							<path
								strokeLinecap='round'
								strokeLinejoin='round'
								strokeWidth={2}
								d='M15 19l-7-7 7-7'
							/>
						</svg>
					</button>
					<button
						onClick={goToNext}
						className='absolute right-4 top-1/2 z-20 hidden -translate-y-1/2 transform rounded-full bg-deep-tidal-teal/70 p-3 backdrop-blur-sm transition-all duration-300 hover:bg-deep-tidal-teal-600 sm:block group'
						style={{ top: 'calc((100% + var(--site-header-height, 3.75rem)) / 2)' }}
						aria-label='Next slide'>
						<svg
							className='w-6 h-6 text-white group-hover:scale-110 transition-transform'
							fill='none'
							stroke='currentColor'
							viewBox='0 0 24 24'>
							<path
								strokeLinecap='round'
								strokeLinejoin='round'
								strokeWidth={2}
								d='M9 5l7 7-7 7'
							/>
						</svg>
					</button>
				</>
			) : null}

			{/* Navigation dots */}
			{hasMultipleSlides ? (
				<>
					<div className='absolute bottom-8 left-1/2 z-20 hidden -translate-x-1/2 transform gap-3 sm:flex'>
						{slides.map((_, index) => (
							<button
								key={index}
								onClick={() => goToSlide(index)}
								className={`w-3 h-3 rounded-full transition-all duration-300 ${index === currentIndex ? 'bg-deep-tidal-teal w-8' : 'bg-deep-tidal-teal/50 hover:bg-deep-tidal-teal/75'}`}
								aria-label={`Go to slide ${index + 1}`}
							/>
						))}
					</div>

					<div className='absolute bottom-7 left-1/2 z-20 flex -translate-x-1/2 items-center gap-4 sm:hidden'>
						<button
							onClick={goToPrevious}
							className='flex h-11 w-11 items-center justify-center rounded-full bg-deep-tidal-teal/80 text-white backdrop-blur-sm'
							aria-label='Previous slide'>
							<span aria-hidden='true'>←</span>
						</button>
						<div className='flex items-center gap-2'>
							{slides.map((_, index) => (
								<button
									key={index}
									onClick={() => goToSlide(index)}
									className={`h-2.5 rounded-full transition-all duration-300 ${index === currentIndex ? 'w-7 bg-white' : 'w-2.5 bg-white/55'}`}
									aria-label={`Go to slide ${index + 1}`}
									aria-current={index === currentIndex ? 'true' : undefined}
								/>
							))}
						</div>
						<button
							onClick={goToNext}
							className='flex h-11 w-11 items-center justify-center rounded-full bg-deep-tidal-teal/80 text-white backdrop-blur-sm'
							aria-label='Next slide'>
							<span aria-hidden='true'>→</span>
						</button>
					</div>
				</>
			) : null}
		</section>
	);
}
