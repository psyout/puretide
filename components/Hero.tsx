import HeroClient from './HeroClient';

const ENABLE_HERO_VIDEO = true;

const slides = [
	{
		backgroundImage: '/hero/hero-2-poster.jpg',
		video: ENABLE_HERO_VIDEO
			? {
					src: '/hero/hero-2.mp4',
					poster: '/hero/hero-2-poster.jpg',
				}
			: undefined,
		description: 'Peptide-powered formulations designed to support vitality, performance, and balance. Clean compounds, precise protocols, and rigorous third-party testing in Canada.',
	},
	{
		backgroundImage: '/hero/hero-4.webp',
		description:
			'Unlock your potential with GMP grade purity. Our commitment to quality ensures every compound is third-party tested in Canada and held to the highest standards of stability and integrity.',
	},
	{
		backgroundImage: '/hero/hero-5.webp',
		description: 'Science-informed wellness, refined. Thoughtfully sourced peptides studied for recovery, clarity, and longevity.',
	},
];

export default function Hero() {
	return <HeroClient slides={slides} />;
}
