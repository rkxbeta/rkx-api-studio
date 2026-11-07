import {
	applyComponentFilters,
	RKX_AS_HOOK_EXTENSION_FIELD_GROUPS,
	RKX_AS_HOOK_METHOD_PANEL,
	RKX_AS_HOOK_ROUTE_NAMESPACE,
	RKX_AS_HOOK_ROUTE_PATH,
	RKX_AS_REST_NAMESPACE,
	getSingleItemRoute,
} from '../hooks/rkx-as-hooks';
import { useState, useCallback, useEffect, useRef } from '@wordpress/element';
import { Button, Modal, Notice, Tooltip } from '@wordpress/components';
import { __, sprintf } from '@wordpress/i18n';
import { dateI18n, getSettings, humanTimeDiff } from '@wordpress/date';
import { applyFilters } from '@wordpress/hooks';
import {
	DndContext,
	DragEndEvent,
	DragStartEvent,
	DragOverlay,
} from '@dnd-kit/core';
import { arrayMove } from '@dnd-kit/sortable';
import type { DataSourceMetadata, EndpointConfig } from '../types';
import {
	POST_FIELDS,
	TAXONOMY_FIELDS,
	isMetaField,
	getMetaKey,
	CUSTOM_META_FIELD_ID,
	CUSTOM_META_FIELD,
	META_PREFIX,
	isWriteMethod,
} from '../types';
import { useEndpointBuilder } from '../hooks/useEndpointBuilder';
import {
	createEndpoint,
	updateEndpoint,
	fetchDataSources,
} from '../api/client';
import { getKeyStatus } from '../api/security-client';
import { FieldPanel, FIELD_PANEL_PREFIX } from './FieldPanel';
import { ActiveOutputZone } from './ActiveOutputZone';
import { JsonPreview } from './JsonPreview';
import { EndpointSettings } from './EndpointSettings';
import { QueryParametersPanel } from './QueryParametersPanel';
import { MethodSelector } from './MethodSelector';

interface EndpointBuilderProps {
	config?: EndpointConfig;
	onCancel: () => void;
}

declare const rkxApiStudio: {
	adminUrl: string;
};

function formatWpDateTime( dateString?: string ): string {
	if ( ! dateString ) {
		return '';
	}
	const { formats } = getSettings();
	return dateI18n( `${ formats.date } ${ formats.time }`, dateString );
}

