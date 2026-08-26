'use client';

import React, { useState, useEffect } from 'react';
import Image from 'next/image';
import LogoHorizontal from './LogoHorizotal';

type HeroSlide = {
	backgroundImage?: string;
	video?: {
		src: string;
		poster: string;
	};
	description: React.ReactNode;
};

type HeroClientProps = {
	slides: HeroSlide[];
};

export default function HeroClient({ slides }: HeroClientProps) {
	const [currentIndex, setCurrentIndex] = useState(0);
	const [isMobile, setIsMobile] = useState(false);

	useEffect(() => {
		const interval = setInterval(() => {
			setCurrentIndex((prevIndex) => (prevIndex + 1) % slides.length);
		}, 7000); // Change slide every 6 seconds

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
								{/* Video slide */}
								<video
									src={slide.video.src}
									poster={slide.video.poster}
									autoPlay
									muted
									loop
									playsInline
									className='absolute inset-0 w-full h-full object-cover'
								/>
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
				<div className='absolute inset-0 z-[2] bg-gradient-to-b from-black/20 via-black/10 to-black/20 sm:bg-black/5' />
			</div>

			{/* Text overlay */}
			<div
				className='absolute inset-x-0 bottom-0 z-10 flex items-center justify-center'
				style={{ top: 'var(--site-header-height, 3.75rem)' }}>
				<div className='mx-auto flex max-w-7xl flex-col items-center px-6 text-center text-pretty'>
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

			{/* Navigation arrows */}
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

			{/* Navigation dots */}
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
		</section>
	);
}
