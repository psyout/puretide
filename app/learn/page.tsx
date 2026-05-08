import Link from 'next/link';
import type { Metadata } from 'next';
import FAQ from '@/components/FAQ';
import EducationNav from '@/components/EducationNav';

export const metadata: Metadata = {
	title: 'Education | PureTide',
	description: 'Everything you want to know about peptides. Simple answers to the questions we get asked most. Just clear, easy-to-understand explanations.',
};

export default function EducationPage() {
	return (
		<div className='font-outfit'>
			<EducationNav />
			<Hero />
			<WaveDivider color='#EFEFEF' />
			<WhatArePeptides />
			<HowPeptidesWork />
			<RetaVsOzempic />
			<ProductsGrid />
			<NADCallout />
			<Stacks />
			<FDASection />
			<WhyPureTide />
			<Lyophilization />
			<FAQ />
			<Disclaimer />
			<CTABanner />
			<Footer />
		</div>
	);
}

function Hero() {
	return (
		<section className='bg-[#1C4855] bg-gradient-[150deg,#0e1f25_0%,#1C4855_45%,#22637a_100%] px-10 pt-[112px] pb-[88px] text-center relative overflow-hidden'>
			<div className='absolute w-[700px] h-[700px] rounded-full bg-[radial-gradient(circle,rgba(110,180,204,0.11)_0%,transparent_70%)] top-[-250px] left-1/2 -translate-x-1/2 pointer-events-none' />
			<div className='absolute w-[350px] h-[350px] rounded-full bg-[radial-gradient(circle,rgba(181,202,174,0.08)_0%,transparent_70%)] bottom-[-80px] right-[-80px] pointer-events-none' />
			<div className='flex gap-[10px] justify-center flex-wrap mb-7 relative'>
				<span className='inline-block bg-[rgba(110,180,204,0.15)] text-[#6EB4CC] text-[10px] font-bold tracking-[0.26em] uppercase px-5 py-[7px] rounded-full border border-[rgba(110,180,204,0.22)]'>
					Peptide Education
				</span>
				<span className='inline-flex items-center gap-[7px] bg-[rgba(255,255,255,0.08)] text-white/75 text-[10px] font-semibold tracking-[0.18em] uppercase px-[18px] py-[7px] rounded-full border border-[rgba(255,255,255,0.14)]'>
					Tested in Canada by{' '}
					<a
						href='https://testides.com'
						target='_blank'
						rel='noopener'
						className='text-[#6EB4CC] font-bold no-underline hover:underline'>
						Testides
					</a>
				</span>
			</div>
			<h1 className='text-[clamp(34px,5.5vw,58px)] font-bold text-white leading-[1.1] mb-[22px] tracking-[-0.02em] relative'>
				Everything You Want
				<br />
				to Know About Peptides
			</h1>
			<p className='text-[17px] font-light text-white/65 max-w-[500px] mx-auto mb-11 tracking-[0.01em] relative'>
				Simple answers to the questions we get asked most. Just clear, easy-to-understand explanations.
			</p>
			<div className='flex gap-[14px] justify-center relative flex-wrap'>
				<a
					href='#faqs'
					className='inline-block bg-[#6EB4CC] text-white text-[11px] font-bold tracking-[0.16em] uppercase px-9 py-[14px] rounded no-underline transition-all hover:bg-[#7fc3da] hover:-translate-y-px'>
					Read the FAQs
				</a>
				<a
					href='https://puretide.ca/shop'
					className='inline-block bg-transparent text-white/70 text-[11px] font-semibold tracking-[0.16em] uppercase px-9 py-[14px] rounded no-underline border border-white/10 transition-all hover:border-white/40 hover:text-white'>
					Browse Products
				</a>
			</div>
		</section>
	);
}

function WaveDivider({ color }: { color: string }) {
	return (
		<div
			className='block w-full overflow-hidden leading-0 mb-[-2px]'
			style={{ background: '#1C4855' }}>
			<svg
				className='block w-full'
				viewBox='0 0 1440 48'
				preserveAspectRatio='none'
				xmlns='http://www.w3.org/2000/svg'>
				<path
					d='M0,0 C240,48 480,0 720,24 C960,48 1200,8 1440,32 L1440,48 L0,48 Z'
					fill={color}
				/>
			</svg>
		</div>
	);
}

