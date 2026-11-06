import { useState, useEffect, useCallback } from '@wordpress/element';
import { Button, Notice, Spinner } from '@wordpress/components';
import { __ } from '@wordpress/i18n';
import { applyFilters } from '@wordpress/hooks';
import { GeneralTab } from './GeneralTab';
import { ToolsTab } from './ToolsTab';
import { SecurityTab } from './SecurityTab';
import { getSettings, updateSettings } from '../../api/settings-client';
import type { PluginSettings } from '../../api/settings-client';
import { getEndpoints } from '../../api/client';
import type { EndpointConfig } from '../../types';
import { RKX_AS_HOOK_SETTINGS_TABS } from '../../hooks/rkx-as-hooks';

declare const rkxApiStudio:
	| {
			docsUrl?: string;
			proUrl?: string;
	  }
	| undefined;

/** A settings tab contributed by an installed extension. */
export interface ExtensionSettingsTab {
	name: string;
	title: string;
	render: ( props: {
		endpoints: EndpointConfig[];
		onNotice: ( notice: {
			type: 'success' | 'error';
			message: string;
		} ) => void;
	} ) => React.ReactNode;
}

type ActiveTab = string;

const DEFAULT_SETTINGS: PluginSettings = {
	deleteDataOnUninstall: false,
	cacheEnabled: false,
	cacheTtl: 300,
};

function getExtensionTabs(): ExtensionSettingsTab[] {
	const tabs = applyFilters( RKX_AS_HOOK_SETTINGS_TABS, [] );
	return Array.isArray( tabs )
		? ( tabs as ExtensionSettingsTab[] ).filter(
				( tab ) =>
					tab &&
					typeof tab.name === 'string' &&
					! [ 'general', 'tools', 'security' ].includes( tab.name ) &&
					typeof tab.render === 'function'
		  )
		: [];
}

