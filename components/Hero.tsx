import HeroClient from './HeroClient';

const slides = [
	{
		backgroundImage: '/hero/hero-1.webp',
		description: 'Peptide-powered health designed to support vitality, performance, and balance. Clean formulations, precise protocols, and advanced research.',
	},
	{
		backgroundImage: '/hero/hero-2.webp',
		description: 'Science-powered wellness, refined. Thoughtfully crafted peptides that elevate recovery, clarity, and longevity with quiet confidence.',
	},
];

export default function Hero() {
	return <HeroClient slides={slides} />;
}
