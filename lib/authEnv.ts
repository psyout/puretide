const TRUE_VALUES = new Set(['1', 'true', 'yes', 'on']);

export function isExplicitDevBypassEnabled(flagName: string): boolean {
	const isProduction = process.env.NODE_ENV === 'production';
	if (isProduction) {
		return false;
	}
	const raw = process.env[flagName];
	if (!raw) {
		return false;
	}
	return TRUE_VALUES.has(raw.trim().toLowerCase());
}
