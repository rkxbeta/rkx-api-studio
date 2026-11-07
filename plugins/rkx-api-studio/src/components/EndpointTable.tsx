import { Button, SearchControl } from '@wordpress/components';
import { applyFilters } from '@wordpress/hooks';
import { __, sprintf, _n } from '@wordpress/i18n';
import type { EndpointConfig } from '../types';
import {
	RKX_AS_HOOK_ROUTE_NAMESPACE,
	RKX_AS_HOOK_ROUTE_PATH,
	RKX_AS_REST_NAMESPACE,
} from '../hooks/rkx-as-hooks';

/** Number of endpoints shown per table page. */
export const ENDPOINTS_PER_PAGE = 20;

export type SortField = 'name' | 'dataSource' | 'slug' | 'createdAt';

export interface ListView {
	search: string;
	page: number;
	sort?: { field: SortField; direction: 'asc' | 'desc' };
}

export interface ColumnDefinition {
	id: string;
	label: string;
	sortable?: SortField;
	render: ( item: EndpointConfig ) => React.ReactNode;
}

export interface RowAction {
	id: string;
	label: string;
	icon: JSX.Element;
	isDestructive?: boolean;
	supportsBulk?: boolean;
	/** Whether the action applies to an endpoint. Defaults to every endpoint. */
	isEligible?: ( item: EndpointConfig ) => boolean;
	callback: ( items: EndpointConfig[] ) => void | Promise< void >;
}

/**
 * REST namespace shown for an endpoint.
 * @param item Endpoint configuration.
 */
export function routeNamespaceFor( item: EndpointConfig ): string {
	return String(
		applyFilters(
			RKX_AS_HOOK_ROUTE_NAMESPACE,
			RKX_AS_REST_NAMESPACE,
			item
		) || RKX_AS_REST_NAMESPACE
	);
}

/**
 * Public route path shown for an endpoint, relative to its namespace.
 * @param item Endpoint configuration.
 */
export function routePathFor( item: EndpointConfig ): string {
	return String(
		applyFilters( RKX_AS_HOOK_ROUTE_PATH, item.slug, item ) || item.slug
	);
}

/**
 * Search, sort and paginate endpoints for the table.
 * @param endpoints          All endpoints.
 * @param view               Current table view.
 * @param getDataSourceLabel Label used when sorting by data source.
 */
export function filterSortAndPaginateEndpoints(
	endpoints: EndpointConfig[],
	view: ListView,
	getDataSourceLabel: ( dataSource: string ) => string = ( value ) => value
): {
	data: EndpointConfig[];
	paginationInfo: { totalItems: number; totalPages: number };
} {
	const needle = view.search.trim().toLowerCase();
	let rows = needle
		? endpoints.filter( ( item ) =>
				[ item.name, item.description ?? '' ].some( ( value ) =>
					value.toLowerCase().includes( needle )
				)
		  )
		: [ ...endpoints ];
	if ( view.sort ) {
		const { field, direction } = view.sort;
		const value = ( item: EndpointConfig ): string =>
			field === 'dataSource'
				? getDataSourceLabel( item.dataSource )
				: String( item[ field ] ?? '' );
		rows = rows.sort( ( a, b ) => {
			const result = value( a ).localeCompare( value( b ) );
			return direction === 'asc' ? result : -result;
		} );
	}
	const totalItems = rows.length;
	const totalPages = Math.max(
		1,
		Math.ceil( totalItems / ENDPOINTS_PER_PAGE )
	);
	const page = Math.min( Math.max( 1, view.page ), totalPages );
	return {
		data: rows.slice(
			( page - 1 ) * ENDPOINTS_PER_PAGE,
			page * ENDPOINTS_PER_PAGE
		),
		paginationInfo: { totalItems, totalPages },
	};
}

interface EndpointTableProps {
	data: EndpointConfig[];
	allItems: EndpointConfig[];
	columns: ColumnDefinition[];
	actions: RowAction[];
	view: ListView;
	onChangeView: ( view: ListView ) => void;
	paginationInfo: { totalItems: number; totalPages: number };
	selectedIds: string[];
	onChangeSelection: ( ids: string[] ) => void;
}

/**
 * Plain endpoint table with search, sorting, pagination and bulk actions.
 * Built only from stable @wordpress/components primitives.
 * @param root0
 * @param root0.data
 * @param root0.allItems
 * @param root0.columns
 * @param root0.actions
 * @param root0.view
 * @param root0.onChangeView
 * @param root0.paginationInfo
 * @param root0.selectedIds
 * @param root0.onChangeSelection
 */
