import crypto from 'crypto';

type ApiErrorOptions = {
	defaultMessage: string;
	error: unknown;
	logLabel: string;
};

export function buildSafeApiError({ defaultMessage, error, logLabel }: ApiErrorOptions): { message: string; errorId: string } {
	const errorId = crypto.randomUUID();
	console.error(`[${logLabel}] ${errorId}`, error);
	const isProduction = process.env.NODE_ENV === 'production';
	if (isProduction) {
		return { message: defaultMessage, errorId };
	}
	return {
		message: error instanceof Error ? error.message : defaultMessage,
		errorId,
	};
}
