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
	// Block all search engines from indexing
	async headers() {
		return [
			{
				source: '/:path*',
				headers: [
					{
						key: 'X-Robots-Tag',
						value: 'noindex, nofollow, noarchive, nosnippet, noimageindex',
					},
				],
			},
		];
	},
};

module.exports = nextConfig;
