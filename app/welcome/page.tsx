import Link from 'next/link';
import type { Metadata } from 'next';

export const metadata: Metadata = {
	title: 'Pure Tide: Advanced Peptide Wellness',
	description: 'Inspired by the restorative rhythm of water. Grounded in modern scientific research. Wellness, refined.',
};

export default function WelcomePage() {
	return (
		<div className='welcome-page font-outfit'>
			<Nav />
			<Hero />
			<TrustBar />
			<Pillars />
			<NatureScience />
			<Areas />
			<Stats />
			<CTABanner />
			<Footer />
		</div>
	);
}

function Nav() {
	return (
		<nav className='fixed top-0 left-0 right-0 z-[100] flex justify-between items-center px-14 py-[22px] bg-white border-b border-[rgba(28,72,85,0.1)]'>
			<Link
				href='https://puretide.ca'
				className='flex items-center gap-3 no-underline'>
				<svg
					className='w-8 h-8 sm:w-11 sm:h-11'
					viewBox='0 0 559.81 430.1'
					xmlns='http://www.w3.org/2000/svg'>
					<path
						fill='#1C4855'
						d='M551,279.01c-59.67,8.21-119.95-2.39-172.96-35.44l-77.85-48.54c-48.75-30.46-105.92-33.05-154.88-6.97C85.24,220.07,60.6,249.8.73,266.74l-.73-115.38C101.03,81.1,196.04,29.34,320.87,84.84c88.87,39.5,120.68,98.85,229.61,91.57l.52,102.59Z'
					/>
					<path
						fill='#1C4855'
						d='M550.59,321.73v106.23c-188.76,20.37-264.01-113.51-453.82-34.09-31.18,12.99-60.81,21.51-96.15,30.56l.21-113.09,83.57-28.79c96.04-33.16,202.38-25.88,296.76,9.67,55.61,20.9,108.2,29.1,169.43,29.52Z'
					/>
					<circle
						fill='#1C4855'
						cx='498.37'
						cy='61.45'
						r='61.45'
					/>
				</svg>
				<div className='flex flex-col gap-[1px]'>
					<span className='font-bold text-base sm:text-[1.6rem] tracking-[0.1em] text-[#1C4855] leading-none uppercase'>Pure Tide</span>
					<span className='text-[0.55rem] font-normal tracking-[0.18em] text-[#6EB4CC] uppercase leading-none'>Advanced Peptide Wellness</span>
				</div>
			</Link>
			<a
				href='https://puretide.ca'
				className='text-[0.7rem] font-semibold tracking-[0.14em] uppercase text-white bg-[#1C4855] no-underline px-[26px] py-[11px] rounded-[2px] transition-colors duration-200 hover:bg-[#2a5f70]'>
				Visit Puretide
			</a>
		</nav>
	);
}

