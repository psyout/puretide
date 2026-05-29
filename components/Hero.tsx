import HeroClient from './HeroClient';

const slides = [
	{
		backgroundImage: '/hero/hero-1.webp',
		description:
			'Unlock your potential with GMP grade purity. Our commitment to quality ensures every compound is third-party tested in Canada and held to the highest standards of stability and integrity',
	},
	{
		backgroundImage: '/hero/hero-2.webp',
		description: 'Peptide-powered formulations designed to support vitality, performance, and balance. Clean compounds, precise protocols, and rigorous third-party testing in Canada',
	},
	{
		backgroundImage: '/hero/hero-3.webp',
		description: 'Science-informed wellness, refined. Thoughtfully sourced peptides studied for recovery, clarity, and longevity.',
	},
];

export default function Hero() {
	return <HeroClient slides={slides} />;
}
