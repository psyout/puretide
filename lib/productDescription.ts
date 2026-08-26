export type ProductDescriptionCta = {
	label: string;
	href: string;
};

const PRODUCT_DESCRIPTION_CTAS: ProductDescriptionCta[] = [
	{
		label: 'Sub-Q Format',
		href: 'https://puretide.ca/product/bpc-157',
	},
	{
		label: 'Sub-Q Format',
		href: 'https://puretide.ca/product/kpv',
	},
];

const PRODUCT_CTA_BY_SLUG: Record<string, ProductDescriptionCta> = {
	'kpv-oral-tablets': {
		label: 'Sub-Q Format',
		href: 'https://puretide.ca/product/kpv',
	},
	'bpc-157-oral-tablets': {
		label: 'Sub-Q Format',
		href: 'https://puretide.ca/product/bpc-157',
	},
};

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export const parseProductDescription = (description: string, productSlug?: string): { copy: string; ctas: ProductDescriptionCta[] } => {
	let copy = description;
	const ctas = PRODUCT_DESCRIPTION_CTAS.filter(({ href }) => {
		const escapedHref = escapeRegExp(href);
		const markdownLink = new RegExp(`\\[[^\\]]+\\]\\(${escapedHref}/?\\)`, 'gi');
		const rawLink = new RegExp(`${escapedHref}/?`, 'gi');
		const hasLink = markdownLink.test(copy) || rawLink.test(copy);

		if (hasLink) {
			copy = copy.replace(markdownLink, '').replace(rawLink, '');
		}

		return hasLink;
	});
	const productCta = productSlug ? PRODUCT_CTA_BY_SLUG[productSlug] : undefined;
	if (productCta && !ctas.some(({ href }) => href === productCta.href)) {
		ctas.push(productCta);
	}

	return {
		copy: copy
			.replace(/\s+([,.;:!?])/g, '$1')
			.replace(/(?:^|\s)[|\-–—]+\s*$/g, '')
			.replace(/\s+/g, ' ')
			.trim(),
		ctas,
	};
};
