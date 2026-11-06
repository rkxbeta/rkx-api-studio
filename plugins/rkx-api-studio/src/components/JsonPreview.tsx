import { applyFilters } from '@wordpress/hooks';
import { useState, useEffect, useRef } from '@wordpress/element';
import apiFetch from '@wordpress/api-fetch';
import { __ } from '@wordpress/i18n';
import {
	isTaxonomyField,
	getTaxonomySlug,
	isMetaField,
	getMetaKey,
} from '../types';
import type {
	DataSource,
	DataSourceMetadata,
	FieldFormattersMap,
	FieldFormatterItem,
	OrderDirection,
	OrderbyField,
} from '../types';

interface JsonPreviewProps {
	dataSource: DataSource;
	fields: string[];
	order?: OrderDirection;
	orderby?: OrderbyField;
	offset?: number;
	perPage?: number;
	metadata?: DataSourceMetadata | null;
	taxonomyFilters?: Record< string, number[] >;
	fieldFormatters?: FieldFormattersMap;
	config?: unknown;
}

export function applyClientFormatter(
	value: unknown,
	formatters: FieldFormatterItem[]
): unknown {
	if ( typeof value !== 'string' || formatters.length === 0 ) {
		return value;
	}
	let result = value;
	for ( const fmt of formatters ) {
		if ( typeof fmt !== 'string' ) {
			result = applyFilters(
				'rkxAs.preview.formatter',
				result,
				fmt
			) as string;
			continue;
		}
		switch ( fmt ) {
			case 'strip_html':
				result = result.replace( /<[^>]*>/g, '' );
				break;
			case 'remove_blocks':
				result = result.replace( /<!--\s*\/?wp:[^>]*?-->/gi, '' );
				break;
			case 'normalize_whitespace':
				result = result.replace( /\s+/g, ' ' ).trim();
				break;
			case 'excerpt': {
				const words = result.trim().split( /\s+/ );
				result =
					words.length > 55
						? words.slice( 0, 55 ).join( ' ' ) + '…'
						: result;
				break;
			}
			case 'truncate_200':
				result =
					result.length > 200 ? result.slice( 0, 200 ) + '…' : result;
				break;
			case 'format_date': {
				const d = new Date( result );
				result = isNaN( d.getTime() ) ? result : d.toLocaleDateString();
				break;
			}
			case 'uppercase':
				result = result.toUpperCase();
				break;
			case 'lowercase':
				result = result.toLowerCase();
				break;
			case 'slugify':
				result = result
					.toLowerCase()
					.replace( /[^a-z0-9\s-]/g, '' )
					.trim()
					.replace( /\s+/g, '-' );
				break;
			case 'remove_special_chars':
				result = result.replace( /[^a-zA-Z0-9\s]/g, '' );
				break;
		}
	}
	return result;
}

function applyFormattersToItems(
	items: Record< string, unknown >[],
	fields: string[],
	fieldFormatters: FieldFormattersMap
): Record< string, unknown >[] {
	// Build output-key → formatter list map (skip taxonomy arrays).
	const keyToFormatters: Record< string, FieldFormatterItem[] > = {};
	for ( const field of fields ) {
		const fmts = fieldFormatters[ field ];
		if ( ! fmts || fmts.length === 0 ) {
			continue;
		}
		if ( isTaxonomyField( field ) ) {
			continue;
		} // arrays — skip
		let outKey: string;
		if ( isMetaField( field ) ) {
			outKey = getMetaKey( field );
		} else {
			outKey = applyFilters(
				'rkxAs.preview.outputKey',
				field,
				field
			) as string;
		}
		if ( outKey ) {
			keyToFormatters[ outKey ] = fmts;
		}
	}
	if ( Object.keys( keyToFormatters ).length === 0 ) {
		return items;
	}

	return items.map( ( item ) => {
		const result = { ...item };
		for ( const [ key, fmts ] of Object.entries( keyToFormatters ) ) {
			if ( key in result ) {
				result[ key ] = applyClientFormatter( result[ key ], fmts );
			}
		}
		return result;
	} );
}

