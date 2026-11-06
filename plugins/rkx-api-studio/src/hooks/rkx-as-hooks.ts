/**
 * RKX API Studio — generic UI extension points.
 *
 * Each constant names a `wp.hooks` filter. RKX API Studio renders complete,
 * working defaults; a separately installed extension may add its own UI
 * through these filters. No default renders disabled or locked controls.
 */

/** Security settings content. Default: the single API key manager. */
export const RKX_AS_HOOK_SECURITY_CONTENT = 'rkxAs.security.content';

/** Additional endpoint settings fields. Default: nothing. */
export const RKX_AS_HOOK_ENDPOINT_SETTINGS_FIELDS =
	'rkxAs.endpointSettings.fields';

/** Additional field-panel source sections. Default: nothing. */
export const RKX_AS_HOOK_FIELD_PANEL_SECTIONS = 'rkxAs.fieldPanel.sections';

/** HTTP methods with an installed handler. Default: `['GET']`. */
export const RKX_AS_HOOK_METHODS = 'rkxAs.endpoint.methods';

/** Additional formatter sections in the field formatter popover. Default: nothing. */
export const RKX_AS_HOOK_FORMATTER_SECTIONS = 'rkxAs.formatter.sections';

/** Method-specific builder panel. Default: nothing. */
export const RKX_AS_HOOK_METHOD_PANEL = 'rkxAs.endpointBuilder.methodPanel';

/** Additional settings tabs: `{ name, title, render }[]`. Default: `[]`. */
export const RKX_AS_HOOK_SETTINGS_TABS = 'rkxAs.settings.tabs';

/** Extension field metadata for the builder. Default: `[]`. */
export const RKX_AS_HOOK_EXTENSION_FIELD_GROUPS =
	'rkxAs.endpointBuilder.extensionData';

/** Additional endpoint protection fields. Default: nothing. */
export const RKX_AS_HOOK_PROTECTION_FIELDS = 'rkxAs.protection.fields';

/** Request payload sent when saving an endpoint. */
export const RKX_AS_HOOK_API_PAYLOAD = 'rkxAs.api.payload';

/** Endpoint configuration parsed from a REST response. */
export const RKX_AS_HOOK_API_CONFIG = 'rkxAs.api.config';

/** REST namespace shown for an endpoint. Default: `rkx-api-studio/v1`. */
export const RKX_AS_HOOK_ROUTE_NAMESPACE = 'rkxAs.endpoint.routeNamespace';

/** Endpoint entry parsed from an import file. */
export const RKX_AS_HOOK_IMPORT_ENDPOINT = 'rkxAs.import.endpoint';

/** The fixed REST namespace used by RKX API Studio endpoints. */
export const RKX_AS_REST_NAMESPACE = 'rkx-api-studio/v1';

// UI extension points return renderable React content.
import { applyFilters } from '@wordpress/hooks';
import type { ReactNode } from 'react';
export function applyComponentFilters(
	hook: string,
	value: ReactNode,
	...args: unknown[]
): ReactNode {
	return applyFilters( hook, value, ...args ) as ReactNode;
}
