import apiFetch from '@wordpress/api-fetch';
import { applyFilters } from '@wordpress/hooks';
import {
	RKX_AS_HOOK_API_CONFIG,
	RKX_AS_HOOK_API_PAYLOAD,
} from '../hooks/rkx-as-hooks';
import type {
	DataSourceItem,
	DataSourceMetadata,
	EndpointConfig,
	FieldFormatterItem,
	FieldFormattersMap,
	FormatterEntry,
	HttpMethod,
	OrderbyField,
	TaxonomyFiltersMap,
	TermSearchResult,
} from '../types';

const ENDPOINTS_PATH = '/rkx-api-studio/v1/endpoints';
const DATA_SOURCES_PATH = '/rkx-api-studio/v1/data-sources';

/**
 * Convert a frontend EndpointConfig (camelCase) to the PHP backend format (snake_case).
 * @param config
 */
export function toApiPayload(
	config: EndpointConfig
): Record< string, unknown > {
	const payload: Record< string, unknown > = {
		name: config.name,
		slug: config.slug,
		method: config.method || 'GET',
		data_source: config.dataSource,
		fields: config.fields,
		per_page: config.perPage,
		offset: config.offset,
		order: config.order,
		orderby: config.orderby,
		use_wordpress_defaults: config.useWordPressDefaults ?? false,
		description: config.description || '',
	};

	// Only send custom_taxonomy when the value is present (legacy backward compat)
	if ( config.customTaxonomy ) {
		payload.custom_taxonomy = config.customTaxonomy;
	}

	payload.taxonomy_filters = config.taxonomyFilters ?? {};
	payload.field_formatters = config.fieldFormatters ?? {};

	if ( config.protected !== undefined ) {
		payload.protected = config.protected;
	} else {
		payload.protected = false;
	}

	// Installed extensions may add their own request data.
	const extended = applyFilters( RKX_AS_HOOK_API_PAYLOAD, payload, config );
	return extended && typeof extended === 'object'
		? ( extended as Record< string, unknown > )
		: payload;
}

/**
 * Parse a single field formatter entry from the API response.
 * String entries are kept as-is. Object entries with `id` and `config` keys
 * are parsed into FormatterEntry typed items.
 * @param entry
 */
function parseFormatterEntry( entry: unknown ): FieldFormatterItem | null {
	if ( typeof entry === 'string' ) {
		return entry;
	}
	if (
		typeof entry === 'object' &&
		entry !== null &&
		! Array.isArray( entry ) &&
		typeof ( entry as Record< string, unknown > ).id === 'string' &&
		( entry as Record< string, unknown > ).config !== undefined
	) {
		const obj = entry as Record< string, unknown >;
		// Accept config as either an object {} or an empty array [] (PHP encodes empty assoc arrays as []).
		const rawConfig = obj.config;
		const parsedConfig: Record< string, string > = {};
		if (
			typeof rawConfig === 'object' &&
			rawConfig !== null &&
			! Array.isArray( rawConfig )
		) {
			for ( const [ key, value ] of Object.entries(
				rawConfig as Record< string, unknown >
			) ) {
				parsedConfig[ key ] = String( value );
			}
		}
		// Empty array [] from PHP means empty config — treat as valid.
		return {
			id: String( obj.id ),
			config: parsedConfig,
		} as FormatterEntry;
	}
	return null;
}

/**
 * Parse a field_formatters map from the API response, validating each entry.
 * String entries are preserved. Object entries with `id` and `config` are
 * parsed into FormatterEntry items. Malformed entries are filtered out.
 * @param raw
 */
function parseFieldFormatters( raw: unknown ): FieldFormattersMap {
	if ( ! raw || typeof raw !== 'object' || Array.isArray( raw ) ) {
		return {};
	}
	const result: FieldFormattersMap = {};
	for ( const [ field, entries ] of Object.entries(
		raw as Record< string, unknown >
	) ) {
		if ( ! Array.isArray( entries ) ) {
			continue;
		}
		const parsed: FieldFormatterItem[] = [];
		for ( const entry of entries ) {
			const item = parseFormatterEntry( entry );
			if ( item !== null ) {
				parsed.push( item );
			}
		}
		if ( parsed.length > 0 ) {
			result[ field ] = parsed;
		}
	}
	return result;
}

/**
 * Convert a PHP backend response (snake_case) to a frontend EndpointConfig (camelCase).
 * @param data
 */
