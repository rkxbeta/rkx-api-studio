import { useState, useEffect, useCallback, useMemo } from '@wordpress/element';
import { Button, Notice, Spinner } from '@wordpress/components';
import {
	pencil,
	trash,
	external,
	download,
	cancelCircleFilled,
} from '@wordpress/icons';
import { dateI18n, getSettings, humanTimeDiff } from '@wordpress/date';
import { __, sprintf, _n } from '@wordpress/i18n';
import type { EndpointConfig, DataSource } from '../types';
import { isWriteMethod } from '../types';
import { getEndpoints, deleteEndpoint } from '../api/client';
import { downloadExportFile } from '../utils/export-utils';
import { clearEndpointCache } from '../api/settings-client';
import { ConfirmationModal } from './ConfirmationModal';
import { MethodBadge } from './MethodBadge';
import { getSingleItemRoute } from '../hooks/rkx-as-hooks';
import { ProPromotionSection } from './ProPromotionSection';
import {
	EndpointTable,
	filterSortAndPaginateEndpoints,
	routeNamespaceFor,
	routePathFor,
} from './EndpointTable';
import type { ColumnDefinition, ListView, RowAction } from './EndpointTable';

declare const rkxApiStudio:
	| {
			docsUrl?: string;
			settingsUrl?: string;
			proUrl?: string;
			compareUrl?: string;
	  }
	| undefined;

interface EndpointListProps {
	onEdit: ( config: EndpointConfig ) => void;
	onCreate: () => void;
}

const DATA_SOURCE_LABELS: Record< string, string > = {
	posts: __( 'Posts', 'rkx-api-studio' ),
	pages: __( 'Pages', 'rkx-api-studio' ),
	categories: __( 'Categories', 'rkx-api-studio' ),
	tags: __( 'Tags', 'rkx-api-studio' ),
	custom_taxonomy: __( 'Custom Taxonomy', 'rkx-api-studio' ),
};

function getDataSourceLabel( dataSource: DataSource | string ): string {
	return DATA_SOURCE_LABELS[ dataSource ] || dataSource;
}

function formatWpDateTime( dateString?: string ): string {
	if ( ! dateString ) {
		return '';
	}
	const { formats } = getSettings();
	return dateI18n( `${ formats.date } ${ formats.time }`, dateString );
}

function relativeTime( dateString?: string ): string {
	if ( ! dateString ) {
		return '—';
	}
	return humanTimeDiff( dateString, undefined );
}

