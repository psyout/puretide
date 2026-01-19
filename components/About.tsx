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
		<section className='py-20 px-6 sm:px-8 bg-gradient-to-b from-mineral-white to-deep-tidal-teal-100'>
			<div className='container mx-auto max-w-6xl'>
				<div className='grid grid-cols-1 lg:grid-cols-2 gap-12 items-center'>
					{/* Accordion */}
					<div className='space-y-4'>
						<h2 className='text-4xl font-bold text-deep-tidal-teal-800 text-shadow-lg'>Precision Wellness, Refined.</h2>
						<div className='space-y-3'>
							{accordionItems.map((item, index) => {
								const isOpen = openItem === index;
								return (
									<div
										key={item.title}
										className={`rounded-2xl bg-white/80 backdrop-blur-md shadow-lg overflow-hidden grid transition-[grid-template-rows] duration-300 ease-out border border-black/10 ${
											isOpen ? 'grid-rows-[auto_1fr]' : 'grid-rows-[auto_0fr]'
										}`}>
										<button
											type='button'
											onClick={() => setOpenItem(isOpen ? null : index)}
											className='w-full flex items-center justify-between px-5 py-4 text-left text-deep-tidal-teal-800 font-semibold'>
											<span>{item.title}</span>
											{isOpen ? <Minus className='w-5 h-5 text-deep-tidal-teal' /> : <Plus className='w-5 h-5 text-deep-tidal-teal' />}
										</button>
										<div className='px-5 text-deep-tidal-teal-700 text-base leading-relaxed overflow-hidden'>
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
					<div className='relative h-[260px] sm:h-[400px] lg:h-[520px] w-full overflow-hidden rounded-2xl'>
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

				{/* Highlights */}
				<div className='grid grid-cols-1 md:grid-cols-3 gap-8 mt-16'>
					<div className='rounded-2xl bg-white/80 backdrop-blur-md p-6 pt-10 shadow-lg border border-black/10 relative'>
						<div className='absolute -top-6 left-6 h-16 w-16 rounded-full bg-mineral-white border border-muted-sage-300 shadow-md flex items-center justify-center'>
							<Leaf className='w-8 h-8 text-deep-tidal-teal' />
						</div>
						<h3 className='text-xl font-semibold text-deep-tidal-teal-800 mt-4'>WHY PURE TIDE</h3>
						<p className='text-deep-tidal-teal-700 mt-2'>
							Wellness should feel powerful — not complicated. Pure Tide bridges clinical precision with everyday vitality.
						</p>
						<div className='relative mt-4 h-40 w-full overflow-hidden rounded-xl'>
							<Image
								src='/background/02.jpg'
								alt='Clean wellness ritual'
								fill
								sizes='(min-width: 768px) 33vw, 100vw'
								className='object-cover'
							/>
						</div>
					</div>
					<div className='rounded-2xl bg-white/80 backdrop-blur-md p-6 pt-10 shadow-lg border border-black/10 relative'>
						<div className='absolute -top-6 left-6 h-16 w-16 rounded-full bg-mineral-white border border-muted-sage-300 shadow-md flex items-center justify-center'>
							<FlaskConical className='w-8 h-8 text-deep-tidal-teal' />
						</div>
						<h3 className='text-xl font-semibold text-deep-tidal-teal-800 mt-4'>SCIENCE + CREDIBILITY</h3>
						<p className='text-deep-tidal-teal-700 mt-2 text-base leading-relaxed'>
							Powered by peptides. Backed by research. Formulated with intention for purity, stability, and evidence-based application.
						</p>
						<div className='relative mt-4 h-40 w-full overflow-hidden rounded-xl'>
							<Image
								src='/background/03.jpg'
								alt='Scientific formulation'
								fill
								sizes='(min-width: 768px) 33vw, 100vw'
								className='object-cover'
							/>
						</div>
					</div>
					<div className='rounded-2xl bg-white/80 backdrop-blur-md p-6 pt-10 shadow-lg border border-black/10 relative'>
						<div className='absolute -top-6 left-6 h-16 w-16 rounded-full bg-mineral-white border border-muted-sage-300 shadow-md flex items-center justify-center'>
							<Waves className='w-8 h-8 text-deep-tidal-teal' />
						</div>
						<h3 className='text-xl font-semibold text-deep-tidal-teal-800 mt-4'>THE EXPERIENCE</h3>
						<p className='text-deep-tidal-teal-700 mt-2'>
							Clean. Calm. Confident. Wellness without overwhelm — balanced, refined, and intuitive.
						</p>
						<div className='relative mt-4 h-40 w-full overflow-hidden rounded-xl'>
							<Image
								src='/background/skin.jpg'
								alt='Refined wellness space'
								fill
								sizes='(min-width: 768px) 33vw, 100vw'
								className='object-cover'
							/>
						</div>
					</div>
				</div>
				<p className='text-deep-tidal-teal-800 text-lg font-semibold text-center mt-16'>Pure Tide is wellness, refined.</p>
			</div>
		</section>
	);
}