function WhatArePeptides() {
	return (
		<section className='px-10 py-[88px] bg-[#efefef]'>
			<div className='max-w-[980px] mx-auto grid grid-cols-1 md:grid-cols-2 gap-16 items-center'>
				<div className='bg-[#f5f7f8] border border-[#dde8ed] rounded-2xl px-9 py-14 text-center relative overflow-hidden'>
					<div className='absolute bottom-[-40px] right-[-40px] w-[160px] h-[160px] rounded-full bg-[radial-gradient(circle,rgba(110,180,204,0.15)_0%,transparent_70%)]' />
					<div className='flex flex-wrap gap-2 justify-center mb-6 relative'>
						<span className='bg-[#1C4855] text-white text-[11px] font-bold tracking-[0.1em] px-[15px] py-2 rounded uppercase'>Gly</span>
						<span className='bg-[#6EB4CC] text-white text-[11px] font-bold tracking-[0.1em] px-[15px] py-2 rounded uppercase'>Pro</span>
						<span className='bg-[#1C4855] text-white text-[11px] font-bold tracking-[0.1em] px-[15px] py-2 rounded uppercase'>Ala</span>
						<span className='bg-[#B5CAAE] text-[#1C4855] text-[11px] font-bold tracking-[0.1em] px-[15px] py-2 rounded uppercase'>Val</span>
						<span className='bg-[#6EB4CC] text-white text-[11px] font-bold tracking-[0.1em] px-[15px] py-2 rounded uppercase'>Leu</span>
						<span className='bg-[#1C4855] text-white text-[11px] font-bold tracking-[0.1em] px-[15px] py-2 rounded uppercase'>Ser</span>
						<span className='bg-[#B5CAAE] text-[#1C4855] text-[11px] font-bold tracking-[0.1em] px-[15px] py-2 rounded uppercase'>Thr</span>
						<span className='bg-[#6EB4CC] text-white text-[11px] font-bold tracking-[0.1em] px-[15px] py-2 rounded uppercase'>Cys</span>
						<span className='bg-[#1C4855] text-white text-[11px] font-bold tracking-[0.1em] px-[15px] py-2 rounded uppercase'>Ile</span>
						<span className='bg-[#B5CAAE] text-[#1C4855] text-[11px] font-bold tracking-[0.1em] px-[15px] py-2 rounded uppercase'>Met</span>
					</div>
					<div className='text-[11px] font-semibold text-[#7a9aaa] tracking-[0.16em] uppercase'>Amino acid chain → Peptide</div>
				</div>
				<div>
					<div className='flex items-center gap-[14px] mb-4'>
						<span className='text-[11px] font-bold tracking-[0.26em] uppercase text-[#6EB4CC]'>The Basics</span>
						<span className='flex-1 h-px bg-[#dde8ed] max-w-[48px]' />
					</div>
					<h3 className='text-[26px] font-bold text-[#1C4855] mb-4 tracking-[-0.02em]'>What are peptides?</h3>
					<p className='text-[15px] text-[#3a6070] mb-[18px] leading-[1.8]'>
						Peptides are short chains of amino acids, the same fundamental building blocks that make up every protein in your body. While a protein might contain hundreds of amino
						acids in a complex folded structure, a peptide is a much shorter, more targeted sequence, typically between 2 and 50 amino acids long.
					</p>
					<p className='text-[15px] text-[#3a6070] mb-[18px] leading-[1.8]'>
						Think of amino acids as individual letters. Proteins are long novels. Peptides are precise sentences: specific, intentional, and built to communicate one clear message to
						your body.
					</p>
					<div className='flex flex-wrap gap-2 mt-1'>
						<span className='inline-flex items-center gap-2 bg-[#eef6fa] border border-[#d4eaf3] rounded px-[14px] py-2 text-[12px] font-semibold text-[#1C4855] tracking-[0.02em]'>
							+ Naturally occurring in the body
						</span>
						<span className='inline-flex items-center gap-2 bg-[#eef6fa] border border-[#d4eaf3] rounded px-[14px] py-2 text-[12px] font-semibold text-[#1C4855] tracking-[0.02em]'>
							+ Smaller than proteins
						</span>
						<span className='inline-flex items-center gap-2 bg-[#eef6fa] border border-[#d4eaf3] rounded px-[14px] py-2 text-[12px] font-semibold text-[#1C4855] tracking-[0.02em]'>
							+ Highly targeted action
						</span>
						<span className='inline-flex items-center gap-2 bg-[#eef6fa] border border-[#d4eaf3] rounded px-[14px] py-2 text-[12px] font-semibold text-[#1C4855] tracking-[0.02em]'>
							+ Studied globally
						</span>
					</div>
				</div>
			</div>
		</section>
	);
}

function HowPeptidesWork() {
	return (
		<section className='px-10 py-[88px] bg-white'>
			<div className='max-w-[980px] mx-auto'>
				<div className='flex items-center gap-[14px] mb-4'>
					<span className='text-[11px] font-bold tracking-[0.26em] uppercase text-[#6EB4CC]'>The Science</span>
					<span className='flex-1 h-px bg-[#dde8ed] max-w-[48px]' />
				</div>
				<h2 className='text-[clamp(32px,5vw,52px)] font-bold text-[#1C4855] leading-[1.1] mb-4 tracking-[-0.02em]'>How do peptides work?</h2>
				<p className='text-[16px] text-[#3a6070] max-w-[620px] mb-12 leading-[1.75]'>
					Peptides work by binding to specific receptors on the surface of cells, triggering a targeted biological response. Each peptide has a unique sequence that determines which
					receptors it interacts with, and therefore what it does.
				</p>
				<div className='grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4'>
					{[
						{
							num: '01',
							title: 'Receptor Binding',
							desc: 'A peptide enters the body and seeks out its specific receptor, like a key searching for its lock. The shape of the amino acid sequence determines exactly which receptor it fits.',
						},
						{
							num: '02',
							title: 'Cell Signalling',
							desc: 'Once bound, the peptide sends a signal into the cell, triggering a specific biological process: the release of a hormone, activation of a repair pathway, or a metabolic response.',
						},
						{
							num: '03',
							title: 'Targeted Response',
							desc: 'Unlike broader compounds, peptides work with precision. They activate specific pathways rather than flooding the entire system, which is why researchers study them across such a wide range of applications.',
						},
						{
							num: '04',
							title: 'Natural Amplification',
							desc: 'Many peptides work by amplifying processes the body already performs naturally, supporting what is already there rather than introducing entirely foreign mechanisms.',
						},
					].map((step) => (
						<div
							key={step.num}
							className='bg-[#EFEFEF] border border-[#dde8ed] rounded-xl px-6 py-8 relative transition-all hover:border-[#d4eaf3] hover:shadow-[0_4px_24px_rgba(110,180,204,0.12)]'>
							<div className='w-9 h-9 bg-[#1C4855] text-white rounded flex items-center justify-center text-[12px] font-extrabold tracking-[0.04em] mb-5'>{step.num}</div>
							<h4 className='text-[13px] font-bold text-[#1C4855] mb-[10px] tracking-[0.1em] uppercase'>{step.title}</h4>
							<p className='text-[14px] text-[#3a6070] leading-[1.75]'>{step.desc}</p>
						</div>
					))}
				</div>
				<div
					className='rounded-xl px-10 py-9 flex flex-col items-start md:flex-row justify-between gap-6 flex-wrap mt-12 relative overflow-hidden'
					style={{ background: 'linear-gradient(135deg, #1C4855 0%, #22637a 100%)' }}>
					<div className='absolute right-[-60px] top-[-60px] w-[220px] h-[220px] rounded-full bg-[radial-gradient(circle,rgba(110,180,204,0.18)_0%,transparent_70%)]' />
					<div className='flex-1'>
						<h4 className='text-[18px] font-bold text-white mb-1.5 tracking-[-0.01em]'>Ready to explore the science yourself?</h4>
						<p className='text-[14px] text-[#ffffff94] tracking-[0.01em]'>
							Research-grade. Third-party tested in Canada by{' '}
							<a
								href='https://testides.com'
								target='_blank'
								rel='noopener'
								className='text-[#6EB4CC] font-bold no-underline'>
								Testides
							</a>
							. COA on every batch.
						</p>
					</div>
					<a
						href='https://puretide.ca/shop'
						className='inline-block bg-[#6EB4CC] text-white text-[11px] font-bold tracking-[0.16em] uppercase px-[30px] py-[13px] rounded no-underline transition-all hover:bg-[#7fc3da] hover:-translate-y-px whitespace-nowrap relative'>
						Browse All Products →
					</a>
				</div>
			</div>
		</section>
	);
}