function Hero() {
	return (
		<section className='min-h-screen flex flex-col justify-end px-8 pb-[88px] relative overflow-hidden bg-[#1C4855]'>
			<div className='absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_50%_30%,#2a7a96_0%,transparent_60%),radial-gradient(ellipse_60%_80%_at_80%_70%,#163d4a_0%,transparent_50%),radial-gradient(ellipse_50%_50%_at_10%_80%,#1a5266_0%,transparent_50%),linear-gradient(180deg,#1a4f62_0%,#0f3040_100%)]' />

			<svg
				className='absolute inset-0 opacity-[0.07] pointer-events-none'
				viewBox='0 0 1440 900'
				preserveAspectRatio='none'
				xmlns='http://www.w3.org/2000/svg'>
				<path
					d='M0 200 Q180 160 360 200 Q540 240 720 200 Q900 160 1080 200 Q1260 240 1440 200'
					stroke='white'
					strokeWidth='1'
					fill='none'
				/>
				<path
					d='M0 300 Q180 260 360 300 Q540 340 720 300 Q900 260 1080 300 Q1260 340 1440 300'
					stroke='white'
					strokeWidth='1'
					fill='none'
				/>
				<path
					d='M0 400 Q180 360 360 400 Q540 440 720 400 Q900 360 1080 400 Q1260 440 1440 400'
					stroke='white'
					strokeWidth='1'
					fill='none'
				/>
				<path
					d='M0 500 Q180 460 360 500 Q540 540 720 500 Q900 460 1080 500 Q1260 540 1440 500'
					stroke='white'
					strokeWidth='1'
					fill='none'
				/>
				<path
					d='M0 600 Q180 560 360 600 Q540 640 720 600 Q900 560 1080 600 Q1260 640 1440 600'
					stroke='white'
					strokeWidth='1'
					fill='none'
				/>
				<path
					d='M0 700 Q180 660 360 700 Q540 740 720 700 Q900 660 1080 700 Q1260 740 1440 700'
					stroke='white'
					strokeWidth='1'
					fill='none'
				/>
			</svg>

			<div className='absolute top-[18%] right-[12%] w-80 h-80 rounded-full bg-[radial-gradient(circle,rgba(110,180,204,0.25)_0%,transparent_70%)] pointer-events-none' />
			<div className='absolute bottom-[25%] left-[5%] w-[180px] h-[180px] rounded-full bg-[radial-gradient(circle,rgba(181,202,174,0.12)_0%,transparent_70%)] pointer-events-none' />

			<div className='relative z-[2]'>
				<p className='inline-flex items-center gap-3 text-[0.65rem] font-semibold tracking-[0.22em] uppercase text-[#6EB4CC] mb-7 fade-up d1'>
					<span className='block w-8 h-[1px] bg-[#6EB4CC] opacity-60' />
					Advanced Peptide Wellness
				</p>
				<h1 className='text-[clamp(3rem,6.5vw,6rem)] font-extrabold leading-[1.0] tracking-[-0.02em] text-white max-w-[780px] mb-8 uppercase fade-up d2'>
					Where <span className='text-[#6EB4CC]'>nature</span>
					<br />
					meets precision.
				</h1>
				<p className='text-base font-light text-white/65 max-w-[480px] leading-[1.85] mb-[52px] fade-up d3'>
					Inspired by the restorative rhythm of water. Grounded in modern scientific research. Wellness, refined.
				</p>
				<div className='flex items-center gap-6 fade-up d4'>
					<a
						href='https://puretide.ca'
						className='inline-block bg-[#6EB4CC] text-[#1C4855] text-[0.72rem] font-bold tracking-[0.16em] uppercase no-underline px-9 py-4 rounded-[2px] transition-all duration-200 hover:bg-[#88c5d6] hover:-translate-y-[1px]'>
						Explore Puretide
					</a>
					<Link
						href='#learn'
						className='inline-block border border-white/25 text-white/75 text-[0.72rem] font-medium tracking-[0.14em] uppercase no-underline px-8 py-[15px] rounded-[2px] transition-all duration-200 hover:border-white/50 hover:text-white'>
						Learn the science
					</Link>
				</div>
			</div>

			<span className='absolute right-14 bottom-[88px] [writing-mode:vertical-rl] text-[0.6rem] tracking-[0.22em] uppercase text-white/35 z-[2] hidden lg:block'>Scroll to explore</span>
		</section>
	);
}

function TrustBar() {
	return (
		<div className='bg-[#EFEFEF] border-b border-[rgba(28,72,85,0.1)] px-14 py-5 flex items-center justify-center gap-14 flex-wrap'>
			<TrustItem text='GMP Grade' />
			<div className='w-[1px] h-4 bg-[rgba(28,72,85,0.18)] hidden md:block' />
			<TrustItem text='98.8% Purity' />
			<div className='w-[1px] h-4 bg-[rgba(28,72,85,0.18)] hidden md:block' />
			<TrustItem text='Canadian-Based' />
			<div className='w-[1px] h-4 bg-[rgba(28,72,85,0.18)] hidden md:block' />
			<TrustItem text='Research-Informed' />
			<div className='w-[1px] h-4 bg-[rgba(28,72,85,0.18)] hidden md:block' />
			<TrustItem text='Third-Party Tested' />
		</div>
	);
}

