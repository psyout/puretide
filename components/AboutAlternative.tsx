import { ArrowDownRight, Check, FlaskConical, Leaf, Waves } from 'lucide-react';

const principles = [
	{
		number: '01',
		title: 'Scientific integrity',
		body: 'We bridge advanced peptide research and everyday routines with a clear, evidence-led approach.',
		icon: FlaskConical,
	},
	{
		number: '02',
		title: 'Purposeful performance',
		body: 'High-purity, stable peptides and considered protocols—built to make informed wellness feel approachable.',
		icon: Leaf,
	},
	{
		number: '03',
		title: 'Long-term vitality',
		body: 'Clean application, practical guidance, and thoughtful details designed to support consistent progress.',
		icon: Waves,
	},
];

const approach = [
	{
		title: 'Precision Wellness, Refined.',
		body: 'Pure Tide blends scientific precision with everyday vitality. Each protocol is built to feel effortless while staying rooted in research and real-world performance.',
	},
	{
		title: 'Nature-Inspired. Science-Refined.',
		body: 'Powered by peptides and guided by scientific research, our formulations prioritize purity, stability, and evidence-based application.',
	},
	{
		title: 'Clean. Calm. Confident.',
		body: 'From formulation to design, every detail is intentional — wellness without overwhelm, performance without compromise.',
	},
];

export default function AboutAlternative() {
	return (
		<section
			id='about'
			aria-labelledby='about-alternative-title'
			className='overflow-hidden bg-[#f3f4f4]'>
			<div className='mx-auto max-w-7xl px-6 py-20 sm:py-24 lg:py-28'>
				<div className='grid items-end gap-10 border-b border-deep-tidal-teal-800/15 pb-14 lg:grid-cols-[1.35fr_0.65fr] lg:gap-20 lg:pb-20'>
					<div>
						<p className='mb-6 flex items-center gap-3 text-xs font-bold uppercase tracking-[0.24em] text-deep-tidal-teal-600'>
							<span className='h-px w-10 bg-deep-tidal-teal-500' />
							About Pure Tide
						</p>
						<h2
							id='about-alternative-title'
							className='max-w-4xl text-4xl font-bold leading-tight tracking-tight text-deep-tidal-teal-800 sm:text-5xl'>
							Wellness should feel precise,
							<span className='block font-medium text-deep-tidal-teal'> never complicated.</span>
						</h2>
					</div>

					<div className='max-w-md lg:justify-self-end'>
						<p className='text-lg font-medium leading-relaxed text-deep-tidal-teal-700/80'>
							Pure Tide brings research, purity, and practical guidance together—so evidence-based wellness fits naturally into real life.
						</p>
						<a
							href='#products'
							className='mt-8 inline-flex items-center gap-2 border-b border-deep-tidal-teal-700 pb-1 text-sm font-bold text-deep-tidal-teal-800 transition-colors hover:border-deep-tidal-teal hover:text-deep-tidal-teal'>
							Explore our approach
							<ArrowDownRight className='h-4 w-4' />
						</a>
					</div>
				</div>

				<div className='grid gap-8 pt-14 lg:grid-cols-[0.72fr_1.28fr] lg:gap-8 lg:pt-20'>
					<div className='relative overflow-hidden rounded-xl bg-gradient-to-br from-eucalyptus-50 via-mineral-white to-deep-tidal-teal/10 p-8 text-deep-tidal-teal-800 shadow-md ui-border sm:p-10 lg:min-h-[31rem] lg:p-12'>
						<div
							aria-hidden='true'
							className='absolute -right-24 -top-24 h-72 w-72 rounded-full border-[3.5rem] border-deep-tidal-teal/5'
						/>
						<div className='relative flex h-full flex-col'>
							<div className='flex h-12 w-12 items-center justify-center rounded-full bg-eucalyptus text-deep-tidal-teal-800'>
								<Check className='h-6 w-6' strokeWidth={2.5} />
							</div>
							<p className='mt-16 max-w-sm text-2xl font-bold leading-snug tracking-tight sm:text-3xl lg:mt-auto'>
								“Every detail is considered—from research and sourcing to how wellness fits into your day.”
							</p>
							<div className='mt-10 flex items-center gap-3 border-t border-deep-tidal-teal/10 pt-6 text-sm font-semibold text-deep-tidal-teal-700'>
								<span className='h-2 w-2 rounded-full bg-eucalyptus' />
								The Pure Tide standard
							</div>
						</div>
					</div>

					<div className='divide-y divide-deep-tidal-teal/10 rounded-lg bg-mineral-white p-8 shadow-md ui-border sm:p-10'>
						{principles.map((principle) => {
							const Icon = principle.icon;

							return (
								<article
									key={principle.number}
									className='group grid gap-5 py-8 first:pt-0 last:pb-0 sm:grid-cols-[3rem_1fr_auto] sm:items-start sm:gap-6'>
									<span className='text-sm font-bold tracking-[0.12em] text-deep-tidal-teal-500'>{principle.number}</span>
									<div>
										<h3 className='text-2xl font-bold tracking-tight text-deep-tidal-teal-800 sm:text-3xl'>{principle.title}</h3>
										<p className='mt-3 max-w-xl text-base font-medium leading-relaxed text-deep-tidal-teal-700/70 sm:text-lg'>{principle.body}</p>
									</div>
									<div className='flex h-12 w-12 items-center justify-center rounded-full border border-deep-tidal-teal-800/15 text-deep-tidal-teal transition-colors group-hover:border-deep-tidal-teal group-hover:bg-white/60'>
										<Icon className='h-5 w-5' strokeWidth={1.8} />
									</div>
								</article>
							);
						})}
					</div>
				</div>

				<div className='mt-20 border-t border-deep-tidal-teal/10 pt-14 lg:mt-24 lg:pt-16'>
					<div className='mb-10 grid gap-5 lg:grid-cols-[0.72fr_1.28fr] lg:gap-20'>
						<p className='text-xs font-bold uppercase tracking-[0.24em] text-deep-tidal-teal-600'>Our philosophy</p>
						<h3 className='max-w-2xl text-3xl font-bold leading-tight tracking-[-0.03em] text-deep-tidal-teal-800 sm:text-4xl'>
							The thinking behind our standard.
						</h3>
					</div>

					<div className='grid gap-6 lg:grid-cols-3'>
						{approach.map((item, index) => (
							<article
								key={item.title}
								className='rounded-lg bg-mineral-white p-8 shadow-md ui-border sm:p-10'>
								<span className='mb-10 block text-xs font-bold tracking-[0.16em] text-deep-tidal-teal-500'>0{index + 1}</span>
								<h4 className='text-2xl font-bold leading-tight tracking-[-0.02em] text-deep-tidal-teal-800'>{item.title}</h4>
								<p className='mt-5 text-base font-medium leading-relaxed text-deep-tidal-teal-700/70'>{item.body}</p>
							</article>
						))}
					</div>
				</div>
			</div>
		</section>
	);
}