export function fromApiResponse(
	data: Record< string, unknown >
): EndpointConfig {
	const rawDataSource = String( data.data_source || 'posts' );
	const customTaxonomy = data.custom_taxonomy
		? String( data.custom_taxonomy )
		: undefined;

	// Legacy mapping: when data_source is "custom_taxonomy", use the custom_taxonomy field value as the actual data source
	const dataSource =
		rawDataSource === 'custom_taxonomy' && customTaxonomy
			? customTaxonomy
			: rawDataSource;

	const config: EndpointConfig = {
		id: String( data.id || '' ),
		name: String( data.name || '' ),
		slug: String( data.slug || '' ),
		method: ( [ 'GET', 'POST', 'PUT', 'DELETE' ].includes(
			String( data.method || '' )
		)
			? String( data.method )
			: 'GET' ) as HttpMethod,
		dataSource: dataSource as EndpointConfig[ 'dataSource' ],
		customTaxonomy,
		fields: Array.isArray( data.fields ) ? data.fields : [],
		perPage: typeof data.per_page === 'number' ? data.per_page : 10,
		offset: typeof data.offset === 'number' ? data.offset : 0,
		order: data.order === 'ASC' ? 'ASC' : 'DESC',
		orderby: String( data.orderby || 'date' ) as OrderbyField,
		useWordPressDefaults: Boolean( data.use_wordpress_defaults ?? false ),
		taxonomyFilters:
			data.taxonomy_filters &&
			typeof data.taxonomy_filters === 'object' &&
			! Array.isArray( data.taxonomy_filters )
				? ( data.taxonomy_filters as TaxonomyFiltersMap )
				: {},
		fieldFormatters: parseFieldFormatters( data.field_formatters ),
		protected:
			typeof data.protected === 'boolean' ? data.protected : undefined,
		description: data.description ? String( data.description ) : undefined,
		createdAt: data.created_at ? String( data.created_at ) : undefined,
		updatedAt: data.updated_at ? String( data.updated_at ) : undefined,
	};

	// Installed extensions may read their own response data.
	const extended = applyFilters( RKX_AS_HOOK_API_CONFIG, config, data );
	return extended && typeof extended === 'object'
		? ( extended as EndpointConfig )
		: config;
}

/**
 * Fetch all available data sources (post types and taxonomies) from the discovery endpoint.
 * Maps the snake_case `rest_base` response field to camelCase `restBase`.
 * Post type items include a `taxonomies` array with `{ slug, label }` entries for each
 * public, REST-visible taxonomy registered to that post type.
 */
export async function fetchDataSources(): Promise< DataSourceMetadata > {
	const data = await apiFetch< {
		postTypes: Array< {
			slug: string;
			label: string;
			rest_base: string;
			taxonomies?: Array< {
				slug: string;
				label: string;
				rest_base?: string;
			} >;
		} >;
		taxonomies: Array< { slug: string; label: string; rest_base: string } >;
	} >( {
		path: DATA_SOURCES_PATH,
	} );

	const mapItem = ( item: {
		slug: string;
		label: string;
		rest_base: string;
	} ): DataSourceItem => ( {
		slug: item.slug,
		label: item.label,
		restBase: item.rest_base,
	} );

	return {
		postTypes: data.postTypes.map( ( item ) => ( {
			...mapItem( item ),
			...( item.taxonomies
				? {
						taxonomies: item.taxonomies.map( ( tax ) => ( {
							slug: tax.slug,
							label: tax.label,
							restBase: tax.rest_base || tax.slug,
						} ) ),
				  }
				: {} ),
		} ) ),
		taxonomies: data.taxonomies.map( mapItem ),
	};
}

/**
 * Resolve saved term IDs to their display names for a given taxonomy.
 * Used in edit mode to populate FormTokenField tokens with human-readable names.
 * @param taxonomy
 * @param ids
 */
export async function fetchTermsByIds(
	taxonomy: string,
	ids: number[]
): Promise< TermSearchResult[] > {
	if ( ids.length === 0 ) {
		return [];
	}

	const data = await apiFetch< TermSearchResult[] >( {
		path: `/rkx-api-studio/v1/terms?taxonomy=${ encodeURIComponent(
			taxonomy
		) }&include=${ ids.join( ',' ) }`,
	} );

	return data;
}

export async function getEndpoints(): Promise< EndpointConfig[] > {
	const data = await apiFetch< Record< string, unknown >[] >( {
		path: ENDPOINTS_PATH,
	} );
	return data.map( fromApiResponse );
}

export async function createEndpoint(
	config: EndpointConfig
): Promise< EndpointConfig > {
	const data = await apiFetch< Record< string, unknown > >( {
		path: ENDPOINTS_PATH,
		method: 'POST',
		data: toApiPayload( config ),
	} );
	return fromApiResponse( data );
}

export async function updateEndpoint(
	id: string,
	config: EndpointConfig
): Promise< EndpointConfig > {
	const data = await apiFetch< Record< string, unknown > >( {
		path: `${ ENDPOINTS_PATH }/${ id }`,
		method: 'PUT',
		data: toApiPayload( config ),
	} );
	return fromApiResponse( data );
}

export function deleteEndpoint( id: string ): Promise< void > {
	return apiFetch( {
		path: `${ ENDPOINTS_PATH }/${ id }`,
		method: 'DELETE',
	} );
}