function Lyophilization() {
	return (
		<section
			className='px-10 py-[88px] bg-white'
			style={{
				backgroundColor: 'var(--color-primary)',
				backgroundImage: 'linear-gradient(#dde8ed 1px, transparent 1px), linear-gradient(90deg, #dde8ed 1px, transparent 1px)',
				backgroundSize: '32px 32px',
			}}>
			<div className='max-w-[980px] mx-auto'>
				<div className='flex items-center gap-[14px] mb-4'>
					<span className='text-[11px] font-bold tracking-[0.26em] uppercase text-[#6EB4CC]'>How It Works</span>
					<span className='flex-1 h-px bg-[#dde8ed] max-w-[48px]' />
				</div>
				<h2 className='text-[clamp(32px,5vw,52px)] font-bold text-[#1C4855] leading-[1.1] mb-4 tracking-[-0.02em]'>Lyophilization: From Powder to Liquid</h2>
				<p className='text-[16px] text-[#3a6070] max-w-[620px] mb-16 leading-[1.75]'>
					All PureTide peptides arrive as a fine lyophilized (freeze-dried) powder. Here is why that matters, and exactly how to prepare them for use in research.
				</p>
				<div className='grid grid-cols-1 md:grid-cols-2 gap-12 items-start'>
					<div
						className='rounded-2xl px-8 py-10 relative overflow-hidden'
						style={{ background: 'linear-gradient(135deg, #1C4855 0%, #22637a 100%)' }}>
						<div className='absolute top-[-40px] right-[-40px] w-[200px] h-[200px] rounded-full bg-[radial-gradient(circle,rgba(110,180,204,0.18)_0%,transparent_70%)] ' />
						<div className='flex flex-col gap-5 relative'>
							{[
								{
									num: '1',
									title: 'The Peptide is Lyophilized',
									desc: 'Water is removed from the compound under controlled freeze-drying conditions. This preserves the peptide structure and extends shelf life significantly.',
								},
								{
									num: '2',
									title: 'You Add Bacteriostatic Water',
									desc: 'BAC water is injected slowly into the vial to reconstitute the peptide. Always add liquid to the side of the vial wall, never directly onto the powder.',
								},
								{
									num: '3',
									title: 'Gently Swirl to Dissolve',
									desc: 'Do not shake. Swirl gently until the powder is fully dissolved. The solution should be clear. Refrigerate after reconstitution.',
								},
								{ num: '4', title: 'Ready for Research Use', desc: 'The reconstituted solution is now ready. Most peptides remain stable for 4 to 6 weeks when refrigerated.' },
							].map((step) => (
								<div
									key={step.num}
									className='flex items-start gap-4'>
									<div className='w-8 h-8 min-w-8 bg-[rgba(110,180,204,0.2)] border border-[rgba(110,180,204,0.35)] rounded-full flex items-center justify-center text-[12px] font-extrabold text-[#6EB4CC]'>
										{step.num}
									</div>
									<div>
										<h5 className='text-[13px] font-bold text-white tracking-[0.08em] uppercase mb-1'>{step.title}</h5>
										<p className='text-[13px] text-white/55 leading-[1.6]'>{step.desc}</p>
									</div>
								</div>
							))}
						</div>
					</div>
					<div>
						<h3 className='text-[24px] font-bold text-[#1C4855] mb-4 tracking-[-0.02em]'>Why are peptides freeze-dried?</h3>
						<p className='text-[15px] text-[#3a6070] mb-[18px] leading-[1.8]'>
							Lyophilization removes moisture entirely, which is the primary cause of peptide degradation. In powder form, peptides can be stored at room temperature for extended
							periods without losing potency. Once reconstituted, they are at their most bioavailable and ready for research application.
						</p>
						<p className='text-[15px] text-[#3a6070] mb-[18px] leading-[1.8]'>
							This process is the gold standard in pharmaceutical manufacturing precisely because it preserves purity without additives or preservatives. Every PureTide batch is
							then independently verified by{' '}
							<a
								href='https://testides.com'
								target='_blank'
								rel='noopener'
								className='text-[#1C4855] font-bold no-underline'>
								Testides
							</a>
							, a Canadian third-party lab, to confirm purity before it reaches you.
						</p>
						<div className='bg-[#eef6fa] border border-[#d4eaf3] rounded-xl px-6 py-5 mt-2'>
							<h5 className='text-[12px] font-bold tracking-[0.16em] uppercase text-[#6EB4CC] mb-2.5'>What is Bacteriostatic Water (BAC)?</h5>
							<ul className='list-none flex flex-col gap-1.5'>
								{[
									'Sterile water for injection',
									'Contains 0.9% benzyl alcohol as a preservative',
									'Prevents bacterial growth in multi-use vials',
									'Maintains the peptide solution for weeks when refrigerated',
									'Available at most compounding pharmacies and online medical suppliers',
								].map((item) => (
									<li
										key={item}
										className='text-[13px] text-[#3a6070] flex items-center gap-2'>
										+ {item}
									</li>
								))}
							</ul>
						</div>
					</div>
				</div>
			</div>
		</section>
	);
}

