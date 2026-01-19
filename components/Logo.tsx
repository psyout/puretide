interface LogoProps {
	className?: string;
	fillColor?: string;
}

export default function Logo({ className = 'h-10 w-auto', fillColor = 'fill-white' }: LogoProps) {
	return (
		<svg
			version='1.1'
			viewBox='0 0 559.8 430.1'
			className={className}
			xmlns='http://www.w3.org/2000/svg'>
			<g>
				<g>
					<path
						className={fillColor}
						d='M551,279c-59.7,8.2-120-2.4-173-35.4L300.2,195c-48.8-30.5-105.9-33.1-154.9-7c-60.1,32-84.7,61.7-144.6,78.7
			L0,151.4c101-70.3,196-122,320.9-66.5c88.9,39.5,120.7,98.9,229.6,91.6L551,279L551,279z'
					/>
					<path
						className={fillColor}
						d='M550.6,321.7V428c-188.8,20.4-264-113.5-453.8-34.1c-31.2,13-60.8,21.5-96.2,30.6l0.2-113.1l83.6-28.8
			c96-33.2,202.4-25.9,296.8,9.7C436.8,313.1,489.4,321.3,550.6,321.7L550.6,321.7z'
					/>
				</g>
				<circle
					className={fillColor}
					cx='498.4'
					cy='61.5'
					r='61.5'
				/>
			</g>
		</svg>
	);
}
