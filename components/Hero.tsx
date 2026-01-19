'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import LogoHorizontal from './LogoHorizotal';

interface HeroSlide {
	backgroundImage: string;
	description: string;
}

const slides: HeroSlide[] = [
	{
		backgroundImage: '/hero/hero-1.jpg',
		description: 'Peptide-powered health designed to support vitality, performance, and balance. Clean formulations, precise protocols, and advanced research.',
	},
	{
		backgroundImage: '/hero/hero-2.jpg',
		description: 'Science-powered wellness, refined. Thoughtfully crafted peptides that elevate recovery, clarity, and longevity with quiet confidence.',
	},
];

export default function Hero() {
	const [currentIndex, setCurrentIndex] = useState(0);

	useEffect(() => {
		const interval = setInterval(() => {
			setCurrentIndex((prevIndex) => (prevIndex + 1) % slides.length);
		}, 7000); // Change slide every 6 seconds

		return () => clearInterval(interval);
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
		<section className='relative w-full h-screen overflow-hidden'>
			{/* Background image slider */}
			<div className='absolute inset-0 w-full h-full'>
				{slides.map((slide, index) => (
					<div
						key={index}
						className={`absolute inset-0 w-full h-full transition-opacity duration-1000 ${index === currentIndex ? 'opacity-100' : 'opacity-0'}`}>
						<Image
							src={slide.backgroundImage}
							alt={`Hero background ${index + 1}`}
							fill
							priority={index === 0}
							sizes='100vw'
							className='object-cover'
						/>
						<div className='absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(0,0,0,0.09),rgba(0,0,0,0.3))]' />
					</div>
				))}
			</div>

			{/* Text overlay */}
			<div className='relative z-10 h-full flex flex-col items-center justify-center container mx-auto px-4 text-center'>
				<div className='mb-8'>
					<LogoHorizontal
						className='h-32 lg:h-40 w-auto mx-auto drop-shadow-2xl'
						fillColor='fill-white drop-shadow-xl/50'
					/>
				</div>
				<p className='text-white text-xl lg:text-xl max-w-2xl mx-auto drop-shadow-xl/50 font-matimo'>{currentSlide.description}</p>
			</div>

			{/* Navigation arrows */}
			<button
				onClick={goToPrevious}
				className='absolute left-4 top-1/2 transform -translate-y-1/2 z-20 bg-white/20 hover:bg-white/30 backdrop-blur-sm rounded-full p-3 transition-all duration-300 group'
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
				className='absolute right-4 top-1/2 transform -translate-y-1/2 z-20 bg-white/20 hover:bg-white/30 backdrop-blur-sm rounded-full p-3 transition-all duration-300 group'
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
			<div className='absolute bottom-8 left-1/2 transform -translate-x-1/2 z-20 flex gap-3'>
				{slides.map((_, index) => (
					<button
						key={index}
						onClick={() => goToSlide(index)}
						className={`w-3 h-3 rounded-full transition-all duration-300 ${index === currentIndex ? 'bg-white w-8' : 'bg-white/50 hover:bg-white/75'}`}
						aria-label={`Go to slide ${index + 1}`}
					/>
				))}
			</div>
		</section>
	);
}
