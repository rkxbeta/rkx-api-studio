<?php
/**
 * REST controller for plugin settings management.
 *
 * @package RKX_API_Studio
 */

defined( 'ABSPATH' ) || exit;

/**
 * Handles REST API routes for reading and updating
 * plugin settings stored in wp_options.
 */
class RKX_AS_Settings_Controller {

	/**
	 * The wp_options key used to store plugin settings.
	 *
	 * @var string
	 */
	const OPTION_KEY = 'rkx_as_settings';

	/**
	 * Default values for all plugin settings.
	 *
	 * @var array
	 */
	const DEFAULTS = array(
		'delete_data_on_uninstall' => false,
		'cache_enabled'            => false,
		'cache_ttl'                => 300,
	);

	/**
	 * Register REST API routes for settings management.
	 *
	 * @return void
	 */
	public function register_routes(): void {
		register_rest_route(
			RKX_AS_REST_NAMESPACE,
			'/settings',
			array(
				array(
					'methods'             => WP_REST_Server::READABLE,
					'callback'            => array( $this, 'get_settings' ),
					'permission_callback' => array( $this, 'check_permissions' ),
				),
				array(
					'methods'             => WP_REST_Server::CREATABLE,
					'callback'            => array( $this, 'update_settings' ),
					'permission_callback' => array( $this, 'check_permissions' ),
				),
			)
		);

		register_rest_route(
			RKX_AS_REST_NAMESPACE,
			'/settings/cache/clear-all',
			array(
				'methods'             => WP_REST_Server::CREATABLE,
				'callback'            => array( $this, 'clear_all_cache' ),
				'permission_callback' => array( $this, 'check_permissions' ),
			)
		);

		register_rest_route(
			RKX_AS_REST_NAMESPACE,
			'/settings/cache/clear/(?P<endpoint_slug>[a-zA-Z0-9_-]+)',
			array(
				'methods'             => WP_REST_Server::CREATABLE,
				'callback'            => array( $this, 'clear_endpoint_cache' ),
				'permission_callback' => array( $this, 'check_permissions' ),
				'args'                => array(
					'endpoint_slug' => array(
						'required'          => true,
						'validate_callback' => function ( $param ) {
							return is_string( $param ) && ! empty( $param );
						},
					),
				),
			)
		);
	}

	/**
	 * Permission callback: verify the user has manage_options capability.
	 *
	 * On mutating requests (POST), also verifies the X-WP-Nonce header.
	 *
	 * @param WP_REST_Request $request The incoming request.
	 * @return bool|WP_Error True if allowed, WP_Error otherwise.
	 */
	public function check_permissions( WP_REST_Request $request ) {
		if ( ! current_user_can( 'manage_options' ) ) {
			return new WP_Error(
				'rest_forbidden',
				__( 'You do not have permission to access this page.', 'rkx-api-studio' ),
				array( 'status' => rest_authorization_required_code() )
			);
		}

		// Verify nonce on mutating requests (POST).
		$method = $request->get_method();
		if ( 'GET' !== $method ) {
			$nonce = $request->get_header( 'X-WP-Nonce' );
			if ( ! $nonce || ! wp_verify_nonce( $nonce, 'wp_rest' ) ) {
				return new WP_Error(
					'rest_forbidden',
					__( 'You do not have permission to perform this action.', 'rkx-api-studio' ),
					array( 'status' => 403 )
				);
			}
		}

		return true;
	}

	/**
	 * GET /settings — Return current plugin settings.
	 *
	 * @param WP_REST_Request $request The incoming request.
	 * @return WP_REST_Response
	 */
	public function get_settings( WP_REST_Request $request ): WP_REST_Response {
		$settings = self::get_stored_settings();

		return new WP_REST_Response( $settings, 200 );
	}