export function SettingsApp() {
	const [ activeTab, setActiveTab ] = useState< ActiveTab >( 'general' );
	const [ settings, setSettings ] =
		useState< PluginSettings >( DEFAULT_SETTINGS );
	const [ savedSettings, setSavedSettings ] =
		useState< PluginSettings >( DEFAULT_SETTINGS );
	const [ isLoading, setIsLoading ] = useState( true );
	const [ isSaving, setIsSaving ] = useState( false );
	const [ notice, setNotice ] = useState< {
		type: 'success' | 'error';
		message: string;
	} | null >( null );
	const [ endpoints, setEndpoints ] = useState< EndpointConfig[] >( [] );

	const isDirty =
		settings.deleteDataOnUninstall !==
			savedSettings.deleteDataOnUninstall ||
		settings.cacheEnabled !== savedSettings.cacheEnabled ||
		settings.cacheTtl !== savedSettings.cacheTtl;

	const extensionTabs = getExtensionTabs();
	const activeExtensionTab = extensionTabs.find(
		( tab ) => tab.name === activeTab
	);

	useEffect( () => {
		getSettings()
			.then( ( fetched ) => {
				setSettings( fetched );
				setSavedSettings( fetched );
			} )
			.catch( () => {
				setNotice( {
					type: 'error',
					message: __(
						'Failed to load settings. Using default values.',
						'rkx-api-studio'
					),
				} );
				setSettings( DEFAULT_SETTINGS );
				setSavedSettings( DEFAULT_SETTINGS );
			} )
			.finally( () => {
				setIsLoading( false );
			} );

		getEndpoints()
			.then( ( fetched ) => {
				setEndpoints( fetched );
			} )
			.catch( () => {
				// Silently fall back — endpoints list used for deletion safety only.
			} );
	}, [] );

	const handleToggleChange = useCallback( ( value: boolean ) => {
		setSettings( ( prev ) => ( {
			...prev,
			deleteDataOnUninstall: value,
		} ) );
	}, [] );

	const handleSave = useCallback( async () => {
		setNotice( null );
		setIsSaving( true );

		try {
			const updated = await updateSettings( {
				...( await getSettings() ),
				deleteDataOnUninstall: settings.deleteDataOnUninstall,
			} );
			setSettings( updated );
			setSavedSettings( updated );
			setNotice( {
				type: 'success',
				message: __( 'Settings saved successfully.', 'rkx-api-studio' ),
			} );
		} catch ( error: unknown ) {
			const err = error as { message?: string };
			setNotice( {
				type: 'error',
				message:
					err?.message ||
					__(
						'Failed to save settings. Please try again.',
						'rkx-api-studio'
					),
			} );
		} finally {
			setIsSaving( false );
		}
	}, [ settings ] );

	const handleImported = useCallback( async () => {
		try {
			const [ fetchedSettings, fetchedEndpoints ] = await Promise.all( [
				getSettings(),
				getEndpoints(),
			] );
			setSettings( fetchedSettings );
			setSavedSettings( fetchedSettings );
			setEndpoints( fetchedEndpoints );
		} catch {
			setNotice( {
				type: 'error',
				message: __(
					'Import finished, but settings could not be refreshed. Reload this page before editing settings.',
					'rkx-api-studio'
				),
			} );
		}
	}, [] );

	const navConfig =
		typeof rkxApiStudio !== 'undefined' ? rkxApiStudio : undefined;
	const docsUrl = navConfig?.docsUrl || '';
	const proUrl = navConfig?.proUrl || '';
	const hasHeaderNav = Boolean( docsUrl || proUrl );

	return (
		<div className="rkx-as-settings-app">
			<div className="rkx-as-header-title-row rkx-as-header-title-row--with-nav">
				<h1>{ __( 'Settings', 'rkx-api-studio' ) }</h1>
				{ hasHeaderNav && (
					<nav
						className="rkx-as-admin-nav"
						aria-label={ __( 'Plugin links', 'rkx-api-studio' ) }
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
			</div>
			<p className="rkx-as-page-description">
				{ __(
					'Configure global options for RKX API Studio.',
					'rkx-api-studio'
				) }
			</p>

			{ notice && (
				<Notice
					status={ notice.type }
					isDismissible
					onRemove={ () => setNotice( null ) }
				>
					{ notice.message }
				</Notice>
			) }

			{ isLoading ? (
				<Spinner />
			) : (
				<>
					<div className="rkx-as-settings-app__tabs" role="tablist">
						<button
							className={ `rkx-as-settings-app__tab${
								activeTab === 'general'
									? ' rkx-as-settings-app__tab--active'
									: ''
							}` }
							aria-selected={ activeTab === 'general' }
							role="tab"
							onClick={ () => setActiveTab( 'general' ) }
						>
							{ __( 'General', 'rkx-api-studio' ) }
						</button>
						<button
							className={ `rkx-as-settings-app__tab${
								activeTab === 'tools'
									? ' rkx-as-settings-app__tab--active'
									: ''
							}` }
							aria-selected={ activeTab === 'tools' }
							role="tab"
							onClick={ () => setActiveTab( 'tools' ) }
						>
							{ __( 'Tools', 'rkx-api-studio' ) }
						</button>
						<button
							className={ `rkx-as-settings-app__tab${
								activeTab === 'security'
									? ' rkx-as-settings-app__tab--active'
									: ''
							}` }
							aria-selected={ activeTab === 'security' }
							role="tab"
							onClick={ () => setActiveTab( 'security' ) }
						>
							{ __( 'Security', 'rkx-api-studio' ) }
						</button>
						{ extensionTabs.map( ( tab ) => (
							<button
								key={ tab.name }
								className={ `rkx-as-settings-app__tab${
									activeTab === tab.name
										? ' rkx-as-settings-app__tab--active'
										: ''
								}` }
								aria-selected={ activeTab === tab.name }
								role="tab"
								onClick={ () => setActiveTab( tab.name ) }
							>
								{ tab.title }
							</button>
						) ) }
					</div>

					<div
						className="rkx-as-settings-app__tab-content"
						role="tabpanel"
					>
						{ /* Tab content rendering */ }
						{ activeTab === 'general' && (
							<GeneralTab
								deleteDataOnUninstall={
									settings.deleteDataOnUninstall
								}
								onChange={ handleToggleChange }
							/>
						) }
						{ activeTab === 'tools' && (
							<ToolsTab onImported={ handleImported } />
						) }
						{ activeTab === 'security' && <SecurityTab /> }
						{ activeExtensionTab &&
							activeExtensionTab.render( {
								endpoints,
								onNotice: setNotice,
							} ) }
					</div>

					{ activeTab === 'general' && (
						<div className="rkx-as-settings-app__actions">
							<Button
								variant="primary"
								onClick={ handleSave }
								isBusy={ isSaving }
								disabled={ isSaving || ! isDirty }
							>
								{ isSaving
									? __( 'Saving…', 'rkx-api-studio' )
									: __( 'Save Settings', 'rkx-api-studio' ) }
							</Button>
						</div>
					) }
				</>
			) }
		</div>
	);
}
