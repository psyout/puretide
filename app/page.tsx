import ProductGrid from '@/components/ProductGrid';
import Hero from '@/components/Hero';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import About from '@/components/About';
import Contact from '@/components/Contact';
import CanadaDayModal from '@/components/CanadaDayModal';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default function Home() {
	return (
		<div className='min-h-screen bg-gradient-to-br from-mineral-white via-eucalyptus-50 to-deep-tidal-teal-100'>
			<CanadaDayModal />
			<Header />

			<Hero />

			<main>
				<ProductGrid />
			</main>

			<About />

			<Contact />

			<Footer />
		</div>
	);
}