	/**
	 * POST /settings — Update plugin settings.
	 *
	 * Sanitizes the input, persists via update_option, and returns
	 * the updated settings.
	 *
	 * @param WP_REST_Request $request The incoming request.
	 * @return WP_REST_Response|WP_Error
	 */
	public function update_settings( WP_REST_Request $request ) {
		$body  = $request->get_json_params();
		$input = is_array( $body ) ? $body : array();

		$settings = self::sanitize_settings( $input );

		$updated = update_option( self::OPTION_KEY, $settings );
		if ( false === $updated ) {
			// update_option returns false when the value is unchanged or on failure.
			// Re-read to confirm the current state matches what was requested.
			$current = self::get_stored_settings();
			if ( $current === $settings ) {
				return new WP_REST_Response( $current, 200 );
			}

			return new WP_Error(
				'settings_update_failed',
				__( 'Failed to save settings. Please try again.', 'rkx-api-studio' ),
				array( 'status' => 500 )
			);
		}

		return new WP_REST_Response( $settings, 200 );
	}

	/**
	 * POST /settings/cache/clear-all — Clear all cached transients.
	 *
	 * Instantiates RKX_AS_Cache_Manager, calls clear_all(), and returns
	 * a 200 response with the count of deleted transients.
	 *
	 * @param WP_REST_Request $request The incoming request.
	 * @return WP_REST_Response
	 */
	public function clear_all_cache( WP_REST_Request $request ): WP_REST_Response {
		$cache_manager = new RKX_AS_Cache_Manager();
		$deleted       = $cache_manager->clear_all();

		return new WP_REST_Response( array( 'deleted' => $deleted ), 200 );
	}

	/**
	 * POST /settings/cache/clear/{endpoint_slug} — Clear cache for a specific endpoint.
	 *
	 * Instantiates RKX_AS_Cache_Manager, calls clear_endpoint() with the
	 * provided slug, and returns a 200 response with the count of deleted transients.
	 *
	 * @param WP_REST_Request $request The incoming request.
	 * @return WP_REST_Response
	 */
	public function clear_endpoint_cache( WP_REST_Request $request ): WP_REST_Response {
		$slug          = $request->get_param( 'endpoint_slug' );
		$cache_manager = new RKX_AS_Cache_Manager();
		$deleted       = $cache_manager->clear_endpoint( $slug );

		return new WP_REST_Response( array( 'deleted' => $deleted ), 200 );
	}

	/**
	 * Read settings from wp_options and merge with defaults.
	 *
	 * @return array The current settings with defaults applied.
	 */
	public static function get_stored_settings(): array {
		$stored = get_option( self::OPTION_KEY, array() );

		if ( ! is_array( $stored ) ) {
			$stored = array();
		}

		return array_intersect_key( array_merge( self::DEFAULTS, $stored ), self::DEFAULTS );
	}

	/**
	 * Allowed TTL values in seconds.
	 *
	 * @var int[]
	 */
	const ALLOWED_TTL_VALUES = array( 60, 300, 900, 1800, 3600 );

	/**
	 * Sanitize settings input.
	 *
	 * Casts delete_data_on_uninstall and cache_enabled to boolean,
	 * clamps cache_ttl to allowed values, and strips unknown keys.
	 *
	 * @param array $input The raw input to sanitize.
	 * @return array The sanitized settings containing only known keys.
	 */
	public static function sanitize_settings( array $input ): array {
		$sanitized = array();

		$sanitized['delete_data_on_uninstall'] = ! empty( $input['delete_data_on_uninstall'] );

		$sanitized['cache_enabled'] = ! empty( $input['cache_enabled'] );

		$cache_ttl = isset( $input['cache_ttl'] ) ? (int) $input['cache_ttl'] : self::DEFAULTS['cache_ttl'];
		if ( ! in_array( $cache_ttl, self::ALLOWED_TTL_VALUES, true ) ) {
			$cache_ttl = self::DEFAULTS['cache_ttl'];
		}
		$sanitized['cache_ttl'] = $cache_ttl;

		return $sanitized;
	}
}
