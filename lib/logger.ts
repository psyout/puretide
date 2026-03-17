import crypto from 'crypto';

export type LogLevel = 'error' | 'warn' | 'info' | 'debug';

export interface LogEntry {
	level: LogLevel;
	timestamp: string;
	message: string;
	errorId?: string;
	context?: Record<string, unknown>;
	error?: {
		name?: string;
		message?: string;
		stack?: string;
	};
}

const isProduction = process.env.NODE_ENV === 'production';

function sanitizeForLogging(value: unknown): unknown {
	if (value === null || value === undefined) return value;
	if (typeof value === 'string') {
		// Remove potential PII patterns (emails, phone numbers, postal codes)
		return value
			.replace(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, '[EMAIL]')
			.replace(/\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/g, '[PHONE]')
			.replace(/\b[A-Za-z]\d[A-Za-z] \d[A-Za-z]\d\b/g, '[POSTAL]')
			.replace(/\b\d{5}(-\d{4})?\b/g, '[ZIP]');
	}
	if (Array.isArray(value)) {
		return value.map(sanitizeForLogging);
	}
	if (typeof value === 'object') {
		const sanitized: Record<string, unknown> = {};
		for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
			// Skip sensitive keys entirely
			if (/password|secret|token|key|auth|cookie/i.test(key)) continue;
			sanitized[key] = sanitizeForLogging(val);
		}
		return sanitized;
	}
	return value;
}

function formatLogEntry(entry: LogEntry): string {
	const sanitized = isProduction ? sanitizeForLogging(entry.context) : entry.context;
	const logData = {
		...entry,
		context: sanitized,
		// Include error details only in non-production
		...(entry.error && !isProduction && { error: entry.error }),
	};
	return JSON.stringify(logData);
}

export function createLogger(label: string) {
	const errorId = () => crypto.randomUUID();

	return {
		error: (message: string, error?: Error, context?: Record<string, unknown>) => {
			const entry: LogEntry = {
				level: 'error',
				timestamp: new Date().toISOString(),
				message: `[${label}] ${message}`,
				errorId: errorId(),
				context,
				error: error ? {
					name: error.name,
					message: error.message,
					stack: error.stack,
				} : undefined,
			};
			console.error(formatLogEntry(entry));
			return entry.errorId;
		},

		warn: (message: string, context?: Record<string, unknown>) => {
			const entry: LogEntry = {
				level: 'warn',
				timestamp: new Date().toISOString(),
				message: `[${label}] ${message}`,
				context,
			};
			console.warn(formatLogEntry(entry));
		},

		info: (message: string, context?: Record<string, unknown>) => {
			const entry: LogEntry = {
				level: 'info',
				timestamp: new Date().toISOString(),
				message: `[${label}] ${message}`,
				context,
			};
			console.log(formatLogEntry(entry));
		},

		debug: (message: string, context?: Record<string, unknown>) => {
			if (isProduction) return; // Skip debug logs in production
			const entry: LogEntry = {
				level: 'debug',
				timestamp: new Date().toISOString(),
				message: `[${label}] ${message}`,
				context,
			};
			console.debug(formatLogEntry(entry));
		},
	};
}
