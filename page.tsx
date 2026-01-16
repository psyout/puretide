import ProductGrid from '@/components/ProductGrid';
import Hero from '@/components/Hero';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import About from '@/components/About';
import Contact from '@/components/Contact';

export default function Home() {
	return (
		<div className='min-h-screen bg-gradient-to-br from-mineral-white via-deep-tidal-teal-50 to-eucalyptus-50'>
			<Header />

			<Hero />

			<main className='container mx-auto px-10'>
				<ProductGrid />
			</main>

			<About />

			<Contact />

			<Footer />
		</div>
	);
}
