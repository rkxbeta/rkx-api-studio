import { applyFilters } from '@wordpress/hooks';
import { RKX_AS_HOOK_IMPORT_ENDPOINT } from '../hooks/rkx-as-hooks';
/**
 * Pure validation functions for imported JSON data.
 *
 * Validates that uploaded JSON conforms to the expected endpoint
 * configuration schema before any network requests are made.
 */

import { __, sprintf } from '@wordpress/i18n';
import type { EndpointConfig } from '../types';

export interface ImportValidationError {
	index: number;
	name?: string;
	field: string;
	message: string;
}

/** Raw imported endpoint in snake_case backend format. */
export interface ImportedEndpoint {
	id?: string;
	name: string;
	slug: string;
	method?: string;
	description?: string;
	data_source: string;
	custom_taxonomy?: string;
	fields: string[];
	per_page?: number;
	offset?: number;
	order?: string;
	orderby?: string;
	use_wordpress_defaults?: boolean;
	created_at?: string;
	updated_at?: string;
	// Extended fields (fix for import/export missing features)
	field_formatters?: Record< string, unknown[] >;
	taxonomy_filters?: Record< string, number[] >;
	protected?: boolean;
	/** Data contributed by installed extensions through `rkxAs.import.endpoint`. */
	[ extension: string ]: unknown;
}

export interface ImportedCacheSettings {
	cache_enabled: boolean;
	cache_ttl: number;
}

export interface SkippedEndpoint {
	index: number;
	name: string;
	reason: string;
}

export interface ImportValidationResult {
	valid: boolean;
	endpoints: ImportedEndpoint[];
	errors: ImportValidationError[];
	skipped: SkippedEndpoint[];
	settings?: ImportedCacheSettings;
}

/** Known valid built-in data source values. */
export const VALID_DATA_SOURCES = [
	'posts',
	'pages',
	'categories',
	'tags',
] as const;

/**
 * Check if a data_source value is valid.
 * Accepts built-in sources and any non-empty string (custom taxonomy).
 * @param value
 */
export function isValidDataSource( value: string ): boolean {
	return typeof value === 'string' && value.trim().length > 0;
}

/**
 * Validate a single endpoint entry against the schema.
 * @param entry
 * @param index
 */
