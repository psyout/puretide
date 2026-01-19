import type { Config } from 'tailwindcss';

const config: Config = {
	content: ['./pages/**/*.{js,ts,jsx,tsx,mdx}', './components/**/*.{js,ts,jsx,tsx,mdx}', './app/**/*.{js,ts,jsx,tsx,mdx}'],
	theme: {
		extend: {
			fontFamily: {
				matimo: ['var(--font-matimo)'],
			},
			colors: {
				background: 'var(--background)',
				foreground: 'var(--foreground)',
				'deep-tidal-teal': {
					DEFAULT: '#1a5f6f',
					50: '#e6f2f5',
					100: '#b3d9e0',
					200: '#80c0cb',
					300: '#4da7b6',
					400: '#1a8ea1',
					500: '#1a5f6f',
					600: '#154a57',
					700: '#10353f',
					800: '#0a2027',
					900: '#050b0f',
				},
				'mineral-white': {
					DEFAULT: '#f8f9fa',
					50: '#ffffff',
					100: '#f8f9fa',
					200: '#e9ecef',
					300: '#dee2e6',
					400: '#ced4da',
					500: '#adb5bd',
				},
				'muted-sage': {
					DEFAULT: '#9caf9c',
					50: '#f0f5f0',
					100: '#d9e4d9',
					200: '#c2d3c2',
					300: '#abc2ab',
					400: '#9caf9c',
					500: '#8d9c8d',
					600: '#6b7a6b',
					700: '#495849',
				},
				eucalyptus: {
					DEFAULT: '#a8d5ba',
					50: '#f0f8f4',
					100: '#d4ede0',
					200: '#b8e2cc',
					300: '#a8d5ba',
					400: '#7fc29a',
					500: '#56af7a',
					600: '#3d7d56',
				},
				'soft-driftwood': {
					DEFAULT: '#d4c5b0',
					50: '#f5f2ed',
					100: '#ebe5da',
					200: '#e1d8c7',
					300: '#d4c5b0',
					400: '#c7b299',
					500: '#ba9f82',
					600: '#8d7a64',
				},
			},
		},
	},
	plugins: [],
};
export default config;
