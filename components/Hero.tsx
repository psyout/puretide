import HeroClient from './HeroClient';

const ENABLE_HERO_VIDEO = true;
const SHOW_THIRD_HERO_SLIDE = false;

const slides = [
	{
		backgroundImage: '/hero/hero-2-poster.jpg',
		video: ENABLE_HERO_VIDEO
			? {
					src: '/hero/hero-2.mp4',
					poster: '/hero/hero-2-poster.jpg',
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
	...(SHOW_THIRD_HERO_SLIDE
		? [
				{
					backgroundImage: '/hero/hero-4.webp',
					description: 'Science-informed wellness, refined. Thoughtfully sourced peptides studied for recovery, clarity, and longevity.',
				},
			]
		: []),
];

export default function Hero() {
	return <HeroClient slides={slides} />;
}