function TrustItem({ text }: { text: string }) {
	return (
		<div className='flex items-center gap-[10px] text-[0.68rem] font-semibold tracking-[0.14em] uppercase text-[#1C4855] opacity-65'>
			<svg
				width='14'
				height='14'
				viewBox='0 0 14 14'
				fill='none'>
				<circle
					cx='7'
					cy='7'
					r='6'
					stroke='#1C4855'
					strokeWidth='1.2'
				/>
				<path
					d='M4 7l2 2 4-4'
					stroke='#1C4855'
					strokeWidth='1.2'
					strokeLinecap='round'
				/>
			</svg>
			{text}
		</div>
	);
}

function Pillars() {
	return (
		<section
			className='px-14 py-28 bg-white'
			id='learn'>
			<div className='grid grid-cols-1 md:grid-cols-2 gap-20 items-end mb-[72px]'>
				<div>
					<p className='text-[0.62rem] font-semibold tracking-[0.22em] uppercase text-[#6EB4CC] mb-5 flex items-center gap-3'>
						<span className='w-7 h-[1.5px] bg-[#6EB4CC]' />
						Our foundation
					</p>
					<h2 className='text-[clamp(2rem,3.5vw,3.2rem)] font-bold leading-[1.1] tracking-[-0.01em] text-[#1C4855] uppercase'>Wellness without noise. Science without intimidation.</h2>
				</div>
				<p className='text-[0.9rem] text-[#3a4a50] leading-[1.85]'>
					Pure Tide was built at the intersection of nature and precision. Every formulation begins with rigorous research and ends with something that feels intuitive, clean, and
					human. True health is achieved through balance. We believe that.
				</p>
			</div>

			<div className='grid grid-cols-1 md:grid-cols-3 gap-[1.5px] bg-[rgba(28,72,85,0.1)]'>
				<PillarCard
					number='01'
					title='Built on Peptide Science'
					body='Every product in the Pure Tide line is grounded in peer-reviewed research. Peptide science is one of the fastest-evolving fields in modern wellness. We translate that complexity into products that are approachable, clean, and honest.'
				/>
				<PillarCard
					number='02'
					title='Crafted with Intention'
					body="The wellness industry sells quantity. Pure Tide sells specificity. Targeted compounds, studied mechanisms, traceable sources. Nothing is here by accident. Nothing is hidden in a formula you can't read."
				/>
				<PillarCard
					number='03'
					title='Balance in Every Detail'
					body='Inspired by the restorative rhythm of water, Pure Tide brings a new sense of calm to advanced wellness. Science without complexity. Performance without compromise. This is what balance actually looks like.'
				/>
			</div>
		</section>
	);
}

function PillarCard({ number, title, body }: { number: string; title: string; body: string }) {
	return (
		<div className='bg-white px-11 py-[52px] transition-colors duration-200 hover:bg-[#f7f7f5]'>
			<p className='text-[0.62rem] font-bold tracking-[0.2em] text-[#6EB4CC] uppercase mb-[14px]'>{number} / Research-Informed</p>
			<h3 className='text-xl font-bold tracking-[0.02em] text-[#1C4855] mb-[14px] uppercase'>{title}</h3>
			<p className='text-[0.85rem] text-[#3a4a50] leading-[1.85]'>{body}</p>
		</div>
	);
}

