import crypto from 'crypto';
import { createLogger } from './logger';

const logger = createLogger('apiError');

type ApiErrorOptions = {
	defaultMessage: string;
	error: unknown;
	logLabel: string;
};

export function buildSafeApiError({ defaultMessage, error, logLabel }: ApiErrorOptions): { message: string; errorId: string } {
	const errorId = crypto.randomUUID();

	if (error instanceof Error) {
		logger.error(defaultMessage, error, { logLabel, errorId });
	} else {
		logger.error(defaultMessage, undefined, { logLabel, errorId, error: String(error) });
	}

	const isProduction = process.env.NODE_ENV === 'production';
	if (isProduction) {
		return { message: defaultMessage, errorId };
	}
	return {
		message: error instanceof Error ? error.message : defaultMessage,
		errorId,
	};
}