export function EndpointList( { onEdit, onCreate }: EndpointListProps ) {
	const [ endpoints, setEndpoints ] = useState< EndpointConfig[] >( [] );
	const [ isLoading, setIsLoading ] = useState( true );
	const [ error, setError ] = useState< string | null >( null );
	const [ deleteModal, setDeleteModal ] = useState< {
		type: 'single' | 'bulk';
		items: EndpointConfig[];
	} | null >( null );
	const [ clearCacheModal, setClearCacheModal ] =
		useState< EndpointConfig | null >( null );
	const [ successNotice, setSuccessNotice ] = useState< string | null >(
		null
	);

	const [ view, setView ] = useState< ListView >( {
		search: '',
		page: 1,
		sort: undefined,
	} );
	const [ selectedIds, setSelectedIds ] = useState< string[] >( [] );

	const fetchEndpoints = useCallback( async () => {
		setIsLoading( true );
		setError( null );
		try {
			const data = await getEndpoints();
			setEndpoints( data );
		} catch {
			setError(
				__(
					'Failed to load endpoints. Please try again.',
					'rkx-api-studio'
				)
			);
		} finally {
			setIsLoading( false );
		}
	}, [] );

	useEffect( () => {
		fetchEndpoints();
	}, [ fetchEndpoints ] );

	const columns: ColumnDefinition[] = useMemo(
		() => [
			{
				id: 'name',
				label: __( 'Name', 'rkx-api-studio' ),
				sortable: 'name',
				render: ( item ) => (
					<span className="rkx-as-endpoint-list__name-cell">
						<MethodBadge method={ item.method } />
						<strong>{ item.name }</strong>
					</span>
				),
			},
			{
				id: 'description',
				label: __( 'Description', 'rkx-api-studio' ),
				render: ( item ) => <>{ item.description || '—' }</>,
			},
			{
				id: 'dataSource',
				label: __( 'Data Source', 'rkx-api-studio' ),
				sortable: 'dataSource',
				render: ( item ) =>
					isWriteMethod( item.method ?? 'GET' ) ? (
						<span className="rkx-as-endpoint-list__na">
							{ __( 'N/A', 'rkx-api-studio' ) }
						</span>
					) : (
						<>{ getDataSourceLabel( item.dataSource ) }</>
					),
			},
			{
				id: 'slug',
				label: __( 'Slug', 'rkx-api-studio' ),
				sortable: 'slug',
				render: ( item ) => <code>{ item.slug }</code>,
			},
			{
				id: 'fields',
				label: __( 'Fields', 'rkx-api-studio' ),
				render: ( item ) =>
					isWriteMethod( item.method ?? 'GET' ) ? (
						<span className="rkx-as-endpoint-list__na">
							{ __( 'N/A', 'rkx-api-studio' ) }
						</span>
					) : (
						<>{ String( item.fields.length ) }</>
					),
			},
			{
				id: 'useWordPressDefaults',
				label: __( 'Params Mode', 'rkx-api-studio' ),
				render: ( item ) =>
					isWriteMethod( item.method ?? 'GET' ) ? (
						<span className="rkx-as-endpoint-list__na">
							{ __( 'N/A', 'rkx-api-studio' ) }
						</span>
					) : (
						<span
							className={ `rkx-as-endpoint-list__badge ${
								item.useWordPressDefaults
									? 'rkx-as-endpoint-list__badge--wp-defaults'
									: 'rkx-as-endpoint-list__badge--custom'
							}` }
						>
							{ item.useWordPressDefaults
								? __( 'WP Defaults', 'rkx-api-studio' )
								: __( 'Custom', 'rkx-api-studio' ) }
						</span>
					),
			},
			{
				id: 'url',
				label: __( 'API URL', 'rkx-api-studio' ),
				render: ( item ) => (
					<code>
						/wp-json/{ routeNamespaceFor( item ) }/
						{ routePathFor( item ) }
					</code>
				),
			},
			{
				id: 'createdAt',
				label: __( 'Created', 'rkx-api-studio' ),
				sortable: 'createdAt',
				render: ( item ) => (
					<span title={ formatWpDateTime( item.createdAt ) }>
						{ relativeTime( item.createdAt ) }
					</span>
				),
			},
		],
		[]
	);

	const { data, paginationInfo } = useMemo( () => {
		return filterSortAndPaginateEndpoints(
			endpoints,
			view,
			getDataSourceLabel
		);
	}, [ endpoints, view ] );

	const handleConfirmDelete = useCallback( async () => {
		if ( ! deleteModal ) {
			return;
		}

		const { items } = deleteModal;
		const succeeded: string[] = [];
		const failed: string[] = [];

		// Delete sequentially to avoid race conditions in wp_options storage.
		for ( const item of items ) {
			try {
				await deleteEndpoint( item.id );
				succeeded.push( item.id );
			} catch {
				failed.push( item.name );
			}
		}

		if ( succeeded.length > 0 ) {
			setEndpoints( ( prev ) =>
				prev.filter( ( ep ) => ! succeeded.includes( ep.id ) )
			);
			setSelectedIds( ( prev ) =>
				prev.filter( ( id ) => ! succeeded.includes( id ) )
			);
		}

		if ( failed.length > 0 ) {
			setError(
				sprintf(
					/* translators: %s: comma-separated list of endpoint names that failed to delete */
					__( 'Failed to delete: %s', 'rkx-api-studio' ),
					failed.join( ', ' )
				)
			);
		}

		setDeleteModal( null );
	}, [ deleteModal ] );

	const handleConfirmClearCache = useCallback( async () => {
		if ( ! clearCacheModal ) {
			return;
		}

		try {
			await clearEndpointCache( clearCacheModal.slug );
			setSuccessNotice(
				sprintf(
					/* translators: %s: endpoint name */
					__( 'Cache cleared for endpoint "%s".', 'rkx-api-studio' ),
					clearCacheModal.name
				)
			);
		} catch {
			setError(
				sprintf(
					/* translators: %s: endpoint name */
					__(
						'Failed to clear cache for endpoint "%s". Please try again.',
						'rkx-api-studio'
					),
					clearCacheModal.name
				)
			);
		}

		setClearCacheModal( null );
	}, [ clearCacheModal ] );

	const actions: RowAction[] = useMemo(
		() => [
			{
				id: 'edit',
				label: __( 'Edit', 'rkx-api-studio' ),
				icon: pencil,
				callback: ( items ) => {
					onEdit( items[ 0 ] );
				},
			},
			{
				id: 'view',
				label: __( 'View API', 'rkx-api-studio' ),
				icon: external,
				// A single-item route needs a slug or ID, so there is no URL to open.
				isEligible: ( item ) => getSingleItemRoute( item ) === null,
				callback: ( items ) => {
					const item = items[ 0 ];
					window.open(
						`/wp-json/${ routeNamespaceFor(
							item
						) }/${ routePathFor( item ) }`,
						'_blank'
					);
				},
			},
			{
				id: 'export',
				label: __( 'Export', 'rkx-api-studio' ),
				icon: download,
				supportsBulk: true,
				callback: ( itemsArray ) => {
					return Promise.resolve(
						downloadExportFile( itemsArray )
					).catch( () => {
						setError(
							__(
								'Failed to export endpoints. Please try again.',
								'rkx-api-studio'
							)
						);
					} );
				},
			},
			{
				id: 'clear-cache',
				label: __( 'Clear Cache', 'rkx-api-studio' ),
				icon: cancelCircleFilled,
				callback: ( items ) => {
					setClearCacheModal( items[ 0 ] );
				},
			},
			{
				id: 'delete',
				label: __( 'Delete', 'rkx-api-studio' ),
				isDestructive: true,
				icon: trash,
				supportsBulk: true,
				callback: ( itemsArray ) => {
					setDeleteModal( {
						type: itemsArray.length > 1 ? 'bulk' : 'single',
						items: itemsArray,
					} );
				},
			},
		],
		[ onEdit ]
	);

	const navConfig =
		typeof rkxApiStudio !== 'undefined' ? rkxApiStudio : undefined;
	const docsUrl = navConfig?.docsUrl || '';
	const settingsUrl = navConfig?.settingsUrl || '';
	const proUrl = navConfig?.proUrl || '';
	const compareUrl = navConfig?.compareUrl || '';
	const hasHeaderNav = Boolean( docsUrl || settingsUrl || proUrl );

	return (
		<div className="rkx-as-endpoint-list">
			<div className="rkx-as-endpoint-list__header">
				<div>
					<div className="rkx-as-header-title-row">
						<h2>{ __( 'API Endpoints', 'rkx-api-studio' ) }</h2>
					</div>
					<p className="rkx-as-page-description">
						{ __(
							'Create and manage custom REST API endpoints with only the fields you need.',
							'rkx-api-studio'
						) }
					</p>
				</div>
				<div className="rkx-as-endpoint-list__header-actions">
					{ hasHeaderNav && (
						<nav
							className="rkx-as-admin-nav"
							aria-label={ __(
								'Plugin links',
								'rkx-api-studio'
							) }
						>
							{ docsUrl && (
								<a
									className="rkx-as-admin-nav__link"
									href={ docsUrl }
									target="_blank"
									rel="noopener noreferrer"
								>
									{ __( 'Documentation', 'rkx-api-studio' ) }
								</a>
							) }
							{ settingsUrl && (
								<a
									className="rkx-as-admin-nav__link"
									href={ settingsUrl }
								>
									{ __( 'Settings', 'rkx-api-studio' ) }
								</a>
							) }
							{ proUrl && (
								<a
									className="rkx-as-admin-nav__link rkx-as-admin-nav__link--pro"
									href={ proUrl }
									target="_blank"
									rel="noopener noreferrer"
								>
									{ __( 'Explore Pro ↗', 'rkx-api-studio' ) }
								</a>
							) }
						</nav>
					) }
					<Button variant="primary" onClick={ onCreate }>
						{ __( 'Create Endpoint', 'rkx-api-studio' ) }
					</Button>
				</div>
			</div>

			{ error && (
				<Notice
					status="error"
					isDismissible
					onRemove={ () => setError( null ) }
				>
					{ error }
				</Notice>
			) }

			{ successNotice && (
				<Notice
					status="success"
					isDismissible
					onRemove={ () => setSuccessNotice( null ) }
				>
					{ successNotice }
				</Notice>
			) }

			{ /* eslint-disable-next-line no-nested-ternary */ }
			{ isLoading ? (
				<div className="rkx-as-endpoint-list__loading">
					<Spinner />
				</div>
			) : endpoints.length === 0 ? (
				<div className="rkx-as-endpoint-list__empty">
					<p>
						{ __(
							'No endpoints yet. Create your first endpoint to get started.',
							'rkx-api-studio'
						) }
					</p>
				</div>
			) : (
				<EndpointTable
					data={ data }
					columns={ columns }
					actions={ actions }
					view={ view }
					onChangeView={ setView }
					paginationInfo={ paginationInfo }
					selectedIds={ selectedIds }
					onChangeSelection={ setSelectedIds }
					allItems={ endpoints }
				/>
			) }

			{ ! isLoading && (
				<ProPromotionSection
					proUrl={ proUrl }
					compareUrl={ compareUrl }
				/>
			) }

			{ deleteModal && (
				<div className="rkx-as-delete-confirmation-overlay">
					<div className="rkx-as-delete-confirmation">
						<p>
							{ deleteModal.type === 'bulk' ? (
								sprintf(
									/* translators: %d: number of endpoints to delete */
									_n(
										'Are you sure you want to delete %d endpoint? This action cannot be undone.',
										'Are you sure you want to delete %d endpoints? This action cannot be undone.',
										deleteModal.items.length,
										'rkx-api-studio'
									),
									deleteModal.items.length
								)
							) : (
								<>
									{ sprintf(
										/* translators: %s: endpoint name */
										__(
											'Are you sure you want to delete the endpoint "%s"? This action cannot be undone.',
											'rkx-api-studio'
										),
										deleteModal.items[ 0 ].name
									) }
								</>
							) }
						</p>
						<div className="rkx-as-delete-confirmation__actions">
							<Button
								variant="secondary"
								onClick={ () => setDeleteModal( null ) }
							>
								{ __( 'Cancel', 'rkx-api-studio' ) }
							</Button>
							<Button
								variant="primary"
								isDestructive
								onClick={ handleConfirmDelete }
							>
								{ deleteModal.type === 'bulk'
									? sprintf(
											/* translators: %d: number of endpoints to delete */
											_n(
												'Delete %d Endpoint',
												'Delete %d Endpoints',
												deleteModal.items.length,
												'rkx-api-studio'
											),
											deleteModal.items.length
									  )
									: __(
											'Delete Endpoint',
											'rkx-api-studio'
									  ) }
							</Button>
						</div>
					</div>
				</div>
			) }

			{ clearCacheModal && (
				<ConfirmationModal
					title={ __( 'Clear Endpoint Cache', 'rkx-api-studio' ) }
					message={ sprintf(
						/* translators: %s: endpoint name */
						__(
							'Are you sure you want to clear the cache for endpoint "%s"?',
							'rkx-api-studio'
						),
						clearCacheModal.name
					) }
					confirmLabel={ __( 'Clear Cache', 'rkx-api-studio' ) }
					isDestructive
					onConfirm={ handleConfirmClearCache }
					onCancel={ () => setClearCacheModal( null ) }
				/>
			) }
		</div>
	);
}
