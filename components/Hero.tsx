import HeroClient from './HeroClient';

const ENABLE_HERO_VIDEO = true;

function isSaleHeroEnabled() {
	return String(process.env.SALE_HERO_ENABLED ?? '').trim().toLowerCase() === 'true';
}

const standardSlides = [
	{
		backgroundImage: '/hero/hero-2-poster.jpg',
		video: ENABLE_HERO_VIDEO
			? {
					src: '/hero/hero-2.mp4?v=20261112',
					mobileSrc: '/hero/hero-2-mobile.mp4?v=20261112',
					poster: '/hero/hero-2-poster.jpg?v=20261112',
				}
			: undefined,
		description: (
			<>
				<strong>The Pure Tide Promise:</strong>{' '}
				Science-backed. Designed with transparency at every step. Proudly Canadian.
			</>
		),
	},
	{
		backgroundImage: '/hero/hero-1.webp',
		description: (
			<>
				<strong>Quality You Can Verify:</strong>{' '}
				Third-party tested in Canada. GMP-grade standards. COAs for every batch.
			</>
		),
	},
	{
		backgroundImage: '/hero/hero-4.webp',
		description: 'Science-informed wellness, refined. Thoughtfully sourced peptides studied for recovery, clarity, and longevity.',
	},
];

const saleSlides = [
	{
		backgroundImage: '/hero/hero-2-poster.jpg',
		video: ENABLE_HERO_VIDEO
			? {
					src: '/hero/hero-2.mp4?v=20261112',
					mobileSrc: '/hero/hero-2-mobile.mp4?v=20261112',
					poster: '/hero/hero-2-poster.jpg?v=20261112',
				}
			: undefined,
		variant: 'sale' as const,
		eyebrow: 'The sale is on',
		title: 'Early Black Friday',
		offer: '25% off sitewide',
		description: 'Our biggest sale of the year, only for a limited time. No code needed.',
		cta: { label: 'Shop the sale', href: '#products' },
	},
];

export default function Hero() {
	return <HeroClient slides={isSaleHeroEnabled() ? saleSlides : standardSlides} />;
}