function RetaVsOzempic() {
	return (
		<section className='px-10 py-[88px] bg-[#efefef]'>
			<div className='max-w-[980px] mx-auto'>
				<div className='flex items-center gap-[14px] mb-4'>
					<span className='text-[11px] font-bold tracking-[0.26em] uppercase text-[#6EB4CC]'>Metabolic Research</span>
					<span className='flex-1 h-px bg-[#dde8ed] max-w-[48px]' />
				</div>
				<h2 className='text-[clamp(32px,5vw,52px)] font-bold text-[#1C4855] leading-[1.1] mb-4 tracking-[-0.02em]'>Retatrutide vs. Ozempic vs. Mounjaro</h2>
				<p className='text-[16px] text-[#3a6070] max-w-[620px] mb-16 leading-[1.75]'>
					One of the most searched topics in the peptide space right now. Here is how the three compounds compare at the receptor level, and why Retatrutide represents the next
					generation of metabolic research.
				</p>
				<div className='overflow-x-auto rounded-xl border border-[#dde8ed] shadow-[0_4px_40px_rgba(28,72,85,0.08)]'>
					<table className='w-full border-collapse bg-white'>
						<thead className='bg-[#1C4855]'>
							<tr>
								<th className='px-[22px] py-[18px] text-left text-[11px] font-bold tracking-[0.14em] text-white/75 uppercase rounded-tl-xl'>Feature</th>
								<th className='px-[22px] py-[18px] text-left text-[11px] font-bold tracking-[0.14em] text-white/75 uppercase'>
									Ozempic
									<br />
									<span className='font-normal text-[11px] opacity-65'>Semaglutide</span>
								</th>
								<th className='px-[22px] py-[18px] text-left text-[11px] font-bold tracking-[0.14em] text-white/75 uppercase'>
									Mounjaro
									<br />
									<span className='font-normal text-[11px] opacity-65'>Tirzepatide</span>
								</th>
								<th className='px-[22px] py-[18px] text-left text-[11px] font-bold tracking-[0.14em] text-[#6EB4CC] uppercase bg-[rgba(110,180,204,0.22)] rounded-tr-xl'>
									Retatrutide
									<br />
									<span className='font-normal text-[11px] opacity-80'>LY3437943</span>
								</th>
							</tr>
						</thead>
						<tbody>
							{[
								{ feature: 'Receptor Targets', ozempic: 'GLP-1 only', mounjaro: 'GLP-1 + GIP', reta: 'GLP-1 + GIP + Glucagon' },
								{ feature: 'Mechanism Type', ozempic: 'Single agonist', mounjaro: 'Dual agonist', reta: 'Triple agonist' },
								{ feature: 'Appetite Signalling', ozempic: 'Yes', mounjaro: 'Yes', reta: 'Yes' },
								{ feature: 'Glucose Balance', ozempic: 'Yes', mounjaro: 'Yes', reta: 'Yes' },
								{ feature: 'Energy Expenditure', ozempic: 'No', mounjaro: 'Minimal', reta: 'Yes, via glucagon' },
								{ feature: 'Avg. Weight Reduction\n(phase 2 / trial data)', ozempic: '~15%', mounjaro: '~21%', reta: '~24%' },
								{ feature: 'Regulatory Status', ozempic: 'FDA Approved', mounjaro: 'FDA Approved', reta: 'Under Research' },
							].map((row, i) => (
								<tr
									key={i}
									className='border-b border-[#dde8ed] last:border-b-0 even:bg-[#f9f9f9]'>
									<td
										className='px-[22px] py-[15px] text-[14px] font-semibold text-[#1C4855
] whitespace-pre-line'>
										{row.feature}
									</td>
									<td className='px-[22px] py-[15px] text-[14px] text-[#3a6070]'>{row.ozempic}</td>
									<td className='px-[22px] py-[15px] text-[14px] text-[#3a6070]'>{row.mounjaro}</td>
									<td className='px-[22px] py-[15px] text-[14px] text-[#3a6070] font-semibold bg-[rgba(110,180,204,0.07)]'>{row.reta}</td>
								</tr>
							))}
						</tbody>
					</table>
				</div>
				<div className='text-[13px] text-[#3a6070] mt-[18px] px-5 py-4 bg-[#eef6fa] border-l-[3px] border-[#6EB4CC] rounded-r-lg leading-[1.75]'>
					<strong>What makes Retatrutide different:</strong> The addition of glucagon receptor activation is the key distinction. Glucagon signals the body to increase energy
					expenditure, meaning the body burns more energy at rest. Neither Ozempic nor Mounjaro include this mechanism. All data above is sourced from published preclinical and Phase 2
					trial research. Retatrutide is not approved for human use and is available from PureTide for research purposes only. Every batch is third-party tested in Canada by{' '}
					<a
						href='https://testides.com'
						target='_blank'
						rel='noopener'
						className='text-[#1C4855] font-bold'>
						Testides
					</a>{' '}
					to &gt;99% purity.
				</div>
				<div className='mt-8 bg-white border border-[#dde8ed] rounded-xl px-8 py-7 flex items-center gap-6 flex-wrap shadow-[0_2px_20px_rgba(28,72,85,0.06)]'>
					<div className='w-13 h-13 bg-[#eef6fa] rounded-xl flex items-center justify-center flex-shrink-0 text-2xl'>⚗️</div>
					<div className='flex-1 min-w-[200px]'>
						<div className='text-[10px] font-bold tracking-[0.22em] uppercase text-[#6EB4CC] mb-1'>Now Available</div>
						<h4 className='text-[17px] font-bold text-[#1C4855] mb-1 tracking-[-0.01em]'>Retatrutide (LY3437943)</h4>
						<p className='text-[13px] text-[#7a9aaa]'>Research-grade. Third-party tested by Testides. COA included. &gt;99% purity.</p>
					</div>
					<a
						href='https://puretide.ca/products/retatrutide'
						className='inline-block bg-[#1C4855] text-white text-[11px] font-bold tracking-[0.16em] uppercase px-7 py-[13px] rounded no-underline transition-all hover:bg-[#2a5f70] hover:-translate-y-px'>
						Shop Retatrutide →
					</a>
				</div>
			</div>
		</section>
	);
}

