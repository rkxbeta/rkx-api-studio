<?php
/**
 * Security key manager for single API key operations.
 *
 * Provides basic API key generation, validation, and status checking
 * with X-RKX-API-Studio-Key header authentication.
 *
 * @package RKX_API_Studio
 */

defined( 'ABSPATH' ) || exit;

/**
 * Handles the API key lifecycle: single key generation, hashing,
 * storage, validation, and REST route registration.
 */
class RKX_AS_Security_Key_Manager {

	/**
	 * The wp_options key used to store security key data.
	 *
	 * @var string
	 */
	const OPTION_KEY = 'rkx_as_security_keys';

	/**
	 * Number of random bytes used for key generation.
	 *
	 * @var int
	 */
	const KEY_LENGTH = 32;

	/**
	 * Prefix applied to all generated API keys.
	 *
	 * @var string
	 */
	const KEY_PREFIX = 'rkx_as_';

	/**
	 * Generate a new API key.
	 *
	 * @return array{key: string, hash: string} Plaintext key and its HMAC hash.
	 */
	public function generate_key(): array {
		$key  = self::KEY_PREFIX . bin2hex( random_bytes( self::KEY_LENGTH ) );
		$hash = $this->hash_key( $key );

		return array(
			'key'  => $key,
			'hash' => $hash,
		);
	}

	/**
	 * Hash a plaintext key using WordPress HMAC hashing.
	 *
	 * @param string $key The plaintext API key.
	 * @return string The HMAC hash.
	 */
	public function hash_key( string $key ): string {
		return wp_hash( $key );
	}

	/**
	 * Get the current global key status.
	 *
	 * @return array{exists: bool, last_regenerated: string|null}
	 */
	public function get_key_status(): array {
		$data = get_option( self::OPTION_KEY, array() );

		if ( ! is_array( $data ) || empty( $data['global_key']['hash'] ) ) {
			return array(
				'exists'           => false,
				'last_regenerated' => null,
			);
		}

		return array(
			'exists'           => true,
			'last_regenerated' => $data['global_key']['last_regenerated'] ?? null,
		);
	}

	/**
	 * Validate a plaintext key against the stored global key hash.
	 *
	 * @param string $key The plaintext key from the request header.
	 * @return bool True if the key matches, false otherwise.
	 */
	public function validate_key( string $key ): bool {
		$data = get_option( self::OPTION_KEY, array() );

		if ( ! is_array( $data ) ) {
			return false;
		}

		$key = substr( $key, 0, 256 );
		$key = sanitize_text_field( $key );

		$incoming_hash = wp_hash( $key );

		if ( ! empty( $data['global_key']['hash'] ) ) {
			return hash_equals( $data['global_key']['hash'], $incoming_hash );
		}

		return false;
	}

	/**
	 * Regenerate the global API key.
	 *
	 * @return array{key: string, hash: string} New plaintext key and its hash.
	 */
	public function regenerate_key(): array {
		$generated = $this->generate_key();

		$data = get_option( self::OPTION_KEY, array() );

		if ( ! is_array( $data ) ) {
			$data = array();
		}

		$data['global_key'] = array(
			'hash'             => $generated['hash'],
			'last_regenerated' => gmdate( 'c' ),
		);

		update_option( self::OPTION_KEY, $data );

		return $generated;
	}

	/**
	 * Permission callback for key management endpoints.
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
	 * Register REST API routes for security key management.
	 *
	 * @return void
	 */
	public function register_routes(): void {
		register_rest_route(
			RKX_AS_REST_NAMESPACE,
			'/security/status',
			array(
				'methods'             => WP_REST_Server::READABLE,
				'callback'            => array( $this, 'get_status' ),
				'permission_callback' => array( $this, 'check_permissions' ),
			)
		);

		register_rest_route(
			RKX_AS_REST_NAMESPACE,
			'/security/generate',
			array(
				'methods'             => WP_REST_Server::CREATABLE,
				'callback'            => array( $this, 'handle_generate' ),
				'permission_callback' => array( $this, 'check_permissions' ),
			)
		);

		register_rest_route(
			RKX_AS_REST_NAMESPACE,
			'/security/regenerate',
			array(
				'methods'             => WP_REST_Server::CREATABLE,
				'callback'            => array( $this, 'handle_regenerate' ),
				'permission_callback' => array( $this, 'check_permissions' ),
			)
		);
	}

	/**
	 * GET /security/status
	 *
	 * @param WP_REST_Request $request The incoming request.
	 * @return WP_REST_Response
	 */
	public function get_status( WP_REST_Request $request ): WP_REST_Response {
		return new WP_REST_Response( $this->get_key_status(), 200 );
	}

	/**
	 * POST /security/generate
	 *
	 * @param WP_REST_Request $request The incoming request.
	 * @return WP_REST_Response
	 */
	public function handle_generate( WP_REST_Request $request ): WP_REST_Response {
		$generated = $this->regenerate_key();

		return new WP_REST_Response(
			array(
				'key'    => $generated['key'],
				'status' => $this->get_key_status(),
			),
			200
		);
	}

	/**
	 * POST /security/regenerate
	 *
	 * @param WP_REST_Request $request The incoming request.
	 * @return WP_REST_Response
	 */
	public function handle_regenerate( WP_REST_Request $request ): WP_REST_Response {
		$generated = $this->regenerate_key();

		return new WP_REST_Response(
			array(
				'key'    => $generated['key'],
				'status' => $this->get_key_status(),
			),
			200
		);
	}

	/**
	 * Consistent authentication failure for protected endpoints.
	 *
	 * @return WP_Error
	 */
	public static function unauthorized_error(): WP_Error {
		return new WP_Error(
			'rkx_as_unauthorized',
			__( 'Invalid or missing API key', 'rkx-api-studio' ),
			array( 'status' => 401 )
		);
	}

	/**
	 * Validate the X-RKX-API-Studio-Key header against the stored global key.
	 *
	 * @param WP_REST_Request $request The incoming REST request.
	 * @return true|WP_Error True if authenticated, WP_Error otherwise.
	 */
	public static function check_api_key( WP_REST_Request $request ) {
		// Bearer credentials are not validated here and never fall back to a different key.
		if ( stripos( (string) $request->get_header( 'authorization' ), 'Bearer ' ) === 0 ) {
			return self::unauthorized_error();
		}
		$header = rkx_as_request_key( $request );

		if ( empty( $header ) ) {
			return self::unauthorized_error();
		}

		$key = substr( $header, 0, 256 );

		$manager = new self();
		$valid   = $manager->validate_key( $key );

		if ( ! $valid ) {
			return self::unauthorized_error();
		}

		return true;
	}
}