export function EndpointBuilder( { config, onCancel }: EndpointBuilderProps ) {
	const { state, dispatch } = useEndpointBuilder( config );
	const [ notice, setNotice ] = useState< {
		type: 'success' | 'error';
		message: string;
	} | null >( null );
	const [ isSaving, setIsSaving ] = useState( false );
	const [ activeDragId, setActiveDragId ] = useState< string | null >( null );
	const [ showCancelModal, setShowCancelModal ] = useState( false );
	const [ metadata, setMetadata ] = useState< DataSourceMetadata | null >(
		null
	);
	const [ hasApiKey, setHasApiKey ] = useState( false );
	const [ extensionData, setExtensionData ] = useState< unknown[] >( [] );
	const isDirtyRef = useRef( state.isDirty );
	const isLeavingRef = useRef( false );
	isDirtyRef.current = state.isDirty;

	// Fetch data source metadata once on mount and share it with child components.
	useEffect( () => {
		let cancelled = false;

		fetchDataSources()
			.then( ( data ) => {
				if ( ! cancelled ) {
					setMetadata( data );
				}
			} )
			.catch( () => {
				// Silently fall back — DataSourceSelector has its own fallback handling.
			} );

		getKeyStatus()
			.then( ( status ) => {
				if ( ! cancelled ) {
					setHasApiKey( status.exists );
				}
			} )
			.catch( () => {
				// Silently fall back — toggle will remain disabled.
			} );

		return () => {
			cancelled = true;
		};
	}, [] );

	// Load opaque extension data; Core does not interpret it.
	useEffect( () => {
		const ds = state.config.dataSource;
		if ( ! ds ) {
			setExtensionData( [] );
			return;
		}
		let cancelled = false;
		const groupsResult = applyFilters(
			RKX_AS_HOOK_EXTENSION_FIELD_GROUPS,
			[],
			{
				dataSource: ds,
				metadata,
				setGroups: ( loadedGroups: unknown[] ) => {
					if ( ! cancelled && Array.isArray( loadedGroups ) ) {
						setExtensionData( loadedGroups );
					}
				},
			}
		);
		if ( Array.isArray( groupsResult ) ) {
			setExtensionData( groupsResult );
		} else if (
			groupsResult &&
			typeof ( groupsResult as Promise< unknown[] > ).then === 'function'
		) {
			setExtensionData( [] );
			( groupsResult as Promise< unknown[] > )
				.then( ( loadedGroups ) => {
					if ( ! cancelled && Array.isArray( loadedGroups ) ) {
						setExtensionData( loadedGroups );
					}
				} )
				.catch( () => {} );
		} else {
			setExtensionData( [] );
		}
		return () => {
			cancelled = true;
		};
	}, [ state.config.dataSource, metadata ] );

	const isEditMode = Boolean( state.config.id );
	const routeNamespace = String(
		applyFilters(
			RKX_AS_HOOK_ROUTE_NAMESPACE,
			RKX_AS_REST_NAMESPACE,
			state.config
		) || RKX_AS_REST_NAMESPACE
	);
	const routePath = String(
		applyFilters(
			RKX_AS_HOOK_ROUTE_PATH,
			state.config.slug,
			state.config
		) || state.config.slug
	);
	const singleItem = getSingleItemRoute( state.config );

	// Show success notice after redirect from newly created endpoint.
	useEffect( () => {
		const params = new URLSearchParams( window.location.search );
		if ( params.get( 'created' ) === '1' ) {
			setNotice( {
				type: 'success',
				message: __(
					'Endpoint created successfully.',
					'rkx-api-studio'
				),
			} );
			// Clean up the URL param without triggering a reload.
			const url = new URL( window.location.href );
			url.searchParams.delete( 'created' );
			window.history.replaceState( {}, '', url.toString() );
		}
	}, [] );

	// Show browser's native "Leave site?" dialog on refresh/tab close.
	useEffect( () => {
		const handleBeforeUnload = ( e: BeforeUnloadEvent ) => {
			if ( ! isDirtyRef.current || isLeavingRef.current ) {
				return;
			}
			e.preventDefault();
		};
		window.addEventListener( 'beforeunload', handleBeforeUnload );
		return () => {
			window.removeEventListener( 'beforeunload', handleBeforeUnload );
		};
	}, [] );

	// Intercept browser back button: push a guard state on mount,
	// then show our modal instead of navigating away.
	useEffect( () => {
		// Push a dummy state so pressing back triggers popstate instead of leaving.
		window.history.pushState( { hasGuard: true }, '' );

		const handlePopState = () => {
			if ( isLeavingRef.current ) {
				// We're intentionally leaving — don't intercept.
				return;
			}
			if ( isDirtyRef.current ) {
				// Re-push the guard state to stay on the page.
				window.history.pushState( { hasGuard: true }, '' );
				setShowCancelModal( true );
			} else {
				// Not dirty — let the back navigation happen.
				window.history.back();
			}
		};

		window.addEventListener( 'popstate', handlePopState );
		return () => {
			window.removeEventListener( 'popstate', handlePopState );
		};
	}, [] );

	const handleCancelClick = useCallback( () => {
		if ( state.isDirty ) {
			setShowCancelModal( true );
		} else {
			onCancel();
		}
	}, [ state.isDirty, onCancel ] );

	const handleConfirmLeave = useCallback( () => {
		setShowCancelModal( false );
		isLeavingRef.current = true;
		// Clear dirty state so beforeunload doesn't fire during navigation.
		dispatch( { type: 'LOAD_CONFIG', payload: state.config } );
		// Use setTimeout to let the state update propagate before navigating.
		setTimeout( () => onCancel(), 0 );
	}, [ onCancel, dispatch, state.config ] );

	const handleDragStart = useCallback( ( event: DragStartEvent ) => {
		const rawId = String( event.active.id );
		const fieldId = rawId.startsWith( FIELD_PANEL_PREFIX )
			? rawId.slice( FIELD_PANEL_PREFIX.length )
			: rawId;
		setActiveDragId( fieldId );
	}, [] );

	const handleDragEnd = useCallback(
		( event: DragEndEvent ) => {
			const { active, over } = event;

			if ( ! over ) {
				setActiveDragId( null );
				return;
			}

			const rawActiveId = String( active.id );
			const overId = String( over.id );

			const isFromPanel = rawActiveId.startsWith( FIELD_PANEL_PREFIX );
			const activeFieldId = isFromPanel
				? rawActiveId.slice( FIELD_PANEL_PREFIX.length )
				: rawActiveId;

			const isOverZone =
				overId === 'active-output' ||
				state.config.fields.includes( overId );

			if ( isFromPanel && isOverZone ) {
				if ( activeFieldId === CUSTOM_META_FIELD_ID ) {
					const uniqueId = `${ META_PREFIX }${ Date.now() }`;
					dispatch( { type: 'ADD_FIELD', payload: uniqueId } );
				} else {
					dispatch( { type: 'ADD_FIELD', payload: activeFieldId } );
				}
				setActiveDragId( null );
				return;
			}

			if (
				state.config.fields.includes( activeFieldId ) &&
				state.config.fields.includes( overId ) &&
				activeFieldId !== overId
			) {
				const oldIndex = state.config.fields.indexOf( activeFieldId );
				const newIndex = state.config.fields.indexOf( overId );
				const reordered = arrayMove(
					state.config.fields,
					oldIndex,
					newIndex
				);
				dispatch( { type: 'REORDER_FIELDS', payload: reordered } );
			}

			setActiveDragId( null );
		},
		[ state.config.fields, dispatch ]
	);

	const handleSave = useCallback( async () => {
		setNotice( null );

		const errors: Record< string, string > = {};
		if ( state.config.name.trim() === '' ) {
			errors.name = __( 'Endpoint name is required.', 'rkx-api-studio' );
		}
		if ( state.config.slug.trim() === '' ) {
			errors.slug = __( 'Endpoint slug is required.', 'rkx-api-studio' );
		}
		if (
			! isWriteMethod( state.config.method ?? 'GET' ) &&
			state.config.fields.length === 0
		) {
			errors.fields = __(
				'Please add at least one field to the output.',
				'rkx-api-studio'
			);
		}

		// Check for empty, whitespace-only, or placeholder (timestamp) meta keys.
		const invalidMeta =
			! isWriteMethod( state.config.method ?? 'GET' ) &&
			state.config.fields.some(
				( f ) =>
					isMetaField( f ) &&
					( getMetaKey( f ).trim() === '' ||
						/^\d+$/.test( getMetaKey( f ) ) )
			);
		if ( invalidMeta ) {
			errors.fields = __(
				'All custom meta fields must have a meta key.',
				'rkx-api-studio'
			);
		}

		// Check for duplicate meta keys.
		const metaKeys = state.config.fields
			.filter( isMetaField )
			.map( getMetaKey );
		const hasDuplicates = new Set( metaKeys ).size !== metaKeys.length;
		if (
			! isWriteMethod( state.config.method ?? 'GET' ) &&
			hasDuplicates
		) {
			errors.fields = __(
				'Duplicate custom meta keys are not allowed.',
				'rkx-api-studio'
			);
		}

		if ( Object.keys( errors ).length > 0 ) {
			dispatch( { type: 'VALIDATE', payload: errors } );
			return;
		}

		setIsSaving( true );

		try {
			let saved: EndpointConfig;
			if ( isEditMode ) {
				saved = await updateEndpoint( state.config.id, state.config );
			} else {
				saved = await createEndpoint( state.config );
			}
			dispatch( { type: 'SAVE_SUCCESS', payload: saved } );
			setNotice( {
				type: 'success',
				message: isEditMode
					? __( 'Endpoint updated successfully.', 'rkx-api-studio' )
					: __( 'Endpoint created successfully.', 'rkx-api-studio' ),
			} );

			if ( ! isEditMode ) {
				// First save: full redirect so WordPress re-renders admin chrome
				// with correct sidebar label and active state.
				// Clear dirty ref immediately so the beforeunload handler doesn't
				// fire during the redirect — the user already clicked "Create".
				isDirtyRef.current = false;
				isLeavingRef.current = true;
				const url = new URL(
					rkxApiStudio.adminUrl,
					window.location.origin
				);
				url.searchParams.set( 'page', 'rkx-api-studio-manage' );
				url.searchParams.set( 'id', saved.id );
				url.searchParams.set( 'created', '1' );
				window.location.href = url.toString();
				return;
			}

			window.scrollTo( { top: 0, behavior: 'smooth' } );
		} catch ( error: unknown ) {
			const err = error as {
				data?: { errors?: Record< string, string > };
				message?: string;
			};
			if ( err?.data?.errors ) {
				dispatch( {
					type: 'SAVE_ERROR',
					payload: err.data.errors,
				} );
			}
			setNotice( {
				type: 'error',
				message:
					err?.message ||
					__(
						'Failed to save endpoint. Please try again.',
						'rkx-api-studio'
					),
			} );

			window.scrollTo( { top: 0, behavior: 'smooth' } );
		} finally {
			setIsSaving( false );
		}
	}, [ state.config, isEditMode, dispatch ] );

	return (
		<div className="rkx-as-endpoint-builder">
			<div className="rkx-as-endpoint-builder__header">
				<div className="rkx-as-endpoint-builder__header-left">
					<div className="rkx-as-header-title-row">
						<h2>
							{ isEditMode
								? __( 'Edit Endpoint', 'rkx-api-studio' )
								: __( 'Create Endpoint', 'rkx-api-studio' ) }
						</h2>
					</div>
					{ isEditMode && state.config.slug && singleItem && (
						<code className="rkx-as-endpoint-builder__route">
							{ `GET /wp-json/${ routeNamespace }/${ routePath }` }
						</code>
					) }
					{ isEditMode && state.config.slug && ! singleItem && (
						<Tooltip
							text={ `/wp-json/${ routeNamespace }/${ routePath }` }
						>
							<a
								className="rkx-as-endpoint-builder__view-link"
								href={ `${ window.location.origin }/wp-json/${ routeNamespace }/${ routePath }` }
								target="_blank"
								rel="noopener noreferrer"
								aria-label={ __(
									'View API endpoint',
									'rkx-api-studio'
								) }
							>
								<svg
									xmlns="http://www.w3.org/2000/svg"
									viewBox="0 0 24 24"
									width="24"
									height="24"
									aria-hidden="true"
									focusable="false"
								>
									<path
										d="M19.5 4.5h-7V6h4.44l-5.97 5.97 1.06 1.06L18 7.06V11.5h1.5v-7Zm-13 1a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-4H17v4a.5.5 0 0 1-.5.5h-10a.5.5 0 0 1-.5-.5v-10a.5.5 0 0 1 .5-.5h4V5.5h-4Z"
										fill="currentColor"
									/>
								</svg>
							</a>
						</Tooltip>
					) }
				</div>
				{ isEditMode && state.config.createdAt && (
					<div className="rkx-as-endpoint-builder__timestamps">
						<Tooltip
							text={ formatWpDateTime( state.config.createdAt ) }
						>
							<span className="rkx-as-endpoint-builder__timestamp-chip">
								<svg
									xmlns="http://www.w3.org/2000/svg"
									viewBox="0 0 24 24"
									width="16"
									height="16"
									aria-hidden="true"
									focusable="false"
								>
									<path
										d="M12 4c-4.4 0-8 3.6-8 8s3.6 8 8 8 8-3.6 8-8-3.6-8-8-8zm0 14.5c-3.6 0-6.5-2.9-6.5-6.5S8.4 5.5 12 5.5s6.5 2.9 6.5 6.5-2.9 6.5-6.5 6.5zm.5-7V7h-1.5v5.3l4 2.4.8-1.2-3.3-2z"
										fill="currentColor"
									/>
								</svg>
								{ humanTimeDiff(
									state.config.createdAt,
									undefined
								) }
							</span>
						</Tooltip>
						{ state.config.updatedAt &&
							state.config.updatedAt !==
								state.config.createdAt && (
								<Tooltip
									text={ sprintf(
										/* translators: %s: formatted date and time */
										__( 'Updated: %s', 'rkx-api-studio' ),
										formatWpDateTime(
											state.config.updatedAt
										)
									) }
								>
									<span className="rkx-as-endpoint-builder__timestamp-chip rkx-as-endpoint-builder__timestamp-chip--updated">
										<svg
											xmlns="http://www.w3.org/2000/svg"
											viewBox="0 0 24 24"
											width="16"
											height="16"
											aria-hidden="true"
											focusable="false"
										>
											<path
												d="m19 7-3-3-8.5 8.5-1 4 4-1L19 7zm-7 11.5H5V20h7v-1.5z"
												fill="currentColor"
											/>
										</svg>
										{ humanTimeDiff(
											state.config.updatedAt,
											undefined
										) }
									</span>
								</Tooltip>
							) }
					</div>
				) }
			</div>

			{ notice && (
				<Notice
					status={ notice.type }
					isDismissible
					onRemove={ () => setNotice( null ) }
				>
					{ notice.message }
				</Notice>
			) }

			<MethodSelector
				method={ state.config.method ?? 'GET' }
				onChange={ ( method ) =>
					dispatch( { type: 'SET_METHOD', payload: method } )
				}
			/>

			<EndpointSettings
				name={ state.config.name }
				slug={ state.config.slug }
				description={ state.config.description }
				config={ state.config }
				dataSource={ state.config.dataSource }
				legacyCustomTaxonomy={ state.config.customTaxonomy }
				errors={ state.errors }
				isEditMode={ isEditMode }
				dispatch={ dispatch }
				metadata={ metadata }
				isProtected={ state.config.protected ?? false }
				hasApiKey={ hasApiKey }
				isWriteMode={ isWriteMethod( state.config.method ?? 'GET' ) }
			/>

			{ isWriteMethod( state.config.method ?? 'GET' ) &&
				applyComponentFilters( RKX_AS_HOOK_METHOD_PANEL, null, {
					method: state.config.method ?? 'GET',
					slug: state.config.slug,
				} ) }

			{ ! isWriteMethod( state.config.method ?? 'GET' ) && (
				<QueryParametersPanel
					perPage={ state.config.perPage }
					offset={ state.config.offset }
					order={ state.config.order }
					orderby={ state.config.orderby }
					dataSource={ state.config.dataSource }
					metadata={ metadata }
					useWordPressDefaults={
						state.config.useWordPressDefaults ?? false
					}
					taxonomyFilters={ state.config.taxonomyFilters ?? {} }
					errors={ state.errors }
					dispatch={ dispatch }
					singleItem={ singleItem !== null }
				/>
			) }

			{ ! isWriteMethod( state.config.method ?? 'GET' ) && (
				<DndContext
					onDragStart={ handleDragStart }
					onDragEnd={ handleDragEnd }
				>
					<div className="rkx-as-endpoint-builder__dnd-area">
						<FieldPanel
							dataSource={ state.config.dataSource }
							activeFields={ state.config.fields }
							metadata={ metadata ?? undefined }
						/>
						<ActiveOutputZone
							fields={ state.config.fields }
							dispatch={ dispatch }
							errors={ state.errors }
							dataSource={ state.config.dataSource }
							metadata={ metadata ?? undefined }
							fieldFormattersMap={
								state.config.fieldFormatters ?? {}
							}
							extensionData={ extensionData }
							config={ state.config }
						/>
					</div>
					<DragOverlay
						dropAnimation={ null }
						style={ { pointerEvents: 'none' } }
					>
						{ activeDragId ? (
							<div className="rkx-as-drag-overlay">
								{ ( () => {
									if (
										activeDragId === CUSTOM_META_FIELD_ID ||
										isMetaField( activeDragId )
									) {
										return CUSTOM_META_FIELD.label;
									}
									const allFields = [
										...POST_FIELDS,
										...TAXONOMY_FIELDS,
									];
									const field = allFields.find(
										( f ) => f.id === activeDragId
									);
									return applyFilters(
										'rkxAs.field.label',
										field ? field.label : activeDragId,
										activeDragId,
										extensionData
									) as string;
								} )() }
							</div>
						) : null }
					</DragOverlay>
				</DndContext>
			) }

			{ ! isWriteMethod( state.config.method ?? 'GET' ) && (
				<JsonPreview
					dataSource={ state.config.dataSource }
					fields={ state.config.fields }
					order={ state.config.order }
					orderby={ state.config.orderby }
					offset={ state.config.offset }
					perPage={ state.config.perPage }
					metadata={ metadata }
					taxonomyFilters={ state.config.taxonomyFilters }
					fieldFormatters={ state.config.fieldFormatters ?? {} }
					config={ state.config }
					singleItem={ singleItem }
					routeNamespace={ routeNamespace }
				/>
			) }

			<div className="rkx-as-endpoint-builder__actions">
				<Button
					variant="primary"
					onClick={ handleSave }
					isBusy={ isSaving }
					disabled={ isSaving }
				>
					{
						/* eslint-disable no-nested-ternary */
						isSaving
							? isEditMode
								? __( 'Saving…', 'rkx-api-studio' )
								: __( 'Creating…', 'rkx-api-studio' )
							: isEditMode
							? __( 'Save Endpoint', 'rkx-api-studio' )
							: __( 'Create Endpoint', 'rkx-api-studio' )
						/* eslint-enable no-nested-ternary */
					}
				</Button>
				<Button
					variant="secondary"
					onClick={ handleCancelClick }
					disabled={ isSaving }
				>
					{ __( 'Cancel', 'rkx-api-studio' ) }
				</Button>
			</div>

			{ showCancelModal && (
				<Modal
					title={ __( 'Unsaved Changes', 'rkx-api-studio' ) }
					onRequestClose={ () => setShowCancelModal( false ) }
					className="rkx-as-cancel-modal"
				>
					<p>
						{ __(
							'You have unsaved changes. Are you sure you want to leave? Your changes will be lost.',
							'rkx-api-studio'
						) }
					</p>
					<div className="rkx-as-cancel-modal__actions">
						<Button
							variant="secondary"
							onClick={ () => setShowCancelModal( false ) }
						>
							{ __( 'Keep Editing', 'rkx-api-studio' ) }
						</Button>
						<Button
							variant="primary"
							isDestructive
							onClick={ handleConfirmLeave }
						>
							{ __( 'Discard Changes', 'rkx-api-studio' ) }
						</Button>
					</div>
				</Modal>
			) }
		</div>
	);
}
