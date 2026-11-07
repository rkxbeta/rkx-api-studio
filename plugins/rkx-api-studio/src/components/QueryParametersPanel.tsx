import {
	TextControl,
	SelectControl,
	CheckboxControl,
	ExternalLink,
} from '@wordpress/components';
import { __, sprintf } from '@wordpress/i18n';
import type { BuilderAction } from '../hooks/useEndpointBuilder';
import type {
	DataSource,
	DataSourceMetadata,
	OrderDirection,
	OrderbyField,
	TaxonomyFiltersMap,
} from '../types';
import {
	POST_ORDERBY_OPTIONS,
	TAXONOMY_ORDERBY_OPTIONS,
	isTaxonomySource,
	isPostTypeSource,
	getDocUrl,
} from '../types';
import { TaxonomyFilterControl } from './TaxonomyFilterControl';

interface QueryParametersPanelProps {
	perPage: number;
	offset: number;
	order: OrderDirection;
	orderby: OrderbyField;
	dataSource: DataSource;
	metadata: DataSourceMetadata | null;
	useWordPressDefaults: boolean;
	taxonomyFilters: TaxonomyFiltersMap;
	errors: Record< string, string >;
	dispatch: React.Dispatch< BuilderAction >;
	/**
	 * The endpoint returns one record per request (see the
	 * rkxAs.endpoint.singleItem hook). Pagination and ordering do not apply,
	 * so only record filters are shown.
	 */
	singleItem?: boolean;
}