const POST_MOCK_SAMPLES: Record< string, unknown >[] = [
	{
		id: 1,
		title: 'Getting Started with Headless WordPress',
		content:
			'<p>Learn how to build modern frontends powered by WordPress as a headless CMS...</p>',
		excerpt: 'Learn how to build modern frontends powered by WordPress...',
		featured_image_url: '',
		slug: 'getting-started-headless-wordpress',
		date: '2024-03-15 09:00:00',
		author: {
			id: 1,
			name: 'Admin',
			slug: 'admin',
			avatar_url: '',
		},
		'taxonomy:category': [
			{ id: 1, name: 'Technology', slug: 'technology' },
		],
		'taxonomy:post_tag': [
			{ id: 10, name: 'WordPress', slug: 'wordpress' },
			{ id: 11, name: 'Headless', slug: 'headless' },
		],
	},
	{
		id: 2,
		title: 'Building REST APIs the Right Way',
		content:
			'<p>A deep dive into creating clean, performant REST endpoints...</p>',
		excerpt:
			'A deep dive into creating clean, performant REST endpoints...',
		featured_image_url: '',
		slug: 'building-rest-apis-right-way',
		date: '2024-02-28 14:30:00',
		author: {
			id: 2,
			name: 'Editor',
			slug: 'editor',
			avatar_url: '',
		},
		'taxonomy:category': [
			{ id: 2, name: 'Tutorials', slug: 'tutorials' },
		],
		'taxonomy:post_tag': [ { id: 12, name: 'REST API', slug: 'rest-api' } ],
	},
	{
		id: 3,
		title: 'Next.js and WordPress: A Perfect Match',
		content: '<p>Discover how to integrate Next.js with WordPress...</p>',
		excerpt: 'Discover how to integrate Next.js with WordPress...',
		featured_image_url: '',
		slug: 'nextjs-wordpress-perfect-match',
		date: '2024-01-20 11:15:00',
		author: {
			id: 1,
			name: 'Admin',
			slug: 'admin',
			avatar_url: '',
		},
		'taxonomy:category': [
			{ id: 1, name: 'Technology', slug: 'technology' },
			{ id: 2, name: 'Tutorials', slug: 'tutorials' },
		],
		'taxonomy:post_tag': [
			{ id: 10, name: 'WordPress', slug: 'wordpress' },
			{ id: 13, name: 'Next.js', slug: 'nextjs' },
		],
	},
];

const TAXONOMY_MOCK_SAMPLES: Record< string, unknown >[] = [
	{
		id: 1,
		name: 'Technology',
		slug: 'technology',
		description:
			'Posts about web development, APIs, and modern tech stacks.',
		count: 24,
		parent: 0,
	},
	{
		id: 2,
		name: 'Tutorials',
		slug: 'tutorials',
		description: 'Step-by-step guides and how-to articles.',
		count: 18,
		parent: 0,
	},
	{
		id: 3,
		name: 'WordPress',
		slug: 'wordpress',
		description: 'Everything related to WordPress development.',
		count: 31,
		parent: 1,
	},
];

function pickFields(
	items: Record< string, unknown >[],
	fields: string[]
): Record< string, unknown >[] {
	return items.map( ( item ) => {
		const picked: Record< string, unknown > = {};
		for ( const field of fields ) {
			if ( isMetaField( field ) ) {
				const key = getMetaKey( field );
				if ( key.trim() !== '' && ! /^\d+$/.test( key ) ) {
					picked[ key ] = '(custom meta)';
				}
				continue;
			}
			if (
				applyFilters(
					'rkxAs.preview.pickField',
					false,
					picked,
					field,
					null
				)
			) {
				continue;
			}

			if ( isTaxonomyField( field ) ) {
				// Taxonomy fields use the slug as the output key (matching PHP map_post behavior).
				const slug = getTaxonomySlug( field );
				const mockKey = `taxonomy:${ slug }`;
				if ( mockKey in item ) {
					picked[ slug ] = item[ mockKey ];
				} else {
					picked[ slug ] = [];
				}
			} else if ( field in item ) {
				picked[ field ] = item[ field ];
			}
		}
		return picked;
	} );
}

/**
 * Check if a data source is a post type, matching by slug or restBase.
 * This handles the case where dataSource might be 'posts' (restBase) instead of 'post' (slug).
 * @param dataSource
 * @param metadata
 */
function isPostTypeDataSource(
	dataSource: string,
	metadata?: DataSourceMetadata | null
): boolean {
	if ( metadata ) {
		return metadata.postTypes.some(
			( item ) => item.slug === dataSource || item.restBase === dataSource
		);
	}
	return [ 'posts', 'pages' ].includes( dataSource );
}

function getMockData(
	dataSource: DataSource,
	fields: string[],
	metadata?: DataSourceMetadata | null
): Record< string, unknown >[] {
	if ( fields.length === 0 ) {
		return [];
	}
	const postType = isPostTypeDataSource( dataSource, metadata );
	const samples = postType ? POST_MOCK_SAMPLES : TAXONOMY_MOCK_SAMPLES;
	return pickFields( samples, fields );
}