function NatureScience() {
	return (
		<div className='px-14 pb-28 grid grid-cols-1 md:grid-cols-2 gap-[3px] bg-[rgba(28,72,85,0.1)]'>
			<div className='px-[60px] py-[72px] bg-white'>
				<p className='text-[0.62rem] font-semibold tracking-[0.22em] uppercase text-[#6EB4CC] mb-5 flex items-center gap-3'>
					<span className='w-7 h-[1.5px] bg-[#6EB4CC]' />
					Nature&apos;s intelligence
				</p>
				<h2 className='text-[clamp(1.6rem,2.5vw,2.2rem)] font-bold tracking-[0.01em] text-[#1C4855] uppercase leading-[1.15] mb-5'>The body already knows how to heal.</h2>
				<p className='text-[0.88rem] text-[#3a4a50] leading-[1.9] mb-4'>
					The human body runs on signals: biochemical messages that coordinate everything from tissue repair to metabolic function. Peptides are among the most studied of these signals:
					short amino acid chains that the body already produces and recognizes.
				</p>
				<p className='text-[0.88rem] text-[#3a4a50] leading-[1.9] mb-4'>
					The science of peptide wellness is about supporting these existing systems, not overriding them. Working with biology, not against it.
				</p>
				<a
					href='https://puretide.ca'
					className='inline-flex items-center gap-[10px] mt-7 text-[0.7rem] font-semibold tracking-[0.16em] uppercase text-[#1C4855] no-underline border-b border-[rgba(28,72,85,0.18)] pb-[6px] transition-all duration-200 hover:border-[#1C4855]'>
					Explore the science at Puretide →
				</a>
			</div>

			<div className='px-[60px] py-[72px] bg-[#1C4855]'>
				<p className='text-[0.62rem] font-semibold tracking-[0.22em] uppercase text-[#6EB4CC] mb-5 flex items-center gap-3'>
					<span className='w-7 h-[1.5px] bg-[#6EB4CC]' />
					Precision wellness
				</p>
				<h2 className='text-[clamp(1.6rem,2.5vw,2.2rem)] font-bold tracking-[0.01em] text-white uppercase leading-[1.15] mb-5'>A new category for those who pay attention.</h2>
				<p className='text-[0.88rem] text-white/65 leading-[1.9] mb-4'>
					For the people who research before they commit. Who want to understand the why, not just the what. Who read the studies, ask the questions, and refuse to settle for
					broad-stroke solutions.
				</p>
				<p className='text-[0.88rem] text-white/65 leading-[1.9] mb-4'>
					Pure Tide is for that person. Precision formulations, traceable sourcing, full transparency. Wellness that respects your intelligence.
				</p>
				<a
					href='https://puretide.ca'
					className='inline-flex items-center gap-[10px] mt-7 text-[0.7rem] font-semibold tracking-[0.16em] uppercase text-[#6EB4CC] no-underline border-b border-[rgba(110,180,204,0.3)] pb-[6px] transition-all duration-200 hover:border-[#6EB4CC]'>
					Discover Pure Tide →
				</a>
			</div>
		</div>
	);
}

function Areas() {
	return (
		<section className='px-14 py-28 bg-[#f7f7f5]'>
			<div className='flex flex-col md:flex-row justify-between items-start md:items-end mb-14 gap-5'>
				<div>
					<p className='text-[0.62rem] font-semibold tracking-[0.22em] uppercase text-[#6EB4CC] mb-5 flex items-center gap-3'>
						<span className='w-7 h-[1.5px] bg-[#6EB4CC]' />
						Areas of wellness
					</p>
					<h2 className='text-[clamp(2rem,3vw,2.8rem)] font-bold tracking-[-0.01em] text-[#1C4855] uppercase leading-[1.1] max-w-[480px]'>What the science is exploring.</h2>
				</div>
				<a
					href='https://puretide.ca'
					className='text-[0.68rem] font-semibold tracking-[0.16em] uppercase text-[#6EB4CC] no-underline flex items-center gap-2 whitespace-nowrap mb-1 transition-colors duration-200 hover:text-[#1C4855]'>
					Browse all at Puretide →
				</a>
			</div>

			<div className='grid grid-cols-1 md:grid-cols-2 gap-[3px] bg-[rgba(28,72,85,0.1)]'>
				<AreaCard
					tag='Area of interest'
					name='Recovery & Repair'
					desc='How the body heals itself is one of the most researched frontiers in modern biology. Understanding the compounds involved, and how to support those pathways, is where the serious science lives. Pure Tide works in this space.'
				/>
				<AreaCard
					tag='Area of interest'
					name='Longevity & Vitality'
					desc='Aging biology has become one of the fastest-growing fields in wellness research. The mechanisms are complex. The conversation is accelerating. Pure Tide brings clarity to what matters and what the research actually says.'
				/>
				<AreaCard
					tag='Area of interest'
					name='Metabolic Health'
					desc='Energy, body composition, endurance: the metabolic conversation goes deeper than macros. A growing body of research is reshaping how performance-focused individuals think about cellular-level optimization.'
				/>
				<AreaCard
					tag='Area of interest'
					name='Skin & Cellular Health'
					desc="From collagen synthesis to cellular renewal, the skin-wellness intersection is one of the most compelling in modern research. Pure Tide's formulations bring this science into a format that feels as refined as the results it supports."
				/>
			</div>
		</section>
	);
}