export function EndpointTable( {
	data,
	allItems,
	columns,
	actions,
	view,
	onChangeView,
	paginationInfo,
	selectedIds,
	onChangeSelection,
}: EndpointTableProps ) {
	const page = Math.min( view.page, paginationInfo.totalPages );
	const selected = allItems.filter( ( item ) =>
		selectedIds.includes( item.id )
	);
	const pageIds = data.map( ( item ) => item.id );
	const allOnPageSelected =
		pageIds.length > 0 &&
		pageIds.every( ( id ) => selectedIds.includes( id ) );

	const toggleSort = ( field: SortField ) => {
		const direction =
			view.sort?.field === field && view.sort.direction === 'asc'
				? 'desc'
				: 'asc';
		onChangeView( { ...view, sort: { field, direction } } );
	};

	return (
		<div className="rkx-as-endpoint-table">
			<div className="rkx-as-endpoint-table__toolbar">
				<SearchControl
					__nextHasNoMarginBottom
					label={ __( 'Search endpoints', 'rkx-api-studio' ) }
					value={ view.search }
					onChange={ ( search: string ) =>
						onChangeView( { ...view, search, page: 1 } )
					}
				/>
				{ selected.length > 0 && (
					<div className="rkx-as-endpoint-table__bulk">
						<span>
							{ sprintf(
								/* translators: %d: number of selected endpoints */
								_n(
									'%d selected',
									'%d selected',
									selected.length,
									'rkx-api-studio'
								),
								selected.length
							) }
						</span>
						{ actions
							.filter( ( action ) => action.supportsBulk )
							.map( ( action ) => (
								<Button
									key={ action.id }
									variant="secondary"
									isDestructive={ action.isDestructive }
									icon={ action.icon }
									onClick={ () =>
										action.callback( selected )
									}
								>
									{ action.label }
								</Button>
							) ) }
					</div>
				) }
			</div>
			<table className="wp-list-table widefat striped rkx-as-endpoint-table__table">
				<thead>
					<tr>
						<td className="check-column">
							<input
								type="checkbox"
								aria-label={ __(
									'Select all',
									'rkx-api-studio'
								) }
								checked={ allOnPageSelected }
								onChange={ ( event ) => {
									const checked = event.target.checked;
									onChangeSelection(
										checked
											? [
													...new Set( [
														...selectedIds,
														...pageIds,
													] ),
											  ]
											: selectedIds.filter(
													( id ) =>
														! pageIds.includes( id )
											  )
									);
								} }
							/>
						</td>
						{ columns.map( ( column ) => (
							<th
								key={ column.id }
								scope="col"
								aria-sort={
									// eslint-disable-next-line no-nested-ternary
									view.sort?.field === column.sortable
										? view.sort?.direction === 'asc'
											? 'ascending'
											: 'descending'
										: undefined
								}
							>
								{ column.sortable ? (
									<Button
										variant="link"
										onClick={ () =>
											toggleSort(
												column.sortable as SortField
											)
										}
									>
										{ column.label }
										{ view.sort?.field ===
											column.sortable &&
											( view.sort.direction === 'asc'
												? ' ↑'
												: ' ↓' ) }
									</Button>
								) : (
									column.label
								) }
							</th>
						) ) }
						<th scope="col">
							{ __( 'Actions', 'rkx-api-studio' ) }
						</th>
					</tr>
				</thead>
				<tbody>
					{ data.length === 0 ? (
						<tr>
							<td colSpan={ columns.length + 2 }>
								{ __(
									'No endpoints found.',
									'rkx-api-studio'
								) }
							</td>
						</tr>
					) : (
						data.map( ( item ) => (
							<tr key={ item.id }>
								<th scope="row" className="check-column">
									<input
										type="checkbox"
										aria-label={ item.name }
										checked={ selectedIds.includes(
											item.id
										) }
										onChange={ ( event ) => {
											const checked =
												event.target.checked;
											onChangeSelection(
												checked
													? [
															...selectedIds,
															item.id,
													  ]
													: selectedIds.filter(
															( id ) =>
																id !== item.id
													  )
											);
										} }
									/>
								</th>
								{ columns.map( ( column ) => (
									<td key={ column.id }>
										{ column.render( item ) }
									</td>
								) ) }
								<td className="rkx-as-endpoint-table__actions">
									{ actions
										.filter(
											( action ) =>
												! action.isEligible ||
												action.isEligible( item )
										)
										.map( ( action ) => (
										<Button
											key={ action.id }
											size="small"
											icon={ action.icon }
											label={ action.label }
											isDestructive={
												action.isDestructive
											}
											onClick={ () =>
												action.callback( [ item ] )
											}
										/>
									) ) }
								</td>
							</tr>
						) )
					) }
				</tbody>
			</table>
			{ paginationInfo.totalPages > 1 && (
				<div className="rkx-as-endpoint-table__pagination">
					<Button
						variant="secondary"
						disabled={ page <= 1 }
						onClick={ () =>
							onChangeView( { ...view, page: page - 1 } )
						}
					>
						{ __( 'Previous', 'rkx-api-studio' ) }
					</Button>
					<span>
						{ sprintf(
							/* translators: 1: current page, 2: total pages */
							__( 'Page %1$d of %2$d', 'rkx-api-studio' ),
							page,
							paginationInfo.totalPages
						) }
					</span>
					<Button
						variant="secondary"
						disabled={ page >= paginationInfo.totalPages }
						onClick={ () =>
							onChangeView( { ...view, page: page + 1 } )
						}
					>
						{ __( 'Next', 'rkx-api-studio' ) }
					</Button>
				</div>
			) }
		</div>
	);
}
