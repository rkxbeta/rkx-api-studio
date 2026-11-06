import { useState, useEffect, useCallback } from '@wordpress/element';
import { __ } from '@wordpress/i18n';
import type { EndpointConfig } from '../types';
import { getEndpoints } from '../api/client';
import { EndpointList } from './EndpointList';
import { EndpointBuilder } from './EndpointBuilder';

declare const rkxApiStudio: {
	restUrl: string;
	nonce: string;
	baseSlug: string;
	currentPage: string;
	editId: string;
	adminUrl: string;
};

type View = 'list' | 'create' | 'edit';

function getInitialView(): View {
	if ( rkxApiStudio.currentPage === 'rkx-api-studio-manage' ) {
		return rkxApiStudio.editId ? 'edit' : 'create';
	}
	return 'list';
}

function navigateTo( page: string, params?: Record< string, string > ) {
	const url = new URL( rkxApiStudio.adminUrl, window.location.origin );
	url.searchParams.set( 'page', page );
	if ( params ) {
		for ( const [ key, value ] of Object.entries( params ) ) {
			url.searchParams.set( key, value );
		}
	}
	window.location.href = url.toString();
}

export function App() {
	const [ view ] = useState< View >( getInitialView );
	const [ editConfig, setEditConfig ] = useState<
		EndpointConfig | undefined
	>();
	const [ loading, setLoading ] = useState( view === 'edit' );

	// If we're on the create page with an edit ID, fetch that config.
	useEffect( () => {
		if ( view === 'edit' && rkxApiStudio.editId && ! editConfig ) {
			setLoading( true );
			getEndpoints()
				.then( ( endpoints ) => {
					const found = endpoints.find(
						( ep ) => ep.id === rkxApiStudio.editId
					);
					if ( found ) {
						setEditConfig( found );
					} else {
						// Config not found, go back to list.
						navigateTo( 'rkx-api-studio' );
					}
				} )
				.catch( () => {
					navigateTo( 'rkx-api-studio' );
				} )
				.finally( () => setLoading( false ) );
		}
	}, [ view, editConfig ] );

	const handleEdit = useCallback( ( config: EndpointConfig ) => {
		navigateTo( 'rkx-api-studio-manage', { id: config.id } );
	}, [] );

	const handleCreate = useCallback( () => {
		navigateTo( 'rkx-api-studio-manage' );
	}, [] );

	const handleCancel = useCallback( () => {
		navigateTo( 'rkx-api-studio' );
	}, [] );

	if ( view === 'list' ) {
		return <EndpointList onEdit={ handleEdit } onCreate={ handleCreate } />;
	}

	if ( loading ) {
		return (
			<div className="rkx-as-endpoint-builder">
				<p>{ __( 'Loading endpoint…', 'rkx-api-studio' ) }</p>
			</div>
		);
	}

	return <EndpointBuilder config={ editConfig } onCancel={ handleCancel } />;
}