export function QueryParametersPanel( {
	perPage,
	offset,
	order,
	orderby,
	dataSource,
	metadata,
	useWordPressDefaults,
	taxonomyFilters,
	errors,
	dispatch,
	singleItem = false,
}: QueryParametersPanelProps ) {
	const handlePerPageChange = ( value: string ) => {
		const num = parseInt( value, 10 );
		if ( ! isNaN( num ) ) {
			dispatch( { type: 'SET_PER_PAGE', payload: num } );
		}
	};

	const handleOffsetChange = ( value: string ) => {
		const num = parseInt( value, 10 );
		if ( ! isNaN( num ) ) {
			dispatch( { type: 'SET_OFFSET', payload: num } );
		}
	};

	const handleOrderChange = ( value: string ) => {
		dispatch( { type: 'SET_ORDER', payload: value as OrderDirection } );
	};

	const handleOrderbyChange = ( value: string ) => {
		dispatch( { type: 'SET_ORDERBY', payload: value as OrderbyField } );
	};

	const isTaxonomy = metadata
		? isTaxonomySource( dataSource, metadata )
		: false;

	// Derive available taxonomies for the selected post-type data source.
	const isPostType = metadata
		? isPostTypeSource( dataSource, metadata )
		: false;
	const availableTaxonomies = isPostType
		? (
				metadata?.postTypes.find( ( pt ) => pt.slug === dataSource ) ??
				metadata?.postTypes.find( ( pt ) => pt.restBase === dataSource )
		  )?.taxonomies ?? []
		: [];

	const orderbyOptions = isTaxonomy
		? TAXONOMY_ORDERBY_OPTIONS
		: POST_ORDERBY_OPTIONS;

	const fieldClassName = useWordPressDefaults
		? 'rkx-as-query-parameters__field rkx-as-query-parameters__field--disabled'
		: 'rkx-as-query-parameters__field';

	// Use an empty fallback metadata when metadata hasn't loaded yet.
	const effectiveMetadata: DataSourceMetadata = metadata ?? {
		postTypes: [],
		taxonomies: [],
	};

	const showTaxonomyFilters =
		isPostType && ! isTaxonomy && availableTaxonomies.length > 0;
	const renderTaxonomyFilters = ( disabled: boolean ) => (
		<div className="rkx-as-query-parameters__taxonomy-filters">
			{ availableTaxonomies.map( ( tax ) => (
				<TaxonomyFilterControl
					key={ tax.slug }
					taxonomy={ tax }
					selectedTermIds={ taxonomyFilters[ tax.slug ] ?? [] }
					disabled={ disabled }
					dispatch={ dispatch }
				/>
			) ) }
		</div>
	);

	if ( singleItem ) {
		if ( ! showTaxonomyFilters ) {
			return null;
		}
		return (
			<div className="rkx-as-query-parameters rkx-as-query-parameters--single-item">
				<h3 className="rkx-as-query-parameters__title">
					{ __( 'Record Filters', 'rkx-api-studio' ) }
				</h3>
				<p className="components-base-control__help">
					{ __(
						'Optional. Only records assigned to the selected terms are returned. Pagination and ordering do not apply to single-item endpoints.',
						'rkx-api-studio'
					) }
				</p>
				{ renderTaxonomyFilters( false ) }
			</div>
		);
	}

	return (
		<div className="rkx-as-query-parameters">
			<h3 className="rkx-as-query-parameters__title">
				{ __( 'Query Parameters', 'rkx-api-studio' ) }
			</h3>

			<div className="rkx-as-query-parameters__checkbox">
				<CheckboxControl
					label={ __(
						'Use WordPress Default Parameters',
						'rkx-api-studio'
					) }
					checked={ useWordPressDefaults }
					onChange={ ( checked: boolean ) => {
						dispatch( {
							type: 'SET_USE_WORDPRESS_DEFAULTS',
							payload: checked,
						} );
					} }
					__nextHasNoMarginBottom
				/>
			</div>

			{ useWordPressDefaults && (
				<div className="rkx-as-query-parameters__doc-link">
					<ExternalLink
						href={ getDocUrl( dataSource, effectiveMetadata ) }
					>
						{ sprintf(
							/* translators: %s: data source type label (e.g., Posts, Pages, Categories) */
							__(
								'View WordPress REST API documentation for %s',
								'rkx-api-studio'
							),
							( () => {
								const allSources = [
									...effectiveMetadata.postTypes,
									...effectiveMetadata.taxonomies,
								];
								const match = allSources.find(
									( item ) => item.slug === dataSource
								);
								return match ? match.label : dataSource;
							} )()
						) }
					</ExternalLink>
				</div>
			) }

			<div className={ fieldClassName }>
				<TextControl
					label={ __( 'Per Page', 'rkx-api-studio' ) }
					type="number"
					value={ String( perPage ) }
					onChange={ handlePerPageChange }
					disabled={ useWordPressDefaults }
					help={
						errors.perPage ? (
							<span className="rkx-as-query-parameters__error">
								{ errors.perPage }
							</span>
						) : (
							__(
								'Number of items per page (1–100).',
								'rkx-api-studio'
							)
						)
					}
					min={ 1 }
					max={ 100 }
					__nextHasNoMarginBottom
				/>
			</div>

			<div className={ fieldClassName }>
				<TextControl
					label={ __( 'Offset', 'rkx-api-studio' ) }
					type="number"
					value={ String( offset ) }
					onChange={ handleOffsetChange }
					disabled={ useWordPressDefaults }
					help={
						errors.offset ? (
							<span className="rkx-as-query-parameters__error">
								{ errors.offset }
							</span>
						) : (
							__(
								'Number of items to skip before returning results.',
								'rkx-api-studio'
							)
						)
					}
					min={ 0 }
					__nextHasNoMarginBottom
				/>
			</div>

			<div className={ fieldClassName }>
				<SelectControl
					label={ __( 'Order', 'rkx-api-studio' ) }
					value={ order }
					options={ [
						{
							label: __( 'Ascending', 'rkx-api-studio' ),
							value: 'ASC',
						},
						{
							label: __( 'Descending', 'rkx-api-studio' ),
							value: 'DESC',
						},
					] }
					onChange={ handleOrderChange }
					disabled={ useWordPressDefaults }
					help={
						errors.order ? (
							<span className="rkx-as-query-parameters__error">
								{ errors.order }
							</span>
						) : undefined
					}
					__nextHasNoMarginBottom
				/>
			</div>

			<div className={ fieldClassName }>
				<SelectControl
					label={ __( 'Order By', 'rkx-api-studio' ) }
					value={ orderby }
					options={ orderbyOptions }
					onChange={ handleOrderbyChange }
					disabled={ useWordPressDefaults }
					help={
						errors.orderby ? (
							<span className="rkx-as-query-parameters__error">
								{ errors.orderby }
							</span>
						) : undefined
					}
					__nextHasNoMarginBottom
				/>
			</div>

			{ showTaxonomyFilters &&
				renderTaxonomyFilters( !! useWordPressDefaults ) }
		</div>
	);
}
