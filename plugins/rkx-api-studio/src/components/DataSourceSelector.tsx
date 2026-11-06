import { useState, useEffect, useRef } from '@wordpress/element';
import { SelectControl, Notice } from '@wordpress/components';
import { __ } from '@wordpress/i18n';
import type { DataSourceMetadata } from '../types';
import type { BuilderAction } from '../hooks/useEndpointBuilder';
import { fetchDataSources } from '../api/client';

interface DataSourceSelectorProps {
	dataSource: string;
	dispatch: React.Dispatch< BuilderAction >;
	/**
	 * Legacy field — only used to resolve existing configs where
	 * `dataSource` is `"custom_taxonomy"` to the actual taxonomy slug.
	 */
	legacyCustomTaxonomy?: string;
	/**
	 * Pre-fetched metadata from the parent component.
	 * When provided, the selector skips its own fetch to avoid double-fetching.
	 */
	metadata?: DataSourceMetadata;
}

/**
 * Built-in fallback options used when the discovery endpoint fails.
 */
const FALLBACK_METADATA: DataSourceMetadata = {
	postTypes: [
		{
			slug: 'post',
			label: __( 'Posts', 'rkx-api-studio' ),
			restBase: 'posts',
		},
		{
			slug: 'page',
			label: __( 'Pages', 'rkx-api-studio' ),
			restBase: 'pages',
		},
	],
	taxonomies: [
		{
			slug: 'category',
			label: __( 'Categories', 'rkx-api-studio' ),
			restBase: 'categories',
		},
		{
			slug: 'post_tag',
			label: __( 'Tags', 'rkx-api-studio' ),
			restBase: 'tags',
		},
	],
};

export function DataSourceSelector( {
	dataSource,
	dispatch,
	legacyCustomTaxonomy,
	metadata: parentMetadata,
}: DataSourceSelectorProps ) {
	const [ localMetadata, setLocalMetadata ] =
		useState< DataSourceMetadata | null >( null );
	const [ isLoading, setIsLoading ] = useState( ! parentMetadata );
	const [ fetchError, setFetchError ] = useState< string | null >( null );
	const legacyMapped = useRef( false );

	// When parent provides metadata, use it directly and skip the fetch.
	useEffect( () => {
		if ( parentMetadata ) {
			setLocalMetadata( parentMetadata );
			setIsLoading( false );
		}
	}, [ parentMetadata ] );

	// Only fetch locally when no parent metadata is provided.
	useEffect( () => {
		if ( parentMetadata ) {
			return;
		}

		let cancelled = false;

		fetchDataSources()
			.then( ( data ) => {
				if ( ! cancelled ) {
					setLocalMetadata( data );
					setIsLoading( false );
				}
			} )
			.catch( () => {
				if ( ! cancelled ) {
					setLocalMetadata( FALLBACK_METADATA );
					setFetchError(
						__(
							'Could not load data sources. Showing built-in options only.',
							'rkx-api-studio'
						)
					);
					setIsLoading( false );
				}
			} );

		return () => {
			cancelled = true;
		};
	}, [ parentMetadata ] );

	const metadata = localMetadata;

	// Map legacy `custom_taxonomy` config to the actual taxonomy slug once metadata is loaded.
	useEffect( () => {
		if (
			! legacyMapped.current &&
			metadata &&
			dataSource === 'custom_taxonomy' &&
			legacyCustomTaxonomy
		) {
			legacyMapped.current = true;
			dispatch( {
				type: 'SET_DATA_SOURCE',
				payload: {
					dataSource: legacyCustomTaxonomy,
					metadata,
				},
			} );
		}
	}, [ metadata, dataSource, legacyCustomTaxonomy, dispatch ] );

	const handleDataSourceChange = ( value: string ) => {
		if ( ! metadata ) {
			return;
		}
		dispatch( {
			type: 'SET_DATA_SOURCE',
			payload: {
				dataSource: value,
				metadata,
			},
		} );
	};

	/**
	 * Resolve the current value for the select.
	 * If the config still has the legacy `custom_taxonomy` value and we haven't
	 * mapped it yet, show the actual taxonomy slug so the dropdown highlights
	 * the correct option.
	 */
	const resolvedValue =
		dataSource === 'custom_taxonomy' && legacyCustomTaxonomy
			? legacyCustomTaxonomy
			: dataSource;

	const effectiveMetadata = metadata ?? FALLBACK_METADATA;

	return (
		<div className="rkx-as-data-source-selector">
			{ fetchError && (
				<Notice status="warning" isDismissible={ false }>
					{ fetchError }
				</Notice>
			) }
			<SelectControl
				label={ __( 'Data Source', 'rkx-api-studio' ) }
				value={ resolvedValue }
				disabled={ isLoading }
				onChange={ handleDataSourceChange }
				__nextHasNoMarginBottom
			>
				<optgroup label={ __( 'Post Types', 'rkx-api-studio' ) }>
					{ effectiveMetadata.postTypes.map( ( pt ) => (
						<option key={ pt.slug } value={ pt.slug }>
							{ pt.label }
						</option>
					) ) }
				</optgroup>
				<optgroup label={ __( 'Taxonomies', 'rkx-api-studio' ) }>
					{ effectiveMetadata.taxonomies.map( ( tax ) => (
						<option key={ tax.slug } value={ tax.slug }>
							{ tax.label }
						</option>
					) ) }
				</optgroup>
			</SelectControl>
		</div>
	);
}
