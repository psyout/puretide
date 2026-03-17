import { validateEnv } from './env';

// Validate environment on startup
try {
	validateEnv();
} catch (error) {
	console.error('Failed to validate environment:', error);
	// In production, fail fast
	if (process.env.NODE_ENV === 'production') {
		process.exit(1);
	}
}
