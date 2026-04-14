/** @type {import('next').NextConfig} */
const nextConfig = {
	// Privacy-focused: Disable telemetry
	reactStrictMode: true,
	// No external tracking scripts
	poweredByHeader: false,
	// Smaller deployment footprint and faster startups
	output: 'standalone',
	// Disable source maps in production to prevent 404 errors and improve security
	productionBrowserSourceMaps: false,
	// Optimize remote images (product bottles from CDN)
	images: {
		remotePatterns: [
			{
				protocol: 'https',
				hostname: 'cdn.shopify.com',
			},
		],
	},
	// Reduce client bundle size for icon library
	experimental: {
		optimizePackageImports: ['lucide-react'],
		// Prevents MODULE_NOT_FOUND vendor-chunks errors with googleapis
		serverComponentsExternalPackages: ['googleapis', 'sql.js'],
	},
	// Security & privacy: block indexing (keep under the radar) + harden headers
	async headers() {
		const isDev = process.env.NODE_ENV !== 'production';
		return [
			{
				source: '/:path*',
				headers: [
					// Keep: block all search engines from indexing
					{
						key: 'X-Robots-Tag',
						value: 'noindex, nofollow, noarchive, nosnippet, noimageindex',
					},
					{ key: 'X-Frame-Options', value: 'DENY' },
					{ key: 'X-Content-Type-Options', value: 'nosniff' },
					{ key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
					// Content Security Policy
					{
						key: 'Content-Security-Policy',
						value: [
							"default-src 'self'",
							"script-src 'self' 'unsafe-eval' 'unsafe-inline' connect.facebook.net www.facebook.com https://connect.facebook.net https://www.facebook.com", // Next.js requires unsafe-eval/inline in dev + Meta Pixel
							"style-src 'self' 'unsafe-inline' fonts.googleapis.com", // For Tailwind CSS + Google Fonts
							"img-src 'self' data: blob: www.facebook.com connect.facebook.net https://www.facebook.com https://connect.facebook.net", // Meta Pixel tracking
							"font-src 'self' data: fonts.gstatic.com",
							"connect-src 'self' connect.facebook.net www.facebook.com https://connect.facebook.net https://www.facebook.com", // Meta Pixel API calls
							"frame-ancestors 'none'",
							"form-action 'self'",
						].join('; '),
					},
					// Permissions Policy
					{
						key: 'Permissions-Policy',
						value: ['camera=()', 'microphone=()', 'geolocation=()', 'payment=()', 'usb=()', 'magnetometer=()', 'gyroscope=()', 'accelerometer=()'].join(', '),
					},
					// HSTS (HTTPS only)
					...(isDev
						? []
						: [
								{
									key: 'Strict-Transport-Security',
									value: 'max-age=31536000; includeSubDomains; preload',
								},
							]),
				],
			},
		];
	},
};

module.exports = nextConfig;
