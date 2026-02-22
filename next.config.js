/** @type {import('next').NextConfig} */
const nextConfig = {
	// Privacy-focused: Disable telemetry
	reactStrictMode: true,
	// No external tracking scripts
	poweredByHeader: false,
	// Smaller deployment footprint and faster startups
	output: 'standalone',
	// Reduce client bundle size for icon library
	experimental: {
		optimizePackageImports: ['lucide-react'],
		// Prevents MODULE_NOT_FOUND vendor-chunks errors with googleapis
		serverComponentsExternalPackages: ['googleapis', 'sql.js'],
	},
	// Security & privacy: block indexing (keep under the radar) + harden headers
	async headers() {
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
				],
			},
		];
	},
};

module.exports = nextConfig;
