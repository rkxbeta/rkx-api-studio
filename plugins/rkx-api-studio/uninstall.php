<?php
/**
 * Native WordPress uninstall. Retention is the default.
 *
 * @package RKX_API_Studio
 */

defined( 'WP_UNINSTALL_PLUGIN' ) || exit;

// Shared data is still needed while the sibling add-on is installed.
if ( is_multisite() || is_file( dirname( __DIR__ ) . '/rkx-api-studio-pro/rkx-api-studio-pro.php' ) ) {
	return;
}
$rkx_as_settings = get_option( 'rkx_as_settings', array() );
if ( ! is_array( $rkx_as_settings ) || true !== ( $rkx_as_settings['delete_data_on_uninstall'] ?? false ) ) {
	return;
}
$rkx_as_index = get_option( 'rkx_as_cache_index', array() );
if ( is_array( $rkx_as_index ) ) {
	foreach ( $rkx_as_index as $rkx_as_keys ) {
		foreach ( (array) $rkx_as_keys as $rkx_as_key ) {
			if ( is_string( $rkx_as_key ) && str_starts_with( $rkx_as_key, 'rkx_as_api_' ) ) {
				delete_transient( $rkx_as_key );
			}
		}
	}
}
foreach ( array(
	'rkx_as_endpoint_configs',
	'rkx_as_settings',
	'rkx_as_security_keys',
	'rkx_as_cache_index',
) as $rkx_as_option ) {
	delete_option( $rkx_as_option );
}