function AreaCard({ tag, name, desc }: { tag: string; name: string; desc: string }) {
	return (
		<a
			href='https://puretide.ca'
			className='bg-white px-11 py-12 no-underline block border-l-[3px] border-transparent transition-all duration-200 hover:border-l-[#6EB4CC] hover:bg-[#fafafa]'>
			<p className='text-[0.6rem] font-semibold tracking-[0.2em] uppercase text-[#6EB4CC] mb-[14px]'>{tag}</p>
			<h3 className='text-[1.25rem] font-bold tracking-[0.04em] text-[#1C4855] uppercase mb-[14px] leading-[1.2]'>{name}</h3>
			<p className='text-[0.84rem] text-[#3a4a50] leading-[1.85] mb-7'>{desc}</p>
			<span className='text-[0.65rem] font-semibold tracking-[0.16em] uppercase text-[#7a9299] inline-flex items-center gap-2 transition-colors duration-200 group-hover:text-[#6EB4CC]'>
				Explore at Puretide →
			</span>
		</a>
	);
}

function Stats() {
	return (
		<div className='grid grid-cols-2 md:grid-cols-4 gap-[3px] bg-[#1C4855] p-0'>
			<StatItem
				number='10+'
				label='Years of peptide research in the scientific literature'
			/>
			<StatItem
				number='98%'
				label='Purity standard across all Pure Tide formulations'
			/>
			<StatItem
				number='CA'
				label='Canadian-based, precision-focused, transparently sourced'
			/>
			<StatItem
				number='0'
				label='Unnecessary fillers, additives, or hidden ingredients'
			/>
		</div>
	);
}

function StatItem({ number, label }: { number: string; label: string }) {
	return (
		<div className='bg-[#1C4855] px-11 py-16 border-r border-white/[0.08] last:border-r-0 md:border-b-0 border-b'>
			<div className='text-[2.8rem] font-extrabold text-white leading-none mb-3 tracking-[-0.02em]'>
				{number.includes('%') ? (
					<>
						{number.replace('%', '')}
						<span className='text-[#6EB4CC]'>%</span>
					</>
				) : number.includes('+') ? (
					<>
						{number.replace('+', '')}
						<span className='text-[#6EB4CC]'>+</span>
					</>
				) : number === 'CA' ? (
					<span className='text-[#6EB4CC]'>{number}</span>
				) : (
					number
				)}
			</div>
			<div className='text-[0.75rem] font-normal text-white/50 leading-[1.6] tracking-[0.04em]'>{label}</div>
		</div>
	);
}

