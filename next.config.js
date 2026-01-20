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
	},
};

module.exports = nextConfig;
