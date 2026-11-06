import type { EndpointConfig } from '../types';
import { toApiPayload } from '../api/client';
import { getSettings } from '../api/settings-client';
import type { PluginSettings } from '../api/settings-client';

/**
 * Export only portable settings; credentials and lifecycle choices stay local.
 * @param endpoints Selected endpoints.
 * @param settings  Saved plugin settings.
 */
export function toExportDocument(
	endpoints: EndpointConfig[],
	settings: PluginSettings
) {
	return {
		version: 1,
		settings: {
			cache_enabled: settings.cacheEnabled,
			cache_ttl: settings.cacheTtl,
		},
		endpoints: toExportPayload( endpoints ),
	};
}

/**
 * Convert an array of frontend EndpointConfig objects to the export format
 * (snake_case, matching backend representation).
 *
 * Uses the existing toApiPayload helper for field conversion, then adds
 * id, created_at, and updated_at which toApiPayload omits.
 * @param endpoints
 */
export function toExportPayload(
	endpoints: EndpointConfig[]
): Record< string, unknown >[] {
	return endpoints.map( ( endpoint ) => {
		const payload = toApiPayload( endpoint );
		return {
			id: endpoint.id,
			...payload,
			created_at: endpoint.createdAt ?? '',
			updated_at: endpoint.updatedAt ?? '',
		};
	} );
}

/**
 * Generate a timestamp string for filenames: YYYY-MM-DD-HHmmss
 */
function getTimestamp(): string {
	const now = new Date();
	const year = now.getFullYear();
	const month = String( now.getMonth() + 1 ).padStart( 2, '0' );
	const day = String( now.getDate() ).padStart( 2, '0' );
	const hours = String( now.getHours() ).padStart( 2, '0' );
	const minutes = String( now.getMinutes() ).padStart( 2, '0' );
	const seconds = String( now.getSeconds() ).padStart( 2, '0' );
	return `${ year }-${ month }-${ day }-${ hours }${ minutes }${ seconds }`;
}

/**
 * Generate the export filename.
 *
 * - Single endpoint: rkx-api-studio-{slug}-{YYYY-MM-DD}-{HHmmss}.json
 * - Multiple endpoints: rkx-api-studio-endpoints-{YYYY-MM-DD}-{HHmmss}.json
 * @param endpoints
 */
export function generateExportFilename( endpoints?: EndpointConfig[] ): string {
	const timestamp = getTimestamp();
	if ( endpoints && endpoints.length === 1 ) {
		return `rkx-api-studio-${ endpoints[ 0 ].slug }-${ timestamp }.json`;
	}
	return `rkx-api-studio-endpoints-${ timestamp }.json`;
}

/**
 * Download endpoints and saved global cache settings as a JSON document.
 *
 * Converts endpoints to snake_case export format, creates a JSON Blob,
 * generates an object URL, triggers a download via a temporary anchor
 * element, and revokes the URL.
 * @param endpoints
 */
export async function downloadExportFile(
	endpoints: EndpointConfig[]
): Promise< void > {
	const exportData = toExportDocument( endpoints, await getSettings() );
	const json = JSON.stringify( exportData, null, 2 );
	const blob = new Blob( [ json ], { type: 'application/json' } );
	const url = URL.createObjectURL( blob );

	const anchor = document.createElement( 'a' );
	anchor.href = url;
	anchor.download = generateExportFilename( endpoints );
	document.body.appendChild( anchor );
	anchor.click();
	document.body.removeChild( anchor );

	URL.revokeObjectURL( url );
}