function ProductsGrid() {
	const products = [
		{
			tag: 'Metabolic',
			name: 'Retatrutide',
			desc: 'The next generation triple-agonist metabolic peptide. Targets GLP-1, GIP, and glucagon receptors simultaneously for maximum metabolic research application.',
			href: 'https://puretide.ca/products/retatrutide',
		},
		{
			tag: 'Skin & Repair',
			name: 'GHK-Cu',
			desc: 'A naturally occurring copper peptide with a well-documented research profile in skin regeneration, collagen synthesis, and wound healing at the cellular level.',
			href: 'https://puretide.ca/products/ghk-cu',
		},
		{
			tag: 'Recovery',
			name: 'BPC-157',
			desc: 'One of the most extensively studied regenerative peptides. Widely researched for tissue recovery, joint health, and cellular regeneration pathways.',
			href: 'https://puretide.ca/products/bpc-157',
		},
		{
			tag: 'Repair',
			name: 'TB-500',
			desc: 'Thymosin Beta-4 analogue frequently stacked with BPC-157. Studied for accelerated tissue repair and inflammation pathway modulation.',
			href: 'https://puretide.ca/products/tb-500',
		},
		{
			tag: 'Longevity',
			name: 'Mots-C',
			desc: 'A mitochondria-derived peptide with an emerging research profile in metabolic regulation, cellular energy, and age-related decline. One of the more novel compounds in the longevity space.',
			href: 'https://puretide.ca/products/mots-c',
		},
		{
			tag: 'Growth Hormone',
			name: 'Tesamorelin',
			desc: 'A growth hormone-releasing factor analogue. One of the few peptides with an existing FDA approval (for HIV-associated lipodystrophy), making it one of the most clinically validated in the space.',
			href: 'https://puretide.ca/products/tesamorelin',
		},
	];

	return (
		<section className='px-10 py-[88px] bg-[#f5f7f4]'>
			<div className='max-w-[980px] mx-auto'>
				<div className='flex items-center gap-[14px] mb-4'>
					<span className='text-[11px] font-bold tracking-[0.26em] uppercase text-[#6EB4CC]'>Our Catalogue</span>
					<span className='flex-1 h-px bg-[#dde8ed] max-w-[48px]' />
				</div>
				<h2 className='text-[clamp(32px,5vw,52px)] font-bold text-[#1C4855] leading-[1.1] mb-4 tracking-[-0.02em]'>Most researched compounds</h2>
				<p className='text-[16px] text-[#3a6070] max-w-[620px] mb-14 leading-[1.75]'>
					Each batch comes with a Certificate of Analysis, ships from Canada, and is independently third-party tested at{' '}
					<a
						href='https://testides.com'
						target='_blank'
						rel='noopener'
						className='text-[#1C4855] font-semibold'>
						Testides
					</a>{' '}
					to a standard of &gt;99% purity.
				</p>
				<div className='grid grid-cols-[repeat(auto-fit,minmax(240px,1fr))] gap-4 mt-2'>
					{products.map((product) => (
						<a
							key={product.name}
							href={product.href}
							className='bg-white border border-[#dde8ed] rounded-xl px-6 py-7 no-underline block transition-all relative overflow-hidden group hover:border-[#d4eaf3] hover:shadow-[0_6px_32px_rgba(28,72,85,0.1)] hover:-translate-y-px'>
							<div className='absolute bottom-0 left-0 right-0 h-[3px] bg-gradient-to-r from-[#6EB4CC] to-[#1C4855] scale-x-0 group-hover:scale-x-100 transition-transform origin-left' />
							<div className='text-[10px] font-bold tracking-[0.2em] uppercase text-[#6EB4CC] mb-2.5'>{product.tag}</div>
							<div className='inline-block text-[10px] font-bold bg-[rgba(82,104,83,0.1)] text-[#526853] px-2.5 py-[3px] rounded tracking-[0.08em] uppercase mb-2.5'>
								&gt;99% Purity
							</div>
							<h4 className='text-[18px] font-bold text-[#1C4855] mb-2 tracking-[-0.01em]'>{product.name}</h4>
							<p className='text-[13px] text-[#3a6070] leading-[1.7] mb-5'>{product.desc}</p>
							<span className='text-[11px] font-bold tracking-[0.14em] uppercase text-[#1C4855] inline-flex items-center gap-1.5'>
								View Product{' '}
								<svg
									className='w-3 h-3 transition-transform group-hover:translate-x-1'
									viewBox='0 0 16 16'
									fill='none'>
									<path
										d='M3 8h10M9 4l4 4-4 4'
										stroke='currentColor'
										strokeWidth='1.6'
										strokeLinecap='round'
										strokeLinejoin='round'
									/>
								</svg>
							</span>
						</a>
					))}
				</div>
			</div>
		</section>
	);
}

function NADCallout() {
	return (
		<section className='px-10 py-[88px] bg-white'>
			<div className='max-w-[980px] mx-auto'>
				<div
					className='bg-gradient-[135deg,#1C4855_0%,#1a5065_100%] rounded-2xl px-10 py-12 flex items-center gap-10 flex-wrap relative overflow-hidden'
					style={{ background: 'linear-gradient(135deg, #1C4855 0%, #22637a 100%)' }}>
					<div className='absolute right-[-80px] bottom-[-80px] w-[300px] h-[300px] rounded-full bg-[radial-gradient(circle,rgba(110,180,204,0.14)_0%,transparent_70%)]' />
					<div className='flex-1 min-w-[260px] relative'>
						<div className='text-[10px] font-bold tracking-[0.22em] uppercase text-[#6EB4CC] bg-[rgba(110,180,204,0.15)] border border-[rgba(110,180,204,0.25)] px-4 py-1.5 rounded-full mb-4 inline-block'>
							Did You Know
						</div>
						<h3 className='text-[26px] font-bold text-white mb-3.5 tracking-[-0.01em] leading-[1.2]'>NAD+ is not actually a peptide.</h3>
						<p className='text-[15px] text-white/60 leading-[1.8] mb-3'>
							A lot of people come to us asking about NAD+ in the same breath as peptides. Understandable, given that we carry it and it is very often researched alongside peptide
							protocols. But technically, NAD+ (Nicotinamide Adenine Dinucleotide) is a coenzyme, not a peptide. It is not made of amino acids. It is a molecule found in every
							living cell, central to energy metabolism, DNA repair, and sirtuin activation.
						</p>
						<p className='text-[15px] text-white/60 leading-[1.8] mb-3'>
							Why do we carry it? Because the research community uses it extensively alongside peptide stacks, and the wellness goals overlap significantly. It just operates
							through a completely different mechanism.
						</p>
						<div className='inline-flex items-center gap-2 bg-[rgba(110,180,204,0.15)] border border-[rgba(110,180,204,0.25)] rounded-full px-[18px] py-2 text-[12px] font-semibold text-white/75 tracking-[0.06em] mt-2'>
							Still want to learn more?{' '}
							<a
								href='#faqs'
								className='text-[#6EB4CC] font-bold no-underline hover:underline'>
								See the NAD+ FAQ below
							</a>
						</div>
					</div>
				</div>
			</div>
		</section>
	);
}

