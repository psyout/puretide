/** @type {import('next').NextConfig} */
const nextConfig = {
	// Auth0's optional DPoP helper intentionally uses a runtime-computed import
	// for Node's crypto module. Webpack cannot analyze that expression and emits
	// a harmless "Critical dependency" warning even when DPoP is not enabled.
	webpack(config) {
		config.ignoreWarnings = [
			...(config.ignoreWarnings ?? []),
			{
				module: /@auth0[\\/]nextjs-auth0[\\/]dist[\\/]utils[\\/]dpopUtils\.js$/,
				message: /Critical dependency: the request of a dependency is an expression/,
			},
			{
				module: /jose[\\/]dist[\\/]webapi[\\/]lib[\\/]deflate\.js$/,
				message: /A Node\.js API is used \((?:Compression|Decompression)Stream[^)]*\) which is not supported in the Edge Runtime/,
			},
		];
		return config;
	},
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
		// sql.js loads its WebAssembly binary at runtime, so Next cannot discover it
		// from the JavaScript import alone. Keep it in every standalone server trace.
		outputFileTracingIncludes: {
			'/*': ['./node_modules/sql.js/dist/sql-wasm.wasm'],
		},
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
							"script-src 'self' 'unsafe-eval' 'unsafe-inline'",
							"style-src 'self' 'unsafe-inline' fonts.googleapis.com",
							"img-src 'self' data: blob:",
							"font-src 'self' data: fonts.gstatic.com",
							"connect-src 'self'",
							"frame-src 'self' https://bluepeakdns.com https://api.pcivault.io https://*.pcivault.io",
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