function syntaxHighlight( json: string ): string {
	const escaped = json
		.replace( /&/g, '&amp;' )
		.replace( /</g, '&lt;' )
		.replace( />/g, '&gt;' );

	return escaped.replace(
		/("(\\u[\da-fA-F]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+-]?\d+)?)/g,
		( match ) => {
			let cls = 'rkx-as-json-number';
			if ( /^"/.test( match ) ) {
				cls = /:$/.test( match )
					? 'rkx-as-json-key'
					: 'rkx-as-json-string';
			} else if ( /true|false/.test( match ) ) {
				cls = 'rkx-as-json-boolean';
			} else if ( /null/.test( match ) ) {
				cls = 'rkx-as-json-null';
			}
			return `<span class="${ cls }">${ match }</span>`;
		}
	);
}

export function generatePreviewJson(
	dataSource: DataSource,
	fields: string[],
	metadata?: DataSourceMetadata | null
): string {
	return JSON.stringify(
		getMockData( dataSource, fields, metadata ),
		null,
		2
	);
}

interface PreviewResponse {
	type: 'post_type' | 'taxonomy';
	items: Record< string, unknown >[];
	total: number;
}

export function JsonPreview( {
	dataSource,
	fields,
	order = 'DESC',
	orderby = 'date',
	offset = 0,
	perPage = 10,
	metadata,
	taxonomyFilters,
	fieldFormatters = {},
	config,
}: JsonPreviewProps ) {
	const [ liveData, setLiveData ] = useState<
		Record< string, unknown >[] | null
	>( null );
	const [ hasLive, setHasLive ] = useState( false );
	const fetchedSourceRef = useRef< string >( '' );

	// Collect meta: fields for the preview request (exclude timestamp placeholders).
	const metaFieldsParam = fields
		.filter(
			( f ) =>
				isMetaField( f ) &&
				getMetaKey( f ).trim() !== '' &&
				! /^\d+$/.test( getMetaKey( f ) )
		)
		.join( ',' );

	const allExtraFieldsParam = applyFilters(
		'rkxAs.preview.fields',
		metaFieldsParam,
		fields
	) as string;
	const extensionQuery = applyFilters(
		'rkxAs.preview.query',
		'',
		config
	) as string;

	// Build a stable string representation of taxonomy filters for the dependency array.
	const taxonomyFiltersParam = taxonomyFilters
		? JSON.stringify(
				Object.fromEntries(
					Object.entries( taxonomyFilters ).filter(
						( [ , ids ] ) => ids.length > 0
					)
				)
		  )
		: '';

	// Fetch preview data from the plugin's own preview endpoint.
	// This uses WP_Query / WP_Term_Query directly, so it works for any
	// registered public post type or taxonomy — no show_in_rest required.
	useEffect( () => {
		if ( ! dataSource ) {
			setLiveData( null );
			setHasLive( false );
			fetchedSourceRef.current = dataSource;
			return;
		}

		let cancelled = false;
		fetchedSourceRef.current = '';

		let apiPath = `/rkx-api-studio/v1/preview?data_source=${ encodeURIComponent(
			dataSource
		) }&per_page=3`;
		if ( allExtraFieldsParam ) {
			apiPath += `&fields=${ encodeURIComponent( allExtraFieldsParam ) }`;
		}
		apiPath += extensionQuery;
		if ( taxonomyFiltersParam && taxonomyFiltersParam !== '{}' ) {
			apiPath += `&taxonomy_filters=${ encodeURIComponent(
				taxonomyFiltersParam
			) }`;
		}

		// Pass field formatters to the preview endpoint for server-side formatting.
		if ( fieldFormatters && Object.keys( fieldFormatters ).length > 0 ) {
			apiPath += `&field_formatters=${ encodeURIComponent(
				JSON.stringify( fieldFormatters )
			) }`;
		}

		apiFetch< PreviewResponse >( { path: apiPath } )
			.then( ( response ) => {
				if ( cancelled ) {
					return;
				}
				fetchedSourceRef.current = dataSource;

				if (
					! response ||
					! Array.isArray( response.items ) ||
					response.items.length === 0
				) {
					setLiveData( null );
					setHasLive( false );
					return;
				}

				setLiveData( response.items );
				setHasLive( true );
			} )
			.catch( () => {
				if ( cancelled ) {
					return;
				}
				fetchedSourceRef.current = dataSource;
				setLiveData( null );
				setHasLive( false );
			} );

		return () => {
			cancelled = true;
		};
	}, [
		dataSource,
		allExtraFieldsParam,
		taxonomyFiltersParam,
		extensionQuery,
		fieldFormatters,
	] );

	if ( fields.length === 0 ) {
		return (
			<div className="rkx-as-json-preview">
				<h3 className="rkx-as-json-preview__title">
					{ __( 'JSON Preview', 'rkx-api-studio' ) }
				</h3>
				<pre className="rkx-as-json-preview__code">
					<code>[]</code>
				</pre>
			</div>
		);
	}

	// Use live data when available, fill missing fields from mock.
	const postType = isPostTypeDataSource( dataSource, metadata );
	const mockSource = postType ? POST_MOCK_SAMPLES : TAXONOMY_MOCK_SAMPLES;

	let displayData: Record< string, unknown >[];
	const showingLive = hasLive && liveData !== null && liveData.length > 0;

	if ( showingLive ) {
		// Sort the live data client-side based on order/orderby.
		let sorted = [ ...liveData! ];
		sorted.sort( ( a, b ) => {
			const aVal = a[ orderby ];
			const bVal = b[ orderby ];

			let cmp = 0;
			if ( typeof aVal === 'number' && typeof bVal === 'number' ) {
				cmp = aVal - bVal;
			} else {
				cmp = String( aVal ?? '' ).localeCompare(
					String( bVal ?? '' )
				);
			}
			return order === 'ASC' ? cmp : -cmp;
		} );

		// Apply offset and limit.
		const limit = Math.min( perPage, 3 );
		sorted = sorted.slice( offset, offset + limit );

		displayData = sorted.map( ( liveItem, idx ) => {
			const picked: Record< string, unknown > = {};
			const mockItem = mockSource[ idx ] || mockSource[ 0 ];
			for ( const field of fields ) {
				// For meta fields, use the meta key as the output key.
				// Try to get the actual value from live data; fall back to placeholder.
				if ( isMetaField( field ) ) {
					const key = getMetaKey( field );
					if ( key.trim() !== '' && ! /^\d+$/.test( key ) ) {
						if ( key in liveItem ) {
							picked[ key ] = liveItem[ key ];
						} else {
							picked[ key ] = null;
						}
					}
					continue;
				}
				if (
					applyFilters(
						'rkxAs.preview.pickField',
						false,
						picked,
						field,
						liveItem
					)
				) {
					continue;
				}
				// For taxonomy fields, the live data uses the slug as key (e.g., 'category')
				// but the field identifier uses 'taxonomy:category' format.
				const liveKey = isTaxonomyField( field )
					? getTaxonomySlug( field )
					: field;
				const outputKey = liveKey;

				if ( liveKey in liveItem ) {
					picked[ outputKey ] = liveItem[ liveKey ];
				} else if ( mockItem && field in mockItem ) {
					picked[ outputKey ] = mockItem[ field ];
				}
			}
			return picked;
		} );
	} else {
		displayData = getMockData( dataSource, fields, metadata );
	}

	displayData = applyFormattersToItems(
		displayData,
		fields,
		fieldFormatters
	);

	const jsonString = JSON.stringify( displayData, null, 2 );
	const highlighted = syntaxHighlight( jsonString );

	const badgeText = showingLive
		? __( 'Live Data', 'rkx-api-studio' )
		: __( 'Sample Data', 'rkx-api-studio' );
	const badgeClass = showingLive
		? 'rkx-as-json-preview__badge--live'
		: 'rkx-as-json-preview__badge--sample';

	let footerText: string;
	if ( showingLive ) {
		footerText = __(
			'Showing up to 3 real items from your site. Full response available at the API URL.',
			'rkx-api-studio'
		);
	} else if ( fetchedSourceRef.current === dataSource ) {
		footerText = __(
			'No data found for this data source yet. Showing sample data.',
			'rkx-api-studio'
		);
	} else {
		footerText = __( 'Loading live data…', 'rkx-api-studio' );
	}

	return (
		<div className="rkx-as-json-preview">
			<div className="rkx-as-json-preview__header">
				<h3 className="rkx-as-json-preview__title">
					{ __( 'JSON Preview', 'rkx-api-studio' ) }
				</h3>
				<span
					className={ `rkx-as-json-preview__badge ${ badgeClass }` }
				>
					{ badgeText }
				</span>
			</div>
			<div className="rkx-as-json-preview__query-info">
				<code>
					?per_page={ perPage }&order={ order }&orderby={ orderby }
					{ offset > 0 ? `&offset=${ offset }` : '' }
					{ taxonomyFilters &&
						metadata &&
						Object.entries( taxonomyFilters )
							.filter( ( [ , ids ] ) => ids.length > 0 )
							.map( ( [ slug, ids ] ) => {
								const ptEntry = metadata.postTypes.find(
									( pt ) =>
										pt.slug === dataSource ||
										pt.restBase === dataSource
								);
								const taxEntry = ptEntry?.taxonomies?.find(
									( t ) => t.slug === slug
								);
								const paramName = taxEntry?.restBase || slug;
								return `&${ paramName }=${ ids.join( ',' ) }`;
							} )
							.join( '' ) }
				</code>
			</div>
			<pre className="rkx-as-json-preview__code">
				<code dangerouslySetInnerHTML={ { __html: highlighted } } />
			</pre>
			<div className="rkx-as-json-preview__more">
				<span className="rkx-as-json-preview__ellipsis">⋯</span>
				<span className="rkx-as-json-preview__more-text">
					{ footerText }
				</span>
			</div>
		</div>
	);
}