function Stacks() {
	const stacks = [
		{
			name: 'Recovery Stack',
			title: 'Wolverine Stack',
			desc: 'The most popular recovery combination in our catalogue. BPC-157 and TB-500 target overlapping repair pathways, making them one of the most studied pairings in regenerative peptide research.',
			compounds: ['BPC-157', 'TB-500'],
			href: 'https://puretide.ca/products/wolverine-stack',
		},
		{
			name: 'Skin & Glow Stack',
			title: 'Glow Stack',
			desc: 'Built around GHK-Cu and complementary compounds researched for skin structure, collagen synthesis, and visible cellular renewal. Designed for the skin-health research community.',
			compounds: ['GHK-Cu', 'Glow Blend'],
			href: 'https://puretide.ca/products/glow-stack',
		},
		{
			name: 'Blend',
			title: 'Klow',
			desc: 'A targeted blend formulated for researchers studying a specific area of cellular function and recovery. Combines compounds with a shared focus on precision outcomes.',
			compounds: ['Klow Blend'],
			href: 'https://puretide.ca/products/klow-stack',
		},
		{
			name: 'GH Peptide Stack',
			title: 'CJC-1295 / Ipamorelin',
			desc: 'One of the most studied growth hormone secretagogue combinations. CJC-1295 extends the signal window while Ipamorelin provides a clean, selective pulse. Frequently researched together for synergistic effect.',
			compounds: ['CJC-1295', 'Ipamorelin'],
			href: 'https://puretide.ca/products/cjc-ipa-stack',
		},
	];

	return (
		<section
			className='px-10 py-[88px]'
			style={{
				backgroundColor: '#eef6fa',
				backgroundImage: 'linear-gradient(#dde8ed 1px, transparent 1px), linear-gradient(90deg, #dde8ed 1px, transparent 1px)',
				backgroundSize: '32px 32px',
			}}>
			<div className='max-w-[980px] mx-auto'>
				<div className='flex items-center gap-[14px] mb-4'>
					<span className='text-[11px] font-bold tracking-[0.26em] uppercase text-[#6EB4CC]'>Curated Stacks</span>
					<span className='flex-1 h-px bg-[#dde8ed] max-w-[48px]' />
				</div>
				<h2 className='text-[clamp(32px,5vw,52px)] font-bold text-[#1C4855] leading-[1.1] mb-4 tracking-[-0.02em]'>Why choose stacks or blends</h2>
				<p className='text-[16px] text-[#3a6070] max-w-[620px] mb-14 leading-[1.75]'>
					Individual peptides are powerful on their own. But certain combinations have complementary mechanisms that researchers commonly study together. Our curated stacks make it
					simple.
				</p>
				<div className='grid grid-cols-1 sm:grid-cols-2 gap-4'>
					{stacks.map((stack) => (
						<a
							key={stack.title}
							href={stack.href}
							className='bg-white border border-[#dde8ed] rounded-xl px-6 py-7 no-underline block transition-all hover:border-[#d4eaf3] hover:shadow-[0_4px_24px_rgba(28,72,85,0.08)] hover:-translate-y-px'>
							<div className='text-[10px] font-bold tracking-[0.22em] uppercase text-[#6EB4CC] mb-2.5'>{stack.name}</div>
							<h4 className='text-[17px] font-bold text-[#1C4855] mb-2'>{stack.title}</h4>
							<p className='text-[13px] text-[#3a6070] leading-[1.7] mb-4'>{stack.desc}</p>
							<div className='flex flex-wrap gap-1.5'>
								{stack.compounds.map((c) => (
									<span
										key={c}
										className='text-[10px] font-bold tracking-[0.08em] px-2.5 py-1 rounded bg-[#eef6fa] text-[#1C4855] uppercase'>
										{c}
									</span>
								))}
							</div>
						</a>
					))}
				</div>
			</div>
		</section>
	);
}

