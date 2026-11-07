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
/**
 * Filter: public route path shown for an endpoint, relative to its namespace.
 * Defaults to the endpoint slug. Extensions that register a different path
 * (for example a single-item route) return it here.
 *
 * @param path   Default path (the endpoint slug).
 * @param config Endpoint configuration.
 */
export const RKX_AS_HOOK_ROUTE_PATH = 'rkxAs.endpoint.routePath';
/**
 * Filter: single-item route of an endpoint, or null for a collection.
 * Extensions that serve one record per request return the route parameter
 * name and the path pattern (relative to the namespace) containing `{param}`.
 * The builder then hides pagination and ordering controls and previews one
 * object.
 *
 * @param route  Default null.
 * @param config Endpoint configuration.
 */
export const RKX_AS_HOOK_SINGLE_ITEM = 'rkxAs.endpoint.singleItem';

/** Single-item route description returned through RKX_AS_HOOK_SINGLE_ITEM. */
export interface SingleItemRoute {
	/** Route parameter name, for example `slug` or `id`. */
	param: string;
	/** Path pattern relative to the namespace, for example `posts/{slug}`. */
	path: string;
}

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

/**
 * Single-item route for an endpoint, or null for a collection endpoint.
 * @param config Endpoint configuration.
 */
export function getSingleItemRoute( config: unknown ): SingleItemRoute | null {
	const route = applyFilters( RKX_AS_HOOK_SINGLE_ITEM, null, config ) as
		| Partial< SingleItemRoute >
		| null
		| undefined;
	return route &&
		typeof route.param === 'string' &&
		route.param !== '' &&
		typeof route.path === 'string' &&
		route.path.includes( `{${ route.param }}` )
		? { param: route.param, path: route.path }
		: null;
}
