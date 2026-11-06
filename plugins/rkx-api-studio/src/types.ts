import { __ } from '@wordpress/i18n';

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE';

export const METHOD_COLORS: Record< HttpMethod, string > = {
	GET: '#6b7280',
	POST: '#16a34a',
	PUT: '#ea580c',
	DELETE: '#dc2626',
};

/**
 * Checks if the given HTTP method is a write method (POST, PUT, or DELETE).
 *
 * @param method The HTTP method to check.
 * @return True if the method is POST, PUT, or DELETE.
 */
export function isWriteMethod( method: HttpMethod ): boolean {
	return method === 'POST' || method === 'PUT' || method === 'DELETE';
}

export type OrderDirection = 'ASC' | 'DESC';

export type PostOrderbyField =
	| 'date'
	| 'title'
	| 'modified'
	| 'id'
	| 'author'
	| 'slug';

export type TaxonomyOrderbyField =
	| 'name'
	| 'slug'
	| 'count'
	| 'id'
	| 'description';

export type OrderbyField = PostOrderbyField | TaxonomyOrderbyField;

export type TaxonomyFiltersMap = Record< string, number[] >;

export interface FormatterEntry {
	id: string;
	config: Record< string, string >;
}

export type FieldFormatterItem = string | FormatterEntry;

export interface RegexFilterConfig {
	pattern: string;
	replacement: string;
}

export type FieldFormattersMap = Record< string, FieldFormatterItem[] >;

export interface FormatterDefinition {
	id: string;
	label: string;
}

export const FIELD_FORMATTERS: FormatterDefinition[] = [
	{ id: 'strip_html', label: __( 'Strip HTML Tags', 'rkx-api-studio' ) },
	{
		id: 'remove_blocks',
		label: __( 'Remove Block Comments', 'rkx-api-studio' ),
	},
	{
		id: 'normalize_whitespace',
		label: __( 'Normalize Whitespace', 'rkx-api-studio' ),
	},
	{
		id: 'excerpt',
		label: __( 'Trim to 55 words (Excerpt)', 'rkx-api-studio' ),
	},
	{
		id: 'truncate_200',
		label: __( 'Truncate to 200 chars', 'rkx-api-studio' ),
	},
	{ id: 'format_date', label: __( 'Format Date', 'rkx-api-studio' ) },
	{ id: 'uppercase', label: __( 'Uppercase', 'rkx-api-studio' ) },
	{ id: 'lowercase', label: __( 'Lowercase', 'rkx-api-studio' ) },
	{ id: 'slugify', label: __( 'Slugify', 'rkx-api-studio' ) },
	{
		id: 'remove_special_chars',
		label: __( 'Remove Special Chars', 'rkx-api-studio' ),
	},
];

export interface TermSearchResult {
	id: number;
	name: string;
	slug: string;
}

export interface EndpointConfig {
	id: string;
	name: string;
	slug: string;
	method?: HttpMethod;
	description?: string;
	dataSource: DataSource;
	customTaxonomy?: string;
	fields: string[];
	fieldFormatters?: FieldFormattersMap;
	perPage: number;
	offset: number;
	order: OrderDirection;
	orderby: OrderbyField;
	useWordPressDefaults?: boolean;
	taxonomyFilters?: TaxonomyFiltersMap;
	protected?: boolean;
	createdAt?: string;
	updatedAt?: string;
}

export type DataSource = string;

export interface DataSourceItem {
	slug: string;
	label: string;
	restBase: string;
	taxonomies?: Array< { slug: string; label: string; restBase?: string } >;
}

const TAXONOMY_PREFIX = 'taxonomy:';

/**
 * Checks if a field ID represents a taxonomy field.
 *
 * @param fieldId The field identifier to check.
 * @return True if the field ID starts with the `taxonomy:` prefix.
 */
export function isTaxonomyField( fieldId: string ): boolean {
	return fieldId.startsWith( TAXONOMY_PREFIX );
}

/**
 * Extracts the taxonomy slug from a taxonomy field ID.
 *
 * @param fieldId A field identifier in the format `taxonomy:{slug}`.
 * @return The slug portion after the `taxonomy:` prefix.
 */
export function getTaxonomySlug( fieldId: string ): string {
	return fieldId.slice( TAXONOMY_PREFIX.length );
}

export const META_PREFIX = 'meta:';
export const CUSTOM_META_FIELD_ID = '__custom_meta__';

/**
 * Checks if a field ID represents a custom meta field.
 *
 * @param fieldId The field identifier to check.
 * @return True if the field ID starts with the `meta:` prefix.
 */
export function isMetaField( fieldId: string ): boolean {
	return fieldId.startsWith( META_PREFIX );
}

/**
 * Extracts the meta key from a meta field ID.
 *
 * @param fieldId A field identifier in the format `meta:{key}`.
 * @return The key portion after the `meta:` prefix.
 */
export function getMetaKey( fieldId: string ): string {
	return fieldId.slice( META_PREFIX.length );
}

export const CUSTOM_META_FIELD: FieldDefinition = {
	id: CUSTOM_META_FIELD_ID,
	label: __( 'Custom Meta Field', 'rkx-api-studio' ),
	sourceTypes: [ '__all__' ],
};

export interface DataSourceMetadata {
	postTypes: DataSourceItem[];
	taxonomies: DataSourceItem[];
}

export interface FieldDefinition {
	id: string;
	label: string;
	sourceTypes: string[];
}

