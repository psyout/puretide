'use client';

import { useState } from 'react';

export default function FAQ() {
	const [openIndex, setOpenIndex] = useState<number | null>(null);

	const faqs = [
		{
			q: 'Are peptides the same as steroids?',
			a: 'No. Peptides and steroids are fundamentally different compounds. Steroids are lipid-based molecules that enter the cell nucleus and alter gene expression broadly. Peptides are amino acid chains that bind to surface receptors and trigger specific, targeted signals. Their mechanisms, structures, and research profiles are entirely distinct.',
		},
		{
			q: 'How are research peptides typically administered?',
			a: 'Administration methods vary by compound and research application. In laboratory research settings, peptides are commonly reconstituted with bacteriostatic water and administered via subcutaneous or intramuscular injection. Some peptides are studied in nasal spray form (such as Semax and Selank). Oral administration is generally less studied for most peptides due to degradation in the digestive tract.\n\nPureTide products are sold as lyophilized (freeze-dried) powder for research purposes only. See the Lyophilization section above for full preparation guidance.',
		},
		{
			q: 'What does "third-party tested" actually mean?',
			a: 'Third-party testing means an independent laboratory (not the manufacturer or the seller) has analysed the compound to verify its identity, purity, and stability. This is the gold standard because it removes the conflict of interest from the quality verification process.\n\nAt PureTide, every batch is tested by Testides, an independent Canadian lab. The Certificate of Analysis (COA) is available directly on each product page so you can verify results before purchasing.',
		},
		{
			q: 'Are peptides legal in Canada?',
			a: 'Research peptides occupy a regulatory space in Canada that varies by compound. Many peptides are not scheduled substances and are legally purchasable for research purposes. They are not approved by Health Canada as drugs, and PureTide sells all products explicitly for research use only, not for human or animal consumption.\n\nIt is your responsibility as a purchaser to understand and comply with the regulations applicable in your jurisdiction.',
		},
		{
			q: 'What is BPC-157 and why is it so popular?',
			a: 'BPC-157 (Body Protective Compound 157) is a synthetic pentadecapeptide derived from a naturally occurring protein found in gastric juice. It is one of the most extensively studied peptides in the recovery and regenerative research space, with a substantial body of preclinical literature examining its influence on tissue recovery, joint health, and cellular regeneration pathways.\n\nIts popularity stems from the breadth of its research profile and the fact that it appears to work through multiple mechanisms simultaneously, including growth factor pathways and angiogenesis.',
			link: { text: 'Shop BPC-157 →', href: 'https://puretide.ca/products/bpc-157' },
		},
		{
			q: 'What is Retatrutide and how is it different?',
			a: 'Retatrutide (LY3437943) is a triple-agonist peptide that simultaneously activates three receptors: GLP-1, GIP, and glucagon. This triple-pathway approach is what separates it from both Ozempic (GLP-1 only) and Mounjaro (GLP-1 + GIP). The addition of glucagon receptor activation drives increased energy expenditure, a mechanism the other two do not include.\n\nPhase 2 clinical trial data shows approximately 24% average weight reduction, the highest of the three. It is currently under continued research and is not approved for human use. Available from PureTide for research purposes only at >99% purity.',
			link: { text: 'Shop Retatrutide →', href: 'https://puretide.ca/products/retatrutide' },
		},
		{
			q: 'What is GHK-Cu and what is it researched for?',
			a: 'GHK-Cu (Copper Peptide) is a naturally occurring tripeptide found in human plasma, saliva, and urine. It is one of the most researched peptides in the skin and wound healing space, with a well-documented profile around collagen and elastin synthesis, antioxidant activity, and dermal repair pathways.\n\nBeyond skin research, it has been studied for its potential role in nerve regeneration and anti-inflammatory activity. Its naturally occurring status and decades of safety research make it one of the more extensively characterised peptides available.',
			link: { text: 'Shop GHK-Cu →', href: 'https://puretide.ca/products/ghk-cu' },
		},
		{
			q: 'What is TB-500?',
			a: 'TB-500 is a synthetic analogue of Thymosin Beta-4, a naturally occurring peptide found throughout the body. It is most frequently studied for its role in tissue repair, particularly in muscle, tendon, and ligament recovery. Its research profile includes modulation of actin, a protein central to cell migration and wound healing.\n\nIt is very commonly stacked with BPC-157 (the Wolverine Stack) because the two compounds are believed to work through complementary pathways, one addressing the repair cascade at a local level while the other supports systemic recovery signalling.',
			link: { text: 'Shop TB-500 →', href: 'https://puretide.ca/products/tb-500' },
		},
		{
			q: 'What is Mots-C?',
			a: 'Mots-C is a peptide encoded by mitochondrial DNA, making it one of the more novel and unusual compounds in the peptide space. It is classified as a mitokine: a signalling molecule released by mitochondria in response to stress. Research has focused primarily on its role in metabolic regulation, insulin sensitivity, and energy homeostasis.\n\nEmerging longevity research has also examined its relationship with age-related metabolic decline, as circulating Mots-C levels appear to decrease with age. It is one of the more recent additions to the PureTide catalogue, reflecting the evolving frontier of mitochondrial peptide science.',
			link: { text: 'Shop Mots-C →', href: 'https://puretide.ca/products/mots-c' },
		},
		{
			q: 'What is Tesamorelin?',
			a: "Tesamorelin is a synthetic analogue of Growth Hormone-Releasing Hormone (GHRH). It stimulates the pituitary gland to produce and release growth hormone in a pulsatile, physiologically natural manner. This is distinct from direct GH administration, which bypasses the body's own regulatory feedback loops.\n\nIt is one of the few peptides with an existing FDA approval: Egrifta, approved for the treatment of excess abdominal fat in adults with HIV-associated lipodystrophy. This makes it one of the most clinically validated compounds in our catalogue.",
			link: { text: 'Shop Tesamorelin →', href: 'https://puretide.ca/products/tesamorelin' },
		},
		{
			q: 'Is NAD+ actually a peptide?',
			a: 'No, and this surprises a lot of people. NAD+ (Nicotinamide Adenine Dinucleotide) is a coenzyme, not a peptide. It is not made of amino acids. It is a molecule present in every living cell, playing a central role in energy metabolism, DNA repair, and the activation of sirtuins, proteins closely associated with cellular longevity.\n\nNAD+ levels naturally decline with age, which has driven significant interest from the longevity research community. We carry it because it is frequently researched alongside peptide protocols, and the wellness goals overlap substantially. It simply works through a different mechanism.',
		},
		{
			q: 'How long does shipping take within Canada?',
			a: 'We ship from within Canada. Most domestic orders arrive within 3 to 7 business days depending on your location. Orders over $400 qualify for free shipping. All transactions are processed discreetly. Packaging is plain with no identifying product information on the outside.',
		},
		{
			q: 'What is the difference between a peptide stack and individual compounds?',
			a: 'A peptide stack is a pre-combined set of two or more individual compounds. Our stacks (like the Wolverine Stack, the Glow Stack, or CJC-1295 / Ipamorelin) are curated combinations that researchers commonly study together based on complementary mechanisms. Stacks offer a convenient way to research multiple compounds simultaneously, often at a better value than purchasing each separately.',
			link: { text: 'View All Stacks →', href: 'https://puretide.ca/products/stacks' },
		},
	];

	return (
		<section
			className='px-12 py-[88px] bg-white'
			id='faqs'>
			<div className='max-w-[980px] mx-auto'>
				<div className='flex items-center gap-[14px] mb-4'>
					<span className='text-[11px] font-bold tracking-[0.26em] uppercase text-[#6EB4CC]'>Frequently Asked</span>
					<span className='flex-1 h-px bg-[#dde8ed] max-w-[48px]' />
				</div>
				<h2 className='text-[clamp(32px,5vw,52px)] font-bold text-[#1C4855] leading-[1.1] mb-4 tracking-[-0.02em]'>Common questions</h2>
				<p className='text-[16px] text-[#3a6070] max-w-[660px] mb-10 leading-[1.75]'>Everything you might be wondering about peptides, our products, and how to get started.</p>
				<div className='flex flex-col gap-1.5'>
					{faqs.map((faq, index) => (
						<div
							key={index}
							className='bg-white border border-[#dde8ed] rounded-md overflow-hidden'>
							<button
								className='w-full bg-none border-none px-[26px] py-[22px] text-left text-[15px] font-semibold text-[#1C4855] cursor-pointer flex justify-between items-center gap-4 transition-colors hover:bg-[#eef6fa] font-inherit tracking-[0.01em]'
								onClick={() => setOpenIndex(openIndex === index ? null : index)}>
								{faq.q}
								<svg
									className={`w-[18px] h-[18px] flex-shrink-0 text-[#6EB4CC] transition-transform ${openIndex === index ? 'rotate-180' : ''}`}
									viewBox='0 0 24 24'
									fill='none'
									stroke='currentColor'
									strokeWidth='2.5'>
									<path d='M6 9l6 6 6-6' />
								</svg>
							</button>
							<div className={`overflow-hidden transition-all duration-300 ${openIndex === index ? 'max-h-[700px]' : 'max-h-0'}`}>
								<div className='px-[26px] py-[18px] pb-[22px] text-[15px] text-[#3a6070] leading-[1.8] border-t border-[#dde8ed]'>
									{faq.a.split('\n\n').map((paragraph, i) => (
										<p
											key={i}
											className={i > 0 ? 'mt-2.5' : 'mb-0'}>
											{paragraph}
										</p>
									))}
									{faq.link && (
										<p className='mt-3.5'>
											<a
												href={faq.link.href}
												className='text-[#1C4855] font-bold text-[12px] tracking-[0.1em] no-underline uppercase hover:underline'>
												{faq.link.text}
											</a>
										</p>
									)}
								</div>
							</div>
						</div>
					))}
				</div>
			</div>
		</section>
	);
}