function FDASection() {
	return (
		<section className='px-10 py-[88px] bg-white'>
			<div className='max-w-[980px] mx-auto'>
				<div className='flex items-center gap-[14px] mb-4'>
					<span className='text-[11px] font-bold tracking-[0.26em] uppercase text-[#6EB4CC]'>The Regulatory Picture</span>
					<span className='flex-1 h-px bg-[#dde8ed] max-w-[48px]' />
				</div>
				<h2 className='text-[clamp(32px,5vw,52px)] font-bold text-[#1C4855] leading-[1.1] mb-4 tracking-[-0.02em]'>Why are most peptides not FDA approved?</h2>
				<p className='text-[16px] text-[#3a6070] max-w-[620px] mb-12 leading-[1.75]'>
					This is one of the most common questions we get. The answer has more nuance than most people expect.
				</p>
				<div className='grid grid-cols-1 md:grid-cols-2 gap-12 items-start'>
					<div>
						<p className='text-[15px] text-[#3a6070] leading-[1.8] mb-[18px]'>
							In 2013, the Supreme Court ruled that naturally occurring substances cannot be patented. This single ruling is the core reason most peptides will never go through
							the FDA approval process. Drug companies fund clinical trials because they can patent the outcome and profit from it. Since peptides are naturally occurring amino
							acid sequences, they cannot be patented. No patent means no return on investment. No return means no funding.
						</p>
						<p className='text-[15px] text-[#3a6070] leading-[1.8] mb-[18px]'>
							Think of it the same way you think about your vitamin D, your omega-3s, or your creatine. None of those are FDA approved either. That does not mean the research does
							not exist, or that they are unsafe. It means there is no financial pathway that incentivises a company to run a billion-dollar trial process for something they
							cannot own.
						</p>
						<p className='text-[15px] text-[#3a6070] leading-[1.8] mb-6'>
							That said, some peptides do have FDA approval where a specific pharmaceutical formulation was developed and patented:
						</p>
						<div className='flex flex-col gap-3 mb-6'>
							{[
								{ title: 'Semaglutide (Ozempic, Wegovy)', desc: 'FDA approved for type 2 diabetes management and weight reduction.' },
								{
									title: 'Tesamorelin (Egrifta)',
									desc: 'FDA approved for HIV-associated lipodystrophy in certain patients. One of the few peptides with full clinical approval, and one of the compounds we carry.',
								},
							].map((item) => (
								<div
									key={item.title}
									className='bg-[#eef6fa] border border-[#d4eaf3] rounded-lg px-5 py-4 flex items-start gap-3.5'>
									<div className='w-2 h-2 min-w-2 bg-[#6EB4CC] rounded-full mt-1.5' />
									<div>
										<h5 className='text-[13px] font-bold text-[#1C4855] mb-0.75'>{item.title}</h5>
										<p className='text-[13px] text-[#3a6070] m-0'>{item.desc}</p>
									</div>
								</div>
							))}
						</div>
						<p className='text-[15px] text-[#3a6070] leading-[1.8]'>
							Outside of cases like these, meaningful regulatory change is unlikely unless the financial incentive structure shifts. The research community has been ahead of the
							regulators for a long time.
						</p>
					</div>
					<div>
						<div className='bg-[#1C4855] bg-gradient-[135deg,#162f38_0%,#1C4855_100%] rounded-2xl px-9 py-10 relative overflow-hidden'>
							<div className='absolute top-[-40px] right-[-40px] w-[200px] h-[200px] rounded-full bg-[radial-gradient(circle,rgba(110,180,204,0.14)_0%,transparent_70%)]' />
							<div className='text-[64px] leading-none text-[#6EB4CC] opacity-30 font-serif mb-2'>&ldquo;</div>
							<blockquote className='text-[17px] text-white leading-[1.7] font-light mb-6 italic relative'>
								Drug companies cannot get a patent on a peptide, just like they cannot get a patent on a supplement. They are not going to pour millions of dollars into
								studying these things if they cannot make money on the other side. So just because something is not approved does not mean it is not safe or effective. Think of
								your vitamin D, your omegas, your creatine.
							</blockquote>
							<div className='text-[11px] font-bold tracking-[0.16em] uppercase text-white/40'>Lisa Levy · Certified Peptide Therapist</div>
							<div className='mt-6 px-5 py-[18px] bg-[rgba(110,180,204,0.12)] border border-[rgba(110,180,204,0.22)] rounded-lg relative'>
								<p className='text-[13px] text-white/70 leading-[1.7] m-0'>
									<strong className='text-[#6EB4CC]'>The bottom line:</strong> The lack of FDA approval is a financial and legal story, not a scientific one. The research on
									peptides is extensive, global, and growing. We follow it closely so you do not have to.
								</p>
							</div>
						</div>
					</div>
				</div>
			</div>
		</section>
	);
}

function WhyPureTide() {
	const trustItems = [
		{ icon: '🇨🇦', title: 'Canadian-Based', desc: 'We are a Canadian company, operating under Canadian standards with fast, reliable and domestic shipping.' },
		{
			icon: '🔬',
			title: 'Tested by Testides',
			desc: 'Every batch is independently tested by Testides, a premium third-party Canadian lab. Not self-certified. Not manufacturer-certified. Externally verified.',
		},
		{
			icon: '📄',
			title: 'COA on Every Batch',
			desc: 'A Certificate of Analysis (COA) is a document issued by an independent laboratory confirming the purity, identity, and potency of a compound. Ours are publicly available on every product page before you buy.',
		},
		{ icon: '⚗️', title: '>99% Purity', desc: 'Our formulations are tested to a standard of greater than 99% purity on every batch. The benchmark for serious research applications.' },
		{ icon: '👥', title: 'Thousands of Customers', desc: 'Our community continues to grow because the product delivers on what it promises: quality and consistency, every single order.' },
	];

	return (
		<section className='px-10 py-[88px] bg-[#1C4855]'>
			<div className='max-w-[980px] mx-auto'>
				<h2 className='text-[clamp(32px,5vw,52px)] font-bold text-white leading-[1.1] mb-4 tracking-[-0.02em]'>Our peptides. Your confidence.</h2>
				<p className='text-[15px] text-white/55 max-w-[620px] mb-14 leading-[1.75]'>
					We built PureTide to solve one problem: access to research-grade peptides you can actually trust. Here is what sets us apart.
				</p>
				<div className='grid grid-cols-[repeat(auto-fit,minmax(240px,1fr))] gap-3.5'>
					{trustItems.map((item) => (
						<div
							key={item.title}
							className='bg-white/10 border border-white/9 rounded-lg px-6 py-[30px] transition-all duration-200 hover:bg-white/9'>
							<div className='w-10 h-10 bg-[rgba(110,180,204,0.14)] rounded-md flex items-center justify-center text-lg mb-4'>{item.icon}</div>
							<h4 className='text-[13px] font-bold text-white mb-2 tracking-[0.1em] uppercase'>{item.title}</h4>
							<p className='text-[14px] text-white/50 leading-[1.7]'>{item.desc}</p>
						</div>
					))}
				</div>
				<div className='bg-white/6 border border-white/10 rounded-xl px-9 py-8 mt-12'>
					<h4 className='text-[15px] font-bold text-white mb-2.5 tracking-[0.04em]'>What is a Certificate of Analysis (COA)?</h4>
					<p className='text-[14px] text-white/50 leading-[1.75]'>
						A Certificate of Analysis is an official document issued by an independent, accredited laboratory confirming what is in a compound and at what concentration. It verifies
						the identity of the peptide, its purity level, and that no contaminants are present. Every PureTide product page links to the COA for that batch so you can review the
						results before purchasing. All testing is conducted by{' '}
						<a
							href='https://testides.com'
							target='_blank'
							rel='noopener'
							className='text-[#6EB4CC] font-bold no-underline hover:underline'>
							Testides
						</a>
						, a Canadian lab operating to premium analytical standards.
					</p>
				</div>
				<div className='mt-14 pt-10 border-t border-white/10 flex flex-col md:flex-row items-center md:justify-between gap-6 flex-wrap'>
					<p className='text-[15px] text-white/55 max-w-[460px] leading-[1.7]'>Every batch is independently verified. Every order ships from Canada. Zero compromise on purity.</p>
					<a
						href='https://puretide.ca/shop'
						className='inline-block bg-[#6EB4CC] text-white text-[11px] font-bold tracking-[0.16em] uppercase px-[30px] py-[13px] rounded no-underline transition-all hover:bg-[#7fc3da] hover:-translate-y-px whitespace-nowrap relative'>
						View Full Catalogue →
					</a>
				</div>
			</div>
		</section>
	);
}

