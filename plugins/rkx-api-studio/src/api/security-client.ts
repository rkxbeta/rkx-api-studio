import apiFetch from '@wordpress/api-fetch';

const SECURITY_PATH = '/rkx-api-studio/v1/security';

export interface KeyStatus {
	exists: boolean;
	lastRegenerated: string | null;
}

export interface GenerateKeyResponse {
	key: string;
	status: KeyStatus;
}

export interface KeyRecord {
	id: string;
	label: string;
	createdAt: string;
	lastUsed: string | null;
	requestCount: number;
}

/**
 * Convert a backend key status response (snake_case) to frontend format (camelCase).
 * @param data
 */
function keyStatusFromApi( data: Record< string, unknown > ): KeyStatus {
	return {
		exists: Boolean( data.exists ?? false ),
		lastRegenerated: data.last_regenerated
			? String( data.last_regenerated )
			: null,
	};
}

/**
 * Convert a backend generate/regenerate response to frontend format.
 * @param data
 */
function generateKeyResponseFromApi(
	data: Record< string, unknown >
): GenerateKeyResponse {
	return {
		key: String( data.key || '' ),
		status: keyStatusFromApi(
			( data.status as Record< string, unknown > ) ?? {}
		),
	};
}

/**
 * Get the current API key status (exists, last regenerated timestamp).
 */
export async function getKeyStatus(): Promise< KeyStatus > {
	const data = await apiFetch< Record< string, unknown > >( {
		path: `${ SECURITY_PATH }/status`,
	} );
	return keyStatusFromApi( data );
}

/**
 * Generate a new API key. Returns the plaintext key once.
 */
export async function generateKey(): Promise< GenerateKeyResponse > {
	const data = await apiFetch< Record< string, unknown > >( {
		path: `${ SECURITY_PATH }/generate`,
		method: 'POST',
	} );
	return generateKeyResponseFromApi( data );
}

/**
 * Regenerate the API key. Invalidates the previous key and returns the new plaintext key once.
 */
export async function regenerateKey(): Promise< GenerateKeyResponse > {
	const data = await apiFetch< Record< string, unknown > >( {
		path: `${ SECURITY_PATH }/regenerate`,
		method: 'POST',
	} );
	return generateKeyResponseFromApi( data );
}