export const POST_FIELDS: FieldDefinition[] = [
	{
		id: 'id',
		label: __( 'ID', 'rkx-api-studio' ),
		sourceTypes: [ 'posts', 'pages' ],
	},
	{
		id: 'title',
		label: __( 'Title', 'rkx-api-studio' ),
		sourceTypes: [ 'posts', 'pages' ],
	},
	{
		id: 'content',
		label: __( 'Content', 'rkx-api-studio' ),
		sourceTypes: [ 'posts', 'pages' ],
	},
	{
		id: 'excerpt',
		label: __( 'Excerpt', 'rkx-api-studio' ),
		sourceTypes: [ 'posts', 'pages' ],
	},
	{
		id: 'featured_image_url',
		label: __( 'Featured Image URL', 'rkx-api-studio' ),
		sourceTypes: [ 'posts', 'pages' ],
	},
	{
		id: 'slug',
		label: __( 'Slug', 'rkx-api-studio' ),
		sourceTypes: [ 'posts', 'pages' ],
	},
	{
		id: 'date',
		label: __( 'Date', 'rkx-api-studio' ),
		sourceTypes: [ 'posts', 'pages' ],
	},
	{
		id: 'author',
		label: __( 'Author', 'rkx-api-studio' ),
		sourceTypes: [ 'posts', 'pages' ],
	},
];

export const TAXONOMY_FIELDS: FieldDefinition[] = [
	{
		id: 'id',
		label: __( 'ID', 'rkx-api-studio' ),
		sourceTypes: [ 'categories', 'tags', 'custom_taxonomy' ],
	},
	{
		id: 'name',
		label: __( 'Name', 'rkx-api-studio' ),
		sourceTypes: [ 'categories', 'tags', 'custom_taxonomy' ],
	},
	{
		id: 'slug',
		label: __( 'Slug', 'rkx-api-studio' ),
		sourceTypes: [ 'categories', 'tags', 'custom_taxonomy' ],
	},
	{
		id: 'description',
		label: __( 'Description', 'rkx-api-studio' ),
		sourceTypes: [ 'categories', 'tags', 'custom_taxonomy' ],
	},
	{
		id: 'count',
		label: __( 'Count', 'rkx-api-studio' ),
		sourceTypes: [ 'categories', 'tags', 'custom_taxonomy' ],
	},
	{
		id: 'parent',
		label: __( 'Parent', 'rkx-api-studio' ),
		sourceTypes: [ 'categories', 'tags', 'custom_taxonomy' ],
	},
];

export const POST_ORDERBY_OPTIONS: {
	label: string;
	value: PostOrderbyField;
}[] = [
	{ label: __( 'Date', 'rkx-api-studio' ), value: 'date' },
	{ label: __( 'Title', 'rkx-api-studio' ), value: 'title' },
	{ label: __( 'Modified', 'rkx-api-studio' ), value: 'modified' },
	{ label: __( 'ID', 'rkx-api-studio' ), value: 'id' },
	{ label: __( 'Author', 'rkx-api-studio' ), value: 'author' },
	{ label: __( 'Slug', 'rkx-api-studio' ), value: 'slug' },
];

export const TAXONOMY_ORDERBY_OPTIONS: {
	label: string;
	value: TaxonomyOrderbyField;
}[] = [
	{ label: __( 'Name', 'rkx-api-studio' ), value: 'name' },
	{ label: __( 'Slug', 'rkx-api-studio' ), value: 'slug' },
	{ label: __( 'Count', 'rkx-api-studio' ), value: 'count' },
	{ label: __( 'ID', 'rkx-api-studio' ), value: 'id' },
	{ label: __( 'Description', 'rkx-api-studio' ), value: 'description' },
];

export function isPostTypeSource(
	dataSource: string,
	metadata: DataSourceMetadata
): boolean {
	return metadata.postTypes.some(
		( item ) => item.slug === dataSource || item.restBase === dataSource
	);
}

export function isTaxonomySource(
	dataSource: string,
	metadata: DataSourceMetadata
): boolean {
	return metadata.taxonomies.some( ( item ) => item.slug === dataSource );
}

export function getDefaultOrderby(
	dataSource: string,
	metadata?: DataSourceMetadata
): OrderbyField {
	if ( metadata ) {
		if ( isPostTypeSource( dataSource, metadata ) ) {
			return 'date';
		}
		if ( isTaxonomySource( dataSource, metadata ) ) {
			return 'name';
		}
	}

	// Fallback for when metadata is not available: use hardcoded classification
	const knownTaxonomies = [ 'categories', 'tags', 'custom_taxonomy' ];
	if ( knownTaxonomies.includes( dataSource ) ) {
		return 'name';
	}
	return 'date';
}

const BUILTIN_DOC_URLS: Record< string, string > = {
	posts: 'https://developer.wordpress.org/rest-api/reference/posts/',
	pages: 'https://developer.wordpress.org/rest-api/reference/pages/',
	categories:
		'https://developer.wordpress.org/rest-api/reference/categories/',
	tags: 'https://developer.wordpress.org/rest-api/reference/tags/',
};

const FALLBACK_DOC_URL = 'https://developer.wordpress.org/rest-api/';

export function getDocUrl(
	dataSource: string,
	_metadata: DataSourceMetadata
): string {
	// Keep the compatibility argument without deriving URLs from custom metadata.
	void _metadata;
	// Return known URLs for built-in types
	if ( dataSource in BUILTIN_DOC_URLS ) {
		return BUILTIN_DOC_URLS[ dataSource ];
	}

	// Custom REST bases do not imply a matching WordPress handbook page.

	return FALLBACK_DOC_URL;
}
