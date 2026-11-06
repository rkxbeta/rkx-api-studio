import { useState, useEffect, useCallback } from '@wordpress/element';
import {
	Button,
	ToggleControl,
	SelectControl,
	Spinner,
} from '@wordpress/components';
import { __ } from '@wordpress/i18n';
import {
	getSettings,
	updateSettings,
	clearAllCache,
} from '../../api/settings-client';
import type { PluginSettings } from '../../api/settings-client';
import type { NoticePayload } from './ToolsTab';

interface CacheSettingsCardProps {
	onNotice: ( notice: NoticePayload ) => void;
}

const TTL_OPTIONS = [
	{ label: __( '1 minute', 'rkx-api-studio' ), value: '60' },
	{ label: __( '5 minutes', 'rkx-api-studio' ), value: '300' },
	{ label: __( '15 minutes', 'rkx-api-studio' ), value: '900' },
	{ label: __( '30 minutes', 'rkx-api-studio' ), value: '1800' },
	{ label: __( '1 hour', 'rkx-api-studio' ), value: '3600' },
];

const DEFAULT_SETTINGS: PluginSettings = {
	deleteDataOnUninstall: false,
	cacheEnabled: false,
	cacheTtl: 300,
};

export function CacheSettingsCard( { onNotice }: CacheSettingsCardProps ) {
	const [ settings, setSettings ] =
		useState< PluginSettings >( DEFAULT_SETTINGS );
	const [ isLoading, setIsLoading ] = useState( true );
	const [ isSaving, setIsSaving ] = useState( false );
	const [ isClearing, setIsClearing ] = useState( false );

	useEffect( () => {
		getSettings()
			.then( ( fetched ) => {
				setSettings( fetched );
			} )
			.catch( () => {
				onNotice( {
					type: 'error',
					message: __(
						'Failed to load cache settings.',
						'rkx-api-studio'
					),
				} );
			} )
			.finally( () => {
				setIsLoading( false );
			} );
	}, [] ); // eslint-disable-line react-hooks/exhaustive-deps

	const handleToggleChange = useCallback(
		async ( value: boolean ) => {
			const previous = settings.cacheEnabled;
			setSettings( ( prev ) => ( { ...prev, cacheEnabled: value } ) );
			setIsSaving( true );

			try {
				const updated = await updateSettings( {
					...( await getSettings() ),
					cacheEnabled: value,
				} );
				setSettings( updated );
				onNotice( {
					type: 'success',
					message: value
						? __( 'Response caching enabled.', 'rkx-api-studio' )
						: __( 'Response caching disabled.', 'rkx-api-studio' ),
				} );
			} catch {
				setSettings( ( prev ) => ( {
					...prev,
					cacheEnabled: previous,
				} ) );
				onNotice( {
					type: 'error',
					message: __(
						'Failed to update cache settings. Please try again.',
						'rkx-api-studio'
					),
				} );
			} finally {
				setIsSaving( false );
			}
		},
		[ settings, onNotice ]
	);

	const handleTtlChange = useCallback(
		async ( value: string ) => {
			const newTtl = Number( value );
			const previousTtl = settings.cacheTtl;
			setSettings( ( prev ) => ( { ...prev, cacheTtl: newTtl } ) );
			setIsSaving( true );

			try {
				const updated = await updateSettings( {
					...( await getSettings() ),
					cacheTtl: newTtl,
				} );
				setSettings( updated );
				onNotice( {
					type: 'success',
					message: __( 'Cache TTL updated.', 'rkx-api-studio' ),
				} );
			} catch {
				setSettings( ( prev ) => ( {
					...prev,
					cacheTtl: previousTtl,
				} ) );
				onNotice( {
					type: 'error',
					message: __(
						'Failed to update cache TTL. Please try again.',
						'rkx-api-studio'
					),
				} );
			} finally {
				setIsSaving( false );
			}
		},
		[ settings, onNotice ]
	);

	const handleClearAll = useCallback( async () => {
		setIsClearing( true );

		try {
			const result = await clearAllCache();
			onNotice( {
				type: 'success',
				message:
					result.deleted > 0
						? `${ result.deleted } cached response(s) cleared.`
						: __(
								'No cached responses to clear.',
								'rkx-api-studio'
						  ),
			} );
		} catch {
			onNotice( {
				type: 'error',
				message: __(
					'Failed to clear cache. Please try again.',
					'rkx-api-studio'
				),
			} );
		} finally {
			setIsClearing( false );
		}
	}, [ onNotice ] );

	if ( isLoading ) {
		return (
			<div className="rkx-as-tools-tab__card">
				<h3 className="rkx-as-tools-tab__card-title">
					{ __( 'Response Cache', 'rkx-api-studio' ) }
				</h3>
				<Spinner />
			</div>
		);
	}

	return (
		<div className="rkx-as-tools-tab__card">
			<h3 className="rkx-as-tools-tab__card-title">
				{ __( 'Response Cache', 'rkx-api-studio' ) }
			</h3>
			<p className="rkx-as-tools-tab__card-description">
				{ __(
					'Cache API responses to reduce database queries on repeated requests.',
					'rkx-api-studio'
				) }
			</p>

			<ToggleControl
				label={ __( 'Enable response caching', 'rkx-api-studio' ) }
				help={
					settings.cacheEnabled
						? __(
								'API responses will be cached using WordPress transients.',
								'rkx-api-studio'
						  )
						: __(
								'Every API request will query the database directly.',
								'rkx-api-studio'
						  )
				}
				checked={ settings.cacheEnabled }
				onChange={ handleToggleChange }
				disabled={ isSaving }
				__nextHasNoMarginBottom
			/>

			<SelectControl
				label={ __( 'Cache duration (TTL)', 'rkx-api-studio' ) }
				value={ String( settings.cacheTtl ) }
				options={ TTL_OPTIONS }
				onChange={ handleTtlChange }
				disabled={ isSaving }
				__nextHasNoMarginBottom
			/>

			<Button
				variant="secondary"
				onClick={ handleClearAll }
				disabled={ isClearing }
				aria-disabled={ isClearing }
				isDestructive
			>
				{ isClearing && <Spinner /> }
				{ __( 'Clear All Cache', 'rkx-api-studio' ) }
			</Button>
		</div>
	);
}
