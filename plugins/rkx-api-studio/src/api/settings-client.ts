import apiFetch from '@wordpress/api-fetch';

const SETTINGS_PATH = '/rkx-api-studio/v1/settings';

export interface PluginSettings {
	deleteDataOnUninstall: boolean;
	cacheEnabled: boolean;
	cacheTtl: number;
}

/**
 * Convert a frontend PluginSettings (camelCase) to the PHP backend format (snake_case).
 * @param settings
 */
export function settingsToApi(
	settings: PluginSettings
): Record< string, unknown > {
	return {
		delete_data_on_uninstall: settings.deleteDataOnUninstall,
		cache_enabled: settings.cacheEnabled,
		cache_ttl: settings.cacheTtl,
	};
}

/**
 * Convert a PHP backend response (snake_case) to a frontend PluginSettings (camelCase).
 * @param data
 */
export function settingsFromApi(
	data: Record< string, unknown >
): PluginSettings {
	return {
		deleteDataOnUninstall: Boolean(
			data.delete_data_on_uninstall ?? false
		),
		cacheEnabled: Boolean( data.cache_enabled ?? false ),
		cacheTtl: Number( data.cache_ttl ?? 300 ),
	};
}

export async function getSettings(): Promise< PluginSettings > {
	const data = await apiFetch< Record< string, unknown > >( {
		path: SETTINGS_PATH,
	} );
	return settingsFromApi( data );
}

export async function updateSettings(
	settings: PluginSettings
): Promise< PluginSettings > {
	const data = await apiFetch< Record< string, unknown > >( {
		path: SETTINGS_PATH,
		method: 'POST',
		data: settingsToApi( settings ),
	} );
	return settingsFromApi( data );
}

export async function clearAllCache(): Promise< { deleted: number } > {
	return apiFetch< { deleted: number } >( {
		path: `${ SETTINGS_PATH }/cache/clear-all`,
		method: 'POST',
	} );
}

export async function clearEndpointCache(
	slug: string
): Promise< { deleted: number } > {
	return apiFetch< { deleted: number } >( {
		path: `${ SETTINGS_PATH }/cache/clear/${ slug }`,
		method: 'POST',
	} );
}
