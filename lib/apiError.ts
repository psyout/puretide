import crypto from 'crypto';
import { createLogger } from './logger';

const logger = createLogger('apiError');

type ApiErrorOptions = {
	defaultMessage: string;
	error: unknown;
	logLabel: string;
};

export function buildSafeApiError({ defaultMessage, error, logLabel }: ApiErrorOptions): { message: string; errorId: string } {
	const contextErrorId = crypto.randomUUID();
	const stableErrorId =
		(error instanceof Error
			? logger.error(defaultMessage, error, { logLabel, errorId: contextErrorId })
			: logger.error(defaultMessage, undefined, { logLabel, errorId: contextErrorId, error: String(error) })) ?? contextErrorId;

	const isProduction = process.env.NODE_ENV === 'production';
	if (isProduction) {
		return { message: defaultMessage, errorId: stableErrorId };
	}
	return {
		message: error instanceof Error ? error.message : defaultMessage,
		errorId: stableErrorId,
	};
}
