<?php
/**
 * Shared RKX API Studio runtime helpers.
 *
 * @package RKX_API_Studio
 */

defined( 'ABSPATH' ) || exit;

/**
 * Read the RKX authentication header with a bounded credential length.
 *
 * @param WP_REST_Request $request Incoming request.
 * @return string|null
 */
function rkx_as_request_key( WP_REST_Request $request ): ?string {
	$key = $request->get_header( 'X-RKX-API-Studio-Key' );
	return null === $key ? null : substr( $key, 0, 256 );
}

/**
 * HTTP methods that have a registered request handler.
 *
 * RKX API Studio itself serves read-only GET endpoints. A separately
 * installed extension that implements additional methods may declare them.
 *
 * @return string[]
 */
function rkx_as_supported_methods(): array {
	$methods = apply_filters( 'rkx_as_supported_methods', array( 'GET' ) );
	$methods = is_array( $methods ) ? array_map( 'strtoupper', array_filter( $methods, 'is_string' ) ) : array();
	return array_values( array_unique( array_merge( array( 'GET' ), $methods ) ) );
}

/**
 * Neutral error for stored configurations that this site cannot execute.
 *
 * @return WP_Error
 */
function rkx_as_unsupported_configuration_error(): WP_Error {
	return new WP_Error(
		'rkx_as_unsupported_configuration',
		__( 'This endpoint uses a field or formatter type that is not available on this site.', 'rkx-api-studio' ),
		array( 'status' => 501 )
	);
}