export function validateEndpointEntry(
	entry: unknown,
	index: number
): {
	valid: boolean;
	endpoint?: ImportedEndpoint;
	errors: ImportValidationError[];
	skipped?: boolean;
	skipReason?: string;
} {
	const errors: ImportValidationError[] = [];
	const entryName =
		typeof entry === 'object' &&
		entry !== null &&
		'name' in entry &&
		typeof ( entry as Record< string, unknown > ).name === 'string'
			? ( ( entry as Record< string, unknown > ).name as string )
			: undefined;

	if (
		typeof entry !== 'object' ||
		entry === null ||
		Array.isArray( entry )
	) {
		errors.push( {
			index,
			name: entryName,
			field: 'entry',
			message: __( 'Entry must be an object.', 'rkx-api-studio' ),
		} );
		return { valid: false, errors };
	}

	const obj = entry as Record< string, unknown >;
	// Never normalize malformed access controls into a weaker configuration.
	if (
		( obj.protected !== undefined && typeof obj.protected !== 'boolean' ) ||
		( obj.auth_scheme !== undefined &&
			( typeof obj.auth_scheme !== 'string' ||
				( obj.auth_scheme !== '' &&
					! /^[a-z0-9_-]+$/.test( obj.auth_scheme ) ) ) ) ||
		( obj.allowed_keys !== undefined &&
			( ! Array.isArray( obj.allowed_keys ) ||
				! obj.allowed_keys.every(
					( key ) => typeof key === 'string' && key.trim().length > 0
				) ) ) ||
		( obj.method !== undefined &&
			( typeof obj.method !== 'string' ||
				! [ 'GET', 'POST', 'PUT', 'DELETE' ].includes(
					obj.method.toUpperCase()
				) ) )
	) {
		errors.push( {
			index,
			name: entryName,
			field: 'access',
			message: __(
				'Invalid authentication, key restrictions or method.',
				'rkx-api-studio'
			),
		} );
	}

	// Validate name
	if ( typeof obj.name !== 'string' || obj.name.trim().length === 0 ) {
		errors.push( {
			index,
			name: entryName,
			field: 'name',
			message: __(
				'name is required and must be a non-empty string.',
				'rkx-api-studio'
			),
		} );
	}

	// Validate slug
	if ( typeof obj.slug !== 'string' || obj.slug.trim().length === 0 ) {
		errors.push( {
			index,
			name: entryName,
			field: 'slug',
			message: __(
				'slug is required and must be a non-empty string.',
				'rkx-api-studio'
			),
		} );
	}

	// Determine if this is a write method (POST, PUT, DELETE)
	const method =
		typeof obj.method === 'string' ? obj.method.toUpperCase() : 'GET';
	const isWriteMethod = [ 'POST', 'PUT', 'DELETE' ].includes( method );

	// Validate data_source (skip for write methods — they don't query data)
	if (
		! isWriteMethod &&
		( typeof obj.data_source !== 'string' ||
			! isValidDataSource( obj.data_source ) )
	) {
		errors.push( {
			index,
			name: entryName,
			field: 'data_source',
			message: __(
				'data_source is required and must be a non-empty string.',
				'rkx-api-studio'
			),
		} );
	}

	// Validate fields (skip for write methods — they don't need fields)
	if (
		! isWriteMethod &&
		( ! Array.isArray( obj.fields ) || obj.fields.length === 0 )
	) {
		errors.push( {
			index,
			name: entryName,
			field: 'fields',
			message: __(
				'fields is required and must be a non-empty array of strings.',
				'rkx-api-studio'
			),
		} );
	} else if ( ! isWriteMethod && Array.isArray( obj.fields ) ) {
		const allStrings = obj.fields.every(
			( f: unknown ) => typeof f === 'string'
		);
		if ( ! allStrings ) {
			errors.push( {
				index,
				name: entryName,
				field: 'fields',
				message: __(
					'All items in fields must be strings.',
					'rkx-api-studio'
				),
			} );
		}
	}

	if ( errors.length > 0 ) {
		return { valid: false, errors };
	}

	const endpoint: ImportedEndpoint = {
		name: obj.name as string,
		slug: obj.slug as string,
		method: isWriteMethod ? method : 'GET',
		data_source: obj.data_source as string,
		fields: Array.isArray( obj.fields ) ? ( obj.fields as string[] ) : [],
	};

	// Copy optional fields if present and valid
	if ( typeof obj.id === 'string' ) {
		endpoint.id = obj.id;
	}
	if ( typeof obj.description === 'string' ) {
		endpoint.description = obj.description;
	}
	if ( typeof obj.custom_taxonomy === 'string' ) {
		endpoint.custom_taxonomy = obj.custom_taxonomy;
	}
	if ( typeof obj.per_page === 'number' ) {
		endpoint.per_page = obj.per_page;
	}
	if ( typeof obj.offset === 'number' ) {
		endpoint.offset = obj.offset;
	}
	if ( typeof obj.order === 'string' ) {
		endpoint.order = obj.order;
	}
	if ( typeof obj.orderby === 'string' ) {
		endpoint.orderby = obj.orderby;
	}
	if ( typeof obj.use_wordpress_defaults === 'boolean' ) {
		endpoint.use_wordpress_defaults = obj.use_wordpress_defaults;
	}
	if ( typeof obj.created_at === 'string' ) {
		endpoint.created_at = obj.created_at;
	}
	if ( typeof obj.updated_at === 'string' ) {
		endpoint.updated_at = obj.updated_at;
	}

	// Copy extended fields if present and valid type
	if (
		typeof obj.field_formatters === 'object' &&
		obj.field_formatters !== null &&
		! Array.isArray( obj.field_formatters )
	) {
		endpoint.field_formatters = obj.field_formatters as Record<
			string,
			unknown[]
		>;
	}
	if (
		typeof obj.taxonomy_filters === 'object' &&
		obj.taxonomy_filters !== null &&
		! Array.isArray( obj.taxonomy_filters )
	) {
		endpoint.taxonomy_filters = obj.taxonomy_filters as Record<
			string,
			number[]
		>;
	}
	if ( typeof obj.protected === 'boolean' ) {
		endpoint.protected = obj.protected;
	}

	// Installed extensions may copy and validate their own exported data.
	// Returning a non-object rejects the entry.
	const extended = applyFilters(
		RKX_AS_HOOK_IMPORT_ENDPOINT,
		endpoint,
		obj
	) as ImportedEndpoint | false;
	if ( ! extended || typeof extended !== 'object' ) {
		return {
			valid: false,
			errors: [
				{
					index,
					name: entryName,
					field: 'extension',
					message: __(
						'This entry contains invalid extension data.',
						'rkx-api-studio'
					),
				},
			],
		};
	}

	// Endpoints restricted to named keys require an installed provider.
	// Free must never silently convert named-key restrictions into the global API key.
	const hasNamedKeyRestrictions =
		( Array.isArray( obj.allowed_keys ) && obj.allowed_keys.length > 0 ) ||
		( typeof obj.auth_scheme === 'string' &&
			obj.auth_scheme !== '' &&
			obj.auth_scheme !== 'key' );
	const hasActiveNamedKeyHandler =
		Array.isArray( extended.allowed_keys ) &&
		extended.allowed_keys.length > 0;

	if ( hasNamedKeyRestrictions && ! hasActiveNamedKeyHandler ) {
		return {
			valid: false,
			skipped: true,
			skipReason: __(
				'Named-key restrictions require an active key management extension.',
				'rkx-api-studio'
			),
			errors: [
				{
					index,
					name: entryName,
					field: 'access',
					message: __(
						'Endpoint requires named-key restrictions and cannot be imported.',
						'rkx-api-studio'
					),
				},
			],
		};
	}

	return {
		valid: true,
		endpoint: {
			...extended,
			name: endpoint.name,
			slug: endpoint.slug,
			...( endpoint.protected || extended.protected === true
				? { protected: true }
				: { protected: endpoint.protected } ),
		},
		errors: [],
	};
}

