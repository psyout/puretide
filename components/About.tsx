'use client';

import { useState } from 'react';
import Image from 'next/image';
import { Leaf, FlaskConical, Waves, Plus, Minus } from 'lucide-react';

export default function About() {
	const [openItem, setOpenItem] = useState<number | null>(0);
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

	return (
		<section>
			{/* Highlights */}
			<div className='grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-0 w-full'>
				<div className='bg-mineral-white px-8 py-18 pt-8 pb-8'>
					<div className='h-16 w-16 rounded-full bg-eucalyptus flex items-center justify-center'>
						<Leaf className='h-10 w-10 text-deep-tidal-teal' />
					</div>
					<h3 className='text-xl font-semibold text-deep-tidal-teal-800 mt-6'>WHY PURE TIDE</h3>
					<p className='text-deep-tidal-teal-700 mt-3'>
						Wellness should feel powerful — not complicated. Pure Tide bridges clinical precision with everyday vitality.
					</p>
				</div>
				<div className='relative min-h-[380px]'>
					<Image
						src='/background/02.jpg'
						alt='Clean wellness ritual'
						fill
						sizes='(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw'
						className='object-cover'
					/>
				</div>
				<div className='bg-eucalyptus-50 px-8 py-18 pt-8 pb-8'>
					<div className='h-16 w-16 rounded-full bg-eucalyptus flex items-center justify-center'>
						<FlaskConical className='h-10 w-10 text-deep-tidal-teal' />
					</div>
					<h3 className='text-xl font-semibold text-deep-tidal-teal-800 mt-6'>SCIENCE + CREDIBILITY</h3>
					<p className='text-deep-tidal-teal-700 mt-3 text-base'>
						Powered by peptides. Backed by research. Formulated with intention for purity, stability, and evidence-based application.
					</p>
				</div>
				<div className='relative min-h-[380px]'>
					<Image
						src='/background/03.jpg'
						alt='Scientific formulation'
						fill
						sizes='(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw'
						className='object-cover'
					/>
				</div>
				<div className='bg-mineral-white px-8 py-18 pt-8 pb-8'>
					<div className='h-16 w-16 rounded-full bg-eucalyptus flex items-center justify-center'>
						<Waves className='h-10 w-10 text-deep-tidal-teal' />
					</div>
					<h3 className='text-xl font-semibold text-deep-tidal-teal-800 mt-6'>THE EXPERIENCE</h3>
					<p className='text-deep-tidal-teal-700 mt-3'>
						Clean. Calm. Confident. Wellness without overwhelm — balanced, refined, and intuitive.
					</p>
				</div>
				<div className='relative min-h-[380px]'>
					<Image
						src='/background/skin.jpg'
						alt='Refined wellness space'
						fill
						sizes='(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw'
						className='object-cover'
					/>
				</div>
			</div>
			<div className='container mx-auto max-w-6xl px-6 my-28 sm:px-8'>
				<div className='grid grid-cols-1 lg:grid-cols-2 gap-12 items-center pb-24'>
					<h2 className='order-1 block text-3xl font-bold text-deep-tidal-teal-800 text-shadow-lg lg:hidden'>Precision Wellness, Refined.</h2>
					{/* Accordion */}
					<div className='order-3 lg:order-1 space-y-4'>
						<h2 className='hidden text-4xl font-bold text-deep-tidal-teal-800 text-shadow-lg lg:block'>Precision Wellness, Refined.</h2>
						<div className='space-y-3'>
							{accordionItems.map((item, index) => {
								const isOpen = openItem === index;
								return (
									<div
										key={item.title}
										className={`rounded-2xl bg-white/80 backdrop-blur-md shadow-lg overflow-hidden grid transition-[grid-template-rows] duration-300 ease-out ui-border ${
											isOpen ? 'grid-rows-[auto_1fr]' : 'grid-rows-[auto_0fr]'
										}`}>
										<button
											type='button'
											onClick={() => setOpenItem(isOpen ? null : index)}
											className='w-full flex items-center justify-between px-5 py-4 text-left text-deep-tidal-teal-800 font-semibold'>
											<span>{item.title}</span>
											{isOpen ? <Minus className='w-5 h-5 text-deep-tidal-teal' /> : <Plus className='w-5 h-5 text-deep-tidal-teal' />}
										</button>
										<div className='px-5 text-deep-tidal-teal-700 text-base overflow-hidden'>
											<div className={`pb-4 transition-opacity duration-300 ease-out ${isOpen ? 'opacity-100' : 'opacity-0'}`}>
												{item.body}
											</div>
										</div>
									</div>
								);
							})}
						</div>
					</div>

					{/* Image */}
					<div className='order-2 lg:order-2 relative h-[260px] sm:h-[400px] lg:h-[520px] w-full overflow-hidden rounded-2xl'>
						<Image
							src='/background/skin.jpg'
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
