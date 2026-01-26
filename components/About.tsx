import Image from 'next/image';
import { Leaf, FlaskConical, Waves } from 'lucide-react';
import AboutAccordion from './AboutAccordion';

export default function About() {
	const accordionItems = [
		{
			title: 'Precision Wellness, Refined.',
			body: 'Pure Tide blends clinical precision with everyday vitality. Each protocol is built to feel effortless while staying rooted in research and real-world performance.',
		},
		{
			title: 'Nature-Inspired. Science-Refined.',
			body: 'Powered by peptides and guided by clinical insight, our formulations prioritize purity, stability, and evidence-based application.',
		},
		{
			title: 'Clean. Calm. Confident.',
			body: 'From formulation to design, every detail is intentional — wellness without overwhelm, performance without compromise.',
		},
	];

	const highlights = [
		{
			title: 'A company built on',
			highlight: 'clinical trust.',
			body: 'We are a team of researchers and enthusiasts dedicated to bridging the gap between clinical science and your daily ritual.',
			icon: Leaf,
			colorClass: 'text-deep-tidal-teal',
		},
		{
			title: 'Purpose-driven',
			highlight: 'performance.',
			body: 'Pure Tide was created to solve one problem: accessibility to high-purity, stable peptides. We provide the tools you need for evidence-based wellness.',
			icon: FlaskConical,
			colorClass: 'text-deep-tidal-teal',
		},
		{
			title: 'Vitality for the',
			highlight: 'long term.',
			body: 'Our mission is to help you maintain peak performance without complication. Refined protocols, clean application, and visible results.',
			icon: Waves,
			colorClass: 'text-deep-tidal-teal',
		},
	];

	return (
		<section>
			<div className='relative w-full py-32 overflow-hidden'>
				<div className='absolute inset-0 z-0 '>
					<Image
						src='/background/05.webp'
						alt='Wellness background'
						fill
						className='object-cover'
					/>
				</div>

				<div className='relative z-10 mx-auto max-w-7xl px-6'>
					<h2 className='text-4xl md:text-5xl font-bold text-deep-tidal-teal-800 mb-12 tracking-tight'>Built for innovation. Focused on you.</h2>

					<div className='grid grid-cols-1 md:grid-cols-3 gap-6'>
						{highlights.map((item, index) => {
							const Icon = item.icon;
							return (
								<div
									key={index}
									className='bg-mineral-white rounded-xl p-10 flex flex-col min-h-[320px] hover:shadow-2xl hover:scale-103 transition-all duration-300 overflow-hidden shadow-sm group'>
									<div className='h-12 w-12 rounded-full bg-eucalyptus flex items-center justify-center mb-6'>
										<Icon className={`w-8 h-8 ${item.colorClass}`} />
									</div>
									<h3 className='text-2xl font-bold text-deep-tidal-teal-800 leading-tight mb-4'>
										{item.title} <span className={item.colorClass}>{item.highlight}</span>
									</h3>
									<p className='text-[#86868b] text-lg font-medium leading-relaxed flex-1'>{item.body}</p>
								</div>
							);
						})}
					</div>
				</div>
			</div>

			<div className='w-full bg-[#f5f5f7]/50 overflow-hidden'>
				<div className='grid grid-cols-1 lg:grid-cols-2 items-stretch min-h-[600px]'>
					<div className='order-1 lg:order-1 flex lg:justify-end items-center'>
						<div className='w-full lg:max-w-[640px] px-6 lg:pr-16 py-20 lg:py-32'>
							<h2 className='text-3xl lg:text-5xl font-bold text-deep-tidal-teal-800 mb-12 tracking-tight'>Precision Wellness, Refined.</h2>
							<AboutAccordion
								items={accordionItems}
								defaultOpenIndex={0}
							/>
						</div>
					</div>

					{/* Image Side - Edge to Edge */}
					<div className='order-2 lg:order-2 relative min-h-[400px] lg:min-h-full w-full overflow-hidden'>
						<Image
							src='/background/skin.webp'
							alt='Pure Tide wellness'
							fill
							sizes='(min-width: 1024px) 50vw, 100vw'
							className='object-cover'
							priority
						/>
					</div>
				</div>
			</div>
		</section>
	);
}