/**
 * Validate that raw parsed JSON conforms to the expected import schema.
 * Returns structured validation result with per-entry errors.
 * @param data
 */
export function validateImportData( data: unknown ): ImportValidationResult {
	let settings: ImportedCacheSettings | undefined;
	if (
		typeof data === 'object' &&
		data !== null &&
		! Array.isArray( data ) &&
		'version' in data
	) {
		const document = data as Record< string, unknown >;
		const raw = document.settings as Record< string, unknown > | undefined;
		if (
			document.version !== 1 ||
			! raw ||
			typeof raw.cache_enabled !== 'boolean' ||
			! [ 60, 300, 900, 1800, 3600 ].includes( raw.cache_ttl as number )
		) {
			return {
				valid: false,
				endpoints: [],
				errors: [
					{
						index: -1,
						field: 'settings',
						message: __(
							'Invalid export version or cache settings.',
							'rkx-api-studio'
						),
					},
				],
				skipped: [],
			};
		}
		settings = {
			cache_enabled: raw.cache_enabled,
			cache_ttl: raw.cache_ttl as number,
		};
		data = document.endpoints;
	}
	if ( ! Array.isArray( data ) ) {
		return {
			valid: false,
			endpoints: [],
			errors: [
				{
					index: -1,
					field: 'root',
					message: __(
						'Import data must be an array.',
						'rkx-api-studio'
					),
				},
			],
			skipped: [],
		};
	}

	const endpoints: ImportedEndpoint[] = [];
	const errors: ImportValidationError[] = [];
	const skipped: SkippedEndpoint[] = [];

	for ( let i = 0; i < data.length; i++ ) {
		const result = validateEndpointEntry( data[ i ], i );
		if ( result.skipped ) {
			skipped.push( {
				index: i,
				name:
					( data[ i ] as { name?: string } )?.name ||
					sprintf(
						/* translators: %d: entry number in the import file */
						__( 'Entry %d', 'rkx-api-studio' ),
						i + 1
					),
				reason:
					result.skipReason ||
					__(
						'Unsupported endpoint configuration.',
						'rkx-api-studio'
					),
			} );
		} else if ( result.valid && result.endpoint ) {
			endpoints.push( result.endpoint );
		} else {
			errors.push( ...result.errors );
		}
	}

	return {
		valid: errors.length === 0,
		endpoints,
		errors,
		skipped,
		...( settings ? { settings } : {} ),
	};
}

export interface DuplicateEntry {
	importedEndpoint: ImportedEndpoint;
	existingEndpoint: EndpointConfig;
	matchType: 'id' | 'slug';
	resolution: 'overwrite' | 'skip';
}

/**
 * Detect duplicates between imported endpoints and existing endpoints.
 *
 * An imported endpoint is a duplicate if:
 * - Its `id` matches an existing endpoint's `id`, OR
 * - Its `slug` AND `method` match an existing endpoint's `slug` and `method`
 *
 * Same slug with different methods is NOT a conflict (RESTful pattern).
 * ID matches take priority over slug+method matches. Each duplicate defaults
 * to a resolution of 'skip' to prevent accidental overwrites.
 * @param imported
 * @param existing
 */
export function detectDuplicates(
	imported: ImportedEndpoint[],
	existing: EndpointConfig[]
): { duplicates: DuplicateEntry[]; unique: ImportedEndpoint[] } {
	const existingById = new Map< string, EndpointConfig >();
	const existingBySlugMethod = new Map< string, EndpointConfig >();

	for ( const endpoint of existing ) {
		existingById.set( endpoint.id, endpoint );
		const key = `${ endpoint.slug }::${ (
			endpoint.method ?? 'GET'
		).toUpperCase() }`;
		existingBySlugMethod.set( key, endpoint );
	}

	const duplicates: DuplicateEntry[] = [];
	const unique: ImportedEndpoint[] = [];

	for ( const importedEndpoint of imported ) {
		const idMatch =
			importedEndpoint.id !== undefined
				? existingById.get( importedEndpoint.id )
				: undefined;
		const slugMethodKey = `${ importedEndpoint.slug }::${ (
			importedEndpoint.method ?? 'GET'
		).toUpperCase() }`;
		const slugMethodMatch = existingBySlugMethod.get( slugMethodKey );

		if ( idMatch ) {
			duplicates.push( {
				importedEndpoint,
				existingEndpoint: idMatch,
				matchType: 'id',
				resolution: 'skip',
			} );
		} else if ( slugMethodMatch ) {
			duplicates.push( {
				importedEndpoint,
				existingEndpoint: slugMethodMatch,
				matchType: 'slug',
				resolution: 'skip',
			} );
		} else {
			unique.push( importedEndpoint );
		}
	}

	return { duplicates, unique };
}