function CTABanner() {
	return (
		<div className='px-14 py-[100px] bg-[#EFEFEF] border-t border-[rgba(28,72,85,0.1)] grid grid-cols-1 md:grid-cols-[1fr_auto] gap-[60px] items-center'>
			<div>
				<p className='text-[0.62rem] font-semibold tracking-[0.22em] uppercase text-[#6EB4CC] mb-5 flex items-center gap-3'>
					<span className='w-7 h-[1.5px] bg-[#6EB4CC]' />
					Wellness, refined
				</p>
				<h2 className='text-[clamp(2rem,3.5vw,3.2rem)] font-bold tracking-[-0.01em] text-[#1C4855] uppercase leading-[1.1] max-w-[580px]'>
					The science is here. <span className='text-[#6EB4CC]'>So is the standard.</span>
				</h2>
			</div>
			<div className='flex flex-col items-start md:items-end gap-4'>
				<p className='text-[0.82rem] text-[#7a9299] text-left md:text-right max-w-[220px] leading-[1.7]'>
					Explore the full Pure Tide collection: GMP grade, third-party tested, and built for people who take their wellness seriously.
				</p>
				<a
					href='https://puretide.ca'
					className='inline-block bg-[#1C4855] text-white text-[0.72rem] font-bold tracking-[0.16em] uppercase no-underline px-9 py-4 rounded-[2px] whitespace-nowrap transition-colors duration-200 hover:bg-[#2a5f70]'>
					Visit Puretide
				</a>
			</div>
		</div>
	);
}

function Footer() {
	return (
		<footer className='bg-[#1C4855] px-14 pt-14 pb-10'>
			<div className='flex flex-col md:flex-row justify-between items-start pb-10 border-b border-white/10 mb-7 gap-6'>
				<a
					href='https://puretide.ca'
					className='flex items-center gap-[14px] no-underline'>
					<svg
						width='40'
						height='31'
						viewBox='0 0 559.81 430.1'
						xmlns='http://www.w3.org/2000/svg'>
						<path
							fill='white'
							d='M551,279.01c-59.67,8.21-119.95-2.39-172.96-35.44l-77.85-48.54c-48.75-30.46-105.92-33.05-154.88-6.97C85.24,220.07,60.6,249.8.73,266.74l-.73-115.38C101.03,81.1,196.04,29.34,320.87,84.84c88.87,39.5,120.68,98.85,229.61,91.57l.52,102.59Z'
						/>
						<path
							fill='white'
							d='M550.59,321.73v106.23c-188.76,20.37-264.01-113.51-453.82-34.09-31.18,12.99-60.81,21.51-96.15,30.56l.21-113.09,83.57-28.79c96.04-33.16,202.38-25.88,296.76,9.67,55.61,20.9,108.2,29.1,169.43,29.52Z'
						/>
						<circle
							fill='white'
							cx='498.37'
							cy='61.45'
							r='61.45'
						/>
					</svg>
					<div>
						<div className='text-[0.9rem] font-bold tracking-[0.14em] text-white uppercase'>Pure Tide</div>
						<div className='text-[0.52rem] font-normal tracking-[0.18em] text-[#6EB4CC] uppercase mt-[3px]'>Advanced Peptide Wellness</div>
					</div>
				</a>
				<a
					href='https://puretide.ca'
					className='text-[0.7rem] font-semibold tracking-[0.14em] uppercase text-white/60 no-underline transition-colors duration-200 hover:text-[#6EB4CC]'>
					puretide.ca →
				</a>
			</div>
			<div className='flex flex-col md:flex-row justify-between items-start md:items-end gap-8'>
				<p className='text-[0.68rem] text-white/30 leading-[1.7] max-w-[560px]'>
					This page is for informational and educational purposes only. Products are intended for research use only. Content does not constitute medical advice, diagnosis, or treatment.
					Consult a qualified healthcare professional before beginning any wellness or supplementation protocol. Pure Tide products are not evaluated by Health Canada or the FDA for the
					prevention or treatment of disease.
				</p>
				<p className='text-[0.65rem] text-white/25 tracking-[0.08em] whitespace-nowrap'>© 2026 Pure Tide</p>
			</div>
		</footer>
	);
}