function Disclaimer() {
	return (
		<section className='bg-white px-10 py-16'>
			<div className='max-w-[900px] mx-auto bg-white border-2 border-[#dde8ed] rounded-xl px-6 py-6 md:px-10 md:py-9 shadow-[0_4px_32px_rgba(28,72,85,0.06)]'>
				<div className='flex items-start gap-[18px] mb-7'>
					<div className='text-2xl flex-shrink-0 mt-0.5'>⚠️</div>
					<h4 className='text-[14px] font-extrabold tracking-[0.16em] uppercase text-[#1C4855]'>Important: Research Use Only. Please Read Carefully.</h4>
				</div>
				<div className='bg-[rgba(210,191,160,0.1)] border border-[rgba(210,191,160,0.4)] rounded-lg px-6 py-5 mb-6'>
					<h5 className='text-[11px] font-bold tracking-[0.16em] uppercase text-[#1C4855] mb-2.5'>Potential Side Effects to Be Aware Of</h5>
					<p className='text-[13px] text-[#3a6070] mb-3 leading-[1.7]'>
						As with any research compound, some individuals may experience reactions. Commonly noted in research literature:
					</p>
					<div className='flex flex-wrap gap-2'>
						{['Histamine reaction', 'Localised redness', 'Itching at injection site', 'Facial flushing', 'Temporary warmth'].map((tag) => (
							<span
								key={tag}
								className='text-[11px] font-semibold px-3 py-1.5 rounded bg-[rgba(210,191,160,0.2)] border border-[rgba(210,191,160,0.4)] text-[#3a6070] tracking-[0.04em]'>
								{tag}
							</span>
						))}
					</div>
				</div>
				<div>
					<p className='text-[15px] text-[#3a6070] leading-[1.85] mb-4'>
						All PureTide products are intended for research purposes only and are not approved by Health Canada or the FDA for human or animal consumption. The information on this
						page is provided for educational purposes only and does not constitute medical advice, diagnosis, or treatment recommendations.
					</p>
					<p className='text-[15px] text-[#3a6070] leading-[1.85] mb-4'>
						We are not doctors, pharmacists, or licensed healthcare providers. Nothing on this website should be interpreted as a suggestion to use these compounds on yourself or
						others. Always consult a qualified healthcare professional before beginning any new protocol.
					</p>
					<p className='text-[15px] text-[#3a6070] leading-[1.85] mb-0'>Do your own research. Be informed. Your health decisions are your own.</p>
				</div>
			</div>
		</section>
	);
}

function CTABanner() {
	return (
		<section
			className='bg-gradient-[150deg,#121f24_0%,#1C4855_50%,#22637a_100%] px-10 py-20 text-center relative overflow-hidden'
			style={{ background: 'linear-gradient(135deg, #1C4855 0%, #22637a 100%)' }}>
			<div className='absolute inset-0 bg-[radial-gradient(ellipse_60%_80%_at_50%_110%,rgba(110,180,204,0.18)_0%,transparent_70%)] pointer-events-none' />
			<h2 className='text-[34px] font-bold text-white mb-3 tracking-[-0.02em] relative'>Ready to explore our catalogue?</h2>
			<p className='text-[15px] font-light text-white/55 mb-9 tracking-[0.02em] relative'>
				Every batch includes a Certificate of Analysis. Canadian-based. Third-party tested in Canada by{' '}
				<a
					href='https://testides.com'
					target='_blank'
					rel='noopener'
					className='text-[#6EB4CC] font-bold no-underline'>
					Testides
				</a>
				.
			</p>
			<div className='flex gap-3.5 justify-center flex-wrap relative'>
				<a
					href='https://puretide.ca/#products'
					className='inline-block bg-white text-[#1C4855] text-[11px] font-bold tracking-[0.16em] uppercase px-9 py-[14px] rounded no-underline transition-all hover:bg-[#d4eaf3] hover:-translate-y-px'>
					View All Products
				</a>
				<a
					href='https://puretide.ca/calculator'
					className='inline-block border border-white/25 text-white/75 text-[11px] font-semibold tracking-[0.16em] uppercase px-8 py-[15px] rounded no-underline transition-all hover:border-white/50 hover:text-white hidden'>
					Dosage Calculator
				</a>
			</div>
		</section>
	);
}

function Footer() {
	return (
		<footer className='bg-[#0e191d] px-10 py-9'>
			<div className=' mx-auto flex flex-col md:flex-row items-center justify-between flex-wrap gap-4'>
				<span className='text-[11px] font-medium tracking-[0.1em] uppercase text-white/25'>© 2026 PureTide Peptides. All rights reserved.</span>
				<ul className='flex gap-7 list-none'>
					<li>
						<a
							href='https://puretide.ca/privacy'
							className='text-[11px] font-medium tracking-[0.1em] uppercase text-white/25 no-underline transition-colors hover:text-white/50'>
							Privacy
						</a>
					</li>
					<li>
						<a
							href='https://puretide.ca/terms'
							className='text-[11px] font-medium tracking-[0.1em] uppercase text-white/25 no-underline transition-colors hover:text-white/50'>
							Terms
						</a>
					</li>
					<li>
						<a
							href='https://puretide.ca/#contact'
							className='text-[11px] font-medium tracking-[0.1em] uppercase text-white/25 no-underline transition-colors hover:text-white/50'>
							Contact
						</a>
					</li>
				</ul>
			</div>
		</footer>
	);
}
