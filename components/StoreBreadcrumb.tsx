import Link from 'next/link';
import { ChevronRight } from 'lucide-react';

type BreadcrumbItem = {
	label: string;
	href?: string;
};

type StoreBreadcrumbProps = {
	items: BreadcrumbItem[];
};

export default function StoreBreadcrumb({ items }: StoreBreadcrumbProps) {
	return (
		<nav aria-label='Breadcrumb' className='scrollbar-hide mb-6 mt-5 min-w-0 overflow-x-auto'>
			<ol className='flex w-max min-w-full items-center gap-1.5 text-sm leading-6'>
				{items.map((item, index) => {
					const isCurrent = index === items.length - 1;
					return (
						<li key={`${item.label}-${index}`} className='flex shrink-0 items-center gap-1.5'>
							{index > 0 && (
								<ChevronRight
									aria-hidden='true'
									className='h-4 w-4 shrink-0 text-deep-tidal-teal-400'
								/>
							)}
							{item.href && !isCurrent ? (
								<Link href={item.href} className='rounded-sm font-medium text-deep-tidal-teal-600 underline-offset-4 transition-colors hover:text-deep-tidal-teal hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-deep-tidal-teal/40'>
									{item.label}
								</Link>
							) : (
								<span aria-current={isCurrent ? 'page' : undefined} className='font-semibold text-deep-tidal-teal-800'>
									{item.label}
								</span>
							)}
						</li>
					);
				})}
			</ol>
		</nav>
	);
}
