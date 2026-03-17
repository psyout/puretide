'use client';

import { useEffect, useState } from 'react';

interface AutoRefreshProps {
	interval?: number;
	maxRefreshes?: number;
	children: (refreshCount: number) => React.ReactNode;
}

export function AutoRefresh({ interval = 5000, maxRefreshes = 20, children }: AutoRefreshProps) {
	const [refreshCount, setRefreshCount] = useState(0);

	useEffect(() => {
		if (refreshCount >= maxRefreshes) return;

		const timer = setTimeout(() => {
			window.location.reload();
		}, interval);

		return () => clearTimeout(timer);
	}, [refreshCount, interval, maxRefreshes]);

	useEffect(() => {
		setRefreshCount(prev => prev + 1);
	}, []);

	return <>{children(refreshCount)}</>;
}
