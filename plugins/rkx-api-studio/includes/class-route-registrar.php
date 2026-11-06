<?php
/**
 * Dynamic REST route registrar for public API endpoints.
 *
 * Reads saved endpoint configurations and registers GET-only
 * REST routes under the fixed rkx-api-studio/v1 namespace.
 *
 * @package RKX_API_Studio
 */

defined( 'ABSPATH' ) || exit;

/**
 * Registers public REST routes on rest_api_init based on saved
 * endpoint configurations stored in wp_options.
 */
class RKX_AS_Route_Registrar {

	/**
	 * Allowlisted WP_Query parameters that may be forwarded
	 * when WP Defaults Mode is enabled on a post-type endpoint.
	 *
	 * @var string[]
	 */
	private const WP_QUERY_ALLOWED_PARAMS = array(
		'status',
		'search',
		'author',
		'author_exclude',
		'categories',
		'categories_exclude',
		'tags',
		'tags_exclude',
		'slug',
		'before',
		'after',
		'sticky',
		'include',
		'exclude',
	);

	/**
	 * Allowlisted WP_Term_Query parameters that may be forwarded
	 * when WP Defaults Mode is enabled on a taxonomy endpoint.
	 *
	 * @var string[]
	 */
	private const WP_TERM_QUERY_ALLOWED_PARAMS = array(
		'search',
		'slug',
		'hide_empty',
		'parent',
		'exclude',
		'include',
		'post',
		'orderby',
		'order',
	);

	/**
	 * Register a read route under the fixed RKX namespace for each saved config.
	 *
	 * @return void
	 */
	public function register(): void {
		$configs = get_option( RKX_AS_OPTION_KEY, array() );

		if ( empty( $configs ) || ! is_array( $configs ) ) {
			return;
		}

		foreach ( $configs as $config ) {
			if ( ! is_array( $config ) || empty( $config['slug'] ) ) {
				continue;
			}

			// RKX API Studio implements read-only GET endpoints only.
			if ( 'GET' !== strtoupper( $config['method'] ?? 'GET' ) ) {
				continue;
			}

			/**
			 * Whether the endpoint is registered under the default RKX namespace.
			 *
			 * An extension that registers the endpoint elsewhere through
			 * register_endpoint_route() may return false. Authentication is
			 * always decided by the endpoint configuration, never by this filter.
			 *
			 * @param bool  $register Whether to register the default route.
			 * @param array $config   Endpoint configuration.
			 */
			if ( ! apply_filters( 'rkx_as_register_default_route', true, $config ) ) {
				continue;
			}

			$this->register_endpoint_route( RKX_AS_REST_NAMESPACE, $config );
		}
	}

	/**
	 * Register one saved GET configuration as a REST route.
	 *
	 * @param string $rest_namespace REST namespace to register under.
	 * @param array  $config         Endpoint configuration.
	 * @return bool Whether a route was registered.
	 */
	public function register_endpoint_route( string $rest_namespace, array $config ): bool {
		if ( empty( $config['slug'] ) || 'GET' !== strtoupper( $config['method'] ?? 'GET' ) ) {
			return false;
		}

		$route_config    = $config;
		$use_wp_defaults = ! empty( $config['use_wordpress_defaults'] );

		// Build argument definitions. When WP Defaults Mode is enabled,
		// register sanitize_callback only (no validate_callback) for the
		// query parameters so that native WordPress values pass through.
		// In Custom mode, params are registered for schema purposes but
		// handle_request ignores URL values and uses stored config.
		$args = array(
			'page' => array(
				'default'           => 1,
				'sanitize_callback' => 'absint',
				'validate_callback' => function ( $value ) {
					return is_numeric( $value ) && (int) $value >= 1;
				},
			),
		);

		if ( $use_wp_defaults ) {
			$args['per_page'] = array(
				'default'           => $config['per_page'] ?? 10,
				'sanitize_callback' => 'absint',
			);
			$args['order']    = array(
				'default'           => $config['order'] ?? 'DESC',
				'sanitize_callback' => 'sanitize_text_field',
			);
			$args['orderby']  = array(
				'default'           => $config['orderby'] ?? 'date',
				'sanitize_callback' => 'sanitize_text_field',
			);
			$args['offset']   = array(
				'default'           => $config['offset'] ?? 0,
				'sanitize_callback' => 'absint',
			);

			// Register each taxonomy slug from taxonomy_filters as an optional
			// query parameter accepting comma-separated positive integer term IDs.
			$taxonomy_filters = $config['taxonomy_filters'] ?? array();
			foreach ( $taxonomy_filters as $tax_slug => $term_ids ) {
				$args[ $tax_slug ] = array(
					'required'          => false,
					'sanitize_callback' => 'sanitize_text_field',
					'validate_callback' => array( $this, 'validate_taxonomy_query_param' ),
				);
			}
		} else {
			$args['per_page'] = array(
				'default'           => $config['per_page'] ?? 10,
				'sanitize_callback' => 'absint',
				'validate_callback' => function ( $value ) {
					return is_numeric( $value ) && (int) $value >= 1 && (int) $value <= 100;
				},
			);
			$args['order']    = array(
				'default'           => $config['order'] ?? 'DESC',
				'sanitize_callback' => 'sanitize_text_field',
				'validate_callback' => function ( $value ) {
					return in_array( strtoupper( $value ), array( 'ASC', 'DESC' ), true );
				},
			);
			$args['orderby']  = array(
				'default'           => $config['orderby'] ?? 'date',
				'sanitize_callback' => 'sanitize_text_field',
				'validate_callback' => function ( $value ) use ( $route_config ) {
					$source  = $route_config['data_source'] ?? '';
					$allowed = $this->is_post_type_source( $source )
						? array( 'date', 'title', 'modified', 'id', 'author', 'slug' )
						: array( 'name', 'slug', 'count', 'id', 'description' );
					return in_array( $value, $allowed, true );
				},
			);
			$args['offset']   = array(
				'default'           => $config['offset'] ?? 0,
				'sanitize_callback' => 'absint',
				'validate_callback' => function ( $value ) {
					return is_numeric( $value ) && (int) $value >= 0;
				},
			);
		}

		return false !== register_rest_route(
			$rest_namespace,
			'/' . $config['slug'],
			array(
				'methods'             => WP_REST_Server::READABLE,
				'callback'            => function ( WP_REST_Request $request ) use ( $route_config ) {
					return $this->handle_request( $request, $route_config );
				},
				'permission_callback' => self::permission_callback( $config ),
				'args'                => $args,
			)
		);
	}

	/**
	 * Permission callback for a saved endpoint.
	 *
	 * Unprotected endpoints are public. Protected endpoints always require a
	 * valid API key; the built-in check validates the X-RKX-API-Studio-Key header.
	 * An installed extension may supply a different callback for protected
	 * endpoints, but a protected endpoint can never become public.
	 *
	 * @param array $config Endpoint configuration.
	 * @return callable
	 */
	public static function permission_callback( array $config ): callable {
		$scheme = self::auth_scheme( $config );
		if ( empty( $config['protected'] ) && 'key' === $scheme ) {
			return '__return_true';
		}
		$default  = array( 'RKX_AS_Security_Key_Manager', 'check_api_key' );
		$callback = apply_filters( 'rkx_as_protected_permission_callback', $default, $config );
		if ( ! is_callable( $callback ) || '__return_true' === $callback ) {
			$callback = $default;
		}
		// An authentication scheme without an installed handler fails closed:
		// it never falls back to the broader built-in key check.
		if ( 'key' !== $scheme && $default === $callback ) {
			return array( self::class, 'deny_unavailable_authentication' );
		}
		return $callback;
	}

	/**
	 * Authentication scheme stored with an endpoint. "key" is the built-in API key.
	 *
	 * @param array $config Endpoint configuration.
	 * @return string
	 */
	public static function auth_scheme( array $config ): string {
		$scheme = sanitize_key( (string) ( $config['auth_scheme'] ?? 'key' ) );
		return '' === $scheme ? 'key' : $scheme;
	}

	/**
	 * Permission callback for endpoints whose authentication handler is unavailable.
	 *
	 * @return WP_Error
	 */
	public static function deny_unavailable_authentication(): WP_Error {
		return RKX_AS_Security_Key_Manager::unauthorized_error();
	}

	/**
	 * Whether this site can execute a saved configuration.
	 *
	 * Configurations that reference field or formatter types without an
	 * installed handler are kept stored but are never served, so data is never
	 * returned without the processing the configuration requires.
	 *
	 * @param array $config Endpoint configuration.
	 * @return bool
	 */
	public static function supports_config( array $config ): bool {
		if ( 'GET' !== strtoupper( $config['method'] ?? 'GET' ) ) {
			return false;
		}
		foreach ( $config['fields'] ?? array() as $field ) {
			if ( ! is_string( $field ) ) {
				return false;
			}
			if ( array_key_exists( $field, RKX_AS_Field_Mapper::POST_TYPE_FIELDS ) ||
				array_key_exists( $field, RKX_AS_Field_Mapper::TAXONOMY_FIELDS ) ||
				str_starts_with( $field, 'meta:' ) || str_starts_with( $field, 'taxonomy:' ) ) {
				continue;
			}
			if ( ! apply_filters( 'rkx_as_field_supported', false, $field, $config ) ) {
				return false;
			}
		}
		foreach ( $config['field_formatters'] ?? array() as $entries ) {
			foreach ( (array) $entries as $entry ) {
				if ( is_array( $entry ) && ! RKX_AS_Field_Formatter::is_supported_entry( $entry ) ) {
					return false;
				}
			}
		}
		return true;
	}

	/**
	 * Handle an incoming request for a dynamic public route.
	 *
	 * Checks for a cached response when caching is enabled. On cache hit,
	 * returns the cached data with restored pagination headers. On cache miss,
	 * executes WP_Query for post-type sources or WP_Term_Query for taxonomy
	 * sources, maps results through RKX_AS_Field_Mapper, stores the result in
	 * the cache, and returns a JSON response with pagination headers.
	 *
	 * @param WP_REST_Request $request The incoming REST request.
	 * @param array           $config  The endpoint configuration.
	 * @return WP_REST_Response
	 */
	public function handle_request( WP_REST_Request $request, array $config ): WP_REST_Response {
		// Enforce before cache reads as well as queries and mapping.
		if ( ! self::supports_config( $config ) ) {
			return rest_convert_error_to_response( rkx_as_unsupported_configuration_error() );
		}

		// Read cache settings.
		$settings      = RKX_AS_Settings_Controller::get_stored_settings();
		$cache_enabled = ! empty( $settings['cache_enabled'] );
		$cache_ttl     = (int) ( $settings['cache_ttl'] ?? 300 );
		$cache_control = ! empty( $config['protected'] )
			? 'private, no-store, max-age=0'
			: 'public, max-age=' . $cache_ttl;

		$page            = (int) $request->get_param( 'page' );
		$use_wp_defaults = ! empty( $config['use_wordpress_defaults'] );

		// In Custom mode, use stored config values and ignore URL params.
		// In WP Defaults mode, allow URL params to override.
		if ( $use_wp_defaults ) {
			$per_page = (int) $request->get_param( 'per_page' );
			$order    = $request->get_param( 'order' ) ?? $config['order'] ?? 'DESC';
			$orderby  = $request->get_param( 'orderby' ) ?? $config['orderby'] ?? 'date';
			$offset   = (int) ( $request->get_param( 'offset' ) ?? $config['offset'] ?? 0 );
		} else {
			$per_page = (int) ( $config['per_page'] ?? 10 );
			$order    = $config['order'] ?? 'DESC';
			$orderby  = $config['orderby'] ?? 'date';
			$offset   = (int) ( $config['offset'] ?? 0 );
		}

		$fields           = $config['fields'] ?? array();
		$field_formatters = isset( $config['field_formatters'] ) && is_array( $config['field_formatters'] )
			? $config['field_formatters']
			: array();
		$source           = $config['data_source'] ?? '';

		$page     = max( 1, $page );
		$per_page = max( 1, min( 100, $per_page ) );

		// Check cache if enabled.
		if ( $cache_enabled ) {
			$cache_manager = new RKX_AS_Cache_Manager();

			// Build query params for cache key from request parameters,
			// excluding 'page' which is a separate key component.
			$all_params   = $request->get_params();
			$cache_params = array();
			foreach ( $all_params as $key => $value ) {
				if ( 'page' === $key ) {
					continue;
				}
				$cache_params[ $key ] = (string) $value;
			}
			$cache_params['_rkx_visibility'] = 'public-unpassworded-v1';
			ksort( $cache_params );

			$endpoint_slug = $config['slug'] ?? '';
			$cache_key     = $cache_manager->generate_key( $endpoint_slug, $page, $cache_params );
			$cached_data   = $cache_manager->get( $cache_key );

			if ( false !== $cached_data ) {
				// Cache HIT: build response from cached data.
				$response = new WP_REST_Response( $cached_data['items'], 200 );
				$response->header( 'X-WP-Total', (string) ( $cached_data['total'] ?? 0 ) );
				$response->header( 'X-WP-TotalPages', (string) ( $cached_data['total_pages'] ?? 0 ) );
				$response->header( 'X-RKX-API-Studio-Cache', 'HIT' );
				$response->header( 'Cache-Control', $cache_control );

				return $response;
			}
		}

		// Extract additional native query parameters when WP Defaults Mode is enabled.
		$extra_args      = array();
		$use_wp_defaults = ! empty( $config['use_wordpress_defaults'] );

		if ( $use_wp_defaults ) {
			$extra_args = $this->extract_native_params( $request, $source );

			// Merge taxonomy query parameters from the request with stored config defaults.
			// Request values override config for present taxonomies.
			$config = $this->merge_taxonomy_params( $request, $config );
		}

		$mapper = new RKX_AS_Field_Mapper();

		if ( $this->is_post_type_source( $source ) ) {
			$result = $this->query_posts(
				$source,
				$page,
				$per_page,
				$fields,
				$mapper,
				$order,
				$orderby,
				$offset,
				$extra_args,
				$config,
				$field_formatters
			);
		} elseif ( $this->is_taxonomy_source( $source, $config ) ) {
			$result = $this->query_terms(
				$source,
				$config,
				$page,
				$per_page,
				$fields,
				$mapper,
				$order,
				$orderby,
				$offset,
				$extra_args,
				$field_formatters
			);
		} else {
			return rest_convert_error_to_response(
				new WP_Error(
					'rkx_as_invalid_data_source',
					__( 'This endpoint\'s data source is not available.', 'rkx-api-studio' ),
					array( 'status' => 404 )
				)
			);
		}

		$items       = $result['items'];
		$total       = $result['total'];
		$total_pages = $per_page > 0 ? (int) ceil( $total / $per_page ) : 0;

		// Store in cache on MISS if caching is enabled.
		// $cache_manager and $cache_key are always defined when $cache_enabled is true.
		if ( $cache_enabled ) {
			$cache_data = array(
				'items'       => $items,
				'total'       => $total,
				'total_pages' => $total_pages,
			);
			$cache_manager->set( $cache_key, $cache_data, $endpoint_slug, $cache_ttl );
		}

		$response = new WP_REST_Response( $items, 200 );
		$response->header( 'X-WP-Total', (string) $total );
		if ( ! empty( $config['protected'] ) ) {
			$response->header( 'Cache-Control', $cache_control );
		}
		$response->header( 'X-WP-TotalPages', (string) $total_pages );

		// Add cache headers on MISS when caching is enabled.
		if ( $cache_enabled ) {
			$response->header( 'X-RKX-API-Studio-Cache', 'MISS' );
			$response->header( 'Cache-Control', $cache_control );
		}

		return $response;
	}

	/**
	 * Determine if a data source is a post type.
	 *
	 * Checks the built-in map first, then falls back to post_type_exists()
	 * for dynamically registered Custom Post Types.
	 *
	 * @param string $source The data source identifier.
	 * @return bool
	 */
	public function is_post_type_source( string $source ): bool {
		return null !== RKX_AS_Data_Sources::resolve_post_type( $source );
	}

	/**
	 * Determine if a data source is a taxonomy.
	 *
	 * Checks the built-in map first, then handles the legacy custom_taxonomy
	 * value, and finally falls back to taxonomy_exists() for dynamically
	 * registered custom taxonomies.
	 *
	 * @param string $source The data source identifier.
	 * @param array  $config The endpoint configuration.
	 * @return bool
	 */
	public function is_taxonomy_source( string $source, array $config = array() ): bool {
		return null !== RKX_AS_Data_Sources::resolve_taxonomy( $source, $config );
	}

	/**
	 * Extract and sanitize native WordPress query parameters from the request.
	 *
	 * Filters parameters through the appropriate allowlist based on data source
	 * type, rejects keys with characters outside [a-z0-9_], and sanitizes values.
	 *
	 * @param WP_REST_Request $request The incoming REST request.
	 * @param string          $source  The data source identifier.
	 * @return array Sanitized native query parameters.
	 */
	public function extract_native_params( WP_REST_Request $request, string $source ): array {
		$all_params = $request->get_params();

		// Determine the appropriate allowlist based on data source type.
		$allowlist = $this->is_post_type_source( $source )
			? self::WP_QUERY_ALLOWED_PARAMS
			: self::WP_TERM_QUERY_ALLOWED_PARAMS;

		// Core registered params that should not be forwarded as native params.
		$registered_keys = array( 'page', 'per_page', 'order', 'orderby', 'offset' );

		$sanitized = array();

		foreach ( $all_params as $key => $value ) {
			// Skip core registered parameters.
			if ( in_array( $key, $registered_keys, true ) ) {
				continue;
			}

			// Reject keys with characters outside [a-z0-9_].
			if ( ! preg_match( '/^[a-z0-9_]+$/', $key ) ) {
				continue;
			}

			// Only forward allowlisted keys.
			if ( ! in_array( $key, $allowlist, true ) ) {
				continue;
			}

			// Sanitize values: absint for integers, sanitize_text_field for strings.
			if ( is_numeric( $value ) && strval( (int) $value ) === strval( $value ) ) {
				$sanitized[ $key ] = absint( $value );
			} else {
				$sanitized[ $key ] = sanitize_text_field( (string) $value );
			}
		}

		return $sanitized;
	}

	/**
	 * Validate a taxonomy query parameter value.
	 *
	 * Ensures the value is a string of comma-separated positive integers.
	 * Returns true if valid, or a WP_Error if any segment is not a valid
	 * positive integer.
	 *
	 * @param mixed           $value   The parameter value to validate.
	 * @param WP_REST_Request $request The incoming REST request.
	 * @param string          $key     The parameter key (taxonomy slug).
	 * @return true|WP_Error True if valid, WP_Error otherwise.
	 */
	public function validate_taxonomy_query_param( $value, $request, $key ) {
		$value = (string) $value;

		if ( '' === $value ) {
			return true;
		}

		$segments = explode( ',', $value );

		foreach ( $segments as $segment ) {
			$segment = trim( $segment );

			if ( '' === $segment ) {
				return new WP_Error(
					'rest_invalid_param',
					sprintf(
						/* translators: %s: taxonomy slug */
						__( "Taxonomy query parameter '%s' must contain comma-separated positive integers.", 'rkx-api-studio' ), // phpcs:ignore Generic.Files.LineLength.TooLong
						$key
					),
					array( 'status' => 400 )
				);
			}

			if ( ! ctype_digit( $segment ) || (int) $segment < 1 ) {
				return new WP_Error(
					'rest_invalid_param',
					sprintf(
						/* translators: %s: taxonomy slug */
						__( "Taxonomy query parameter '%s' must contain comma-separated positive integers.", 'rkx-api-studio' ), // phpcs:ignore Generic.Files.LineLength.TooLong
						$key
					),
					array( 'status' => 400 )
				);
			}
		}

		return true;
	}

	/**
	 * Parse a comma-separated string of term IDs into an array of integers.
	 *
	 * @param string $value The comma-separated term ID string.
	 * @return int[] Array of positive integer term IDs.
	 */
	public function parse_taxonomy_term_ids( string $value ): array {
		if ( '' === trim( $value ) ) {
			return array();
		}

		$segments = explode( ',', $value );
		$ids      = array();

		foreach ( $segments as $segment ) {
			$segment = trim( $segment );
			if ( '' !== $segment && ctype_digit( $segment ) && (int) $segment >= 1 ) {
				$ids[] = (int) $segment;
			}
		}

		return $ids;
	}

	/**
	 * Merge taxonomy query parameters from the request with stored config defaults.
	 *
	 * For each taxonomy in the config's taxonomy_filters, checks if the request
	 * contains a parameter for that taxonomy slug. If present, the request values
	 * override the stored config defaults for that taxonomy. Taxonomies not present
	 * in the request retain their stored config values.
	 *
	 * @param WP_REST_Request $request The incoming REST request.
	 * @param array           $config  The endpoint configuration.
	 * @return array The config with merged taxonomy_filters.
	 */
	public function merge_taxonomy_params( WP_REST_Request $request, array $config ): array {
		$taxonomy_filters = $config['taxonomy_filters'] ?? array();

		if ( empty( $taxonomy_filters ) ) {
			return $config;
		}

		foreach ( $taxonomy_filters as $tax_slug => $default_term_ids ) {
			$param_value = $request->get_param( $tax_slug );

			if ( null !== $param_value && '' !== (string) $param_value ) {
				$config['taxonomy_filters'][ $tax_slug ] = $this->parse_taxonomy_term_ids( (string) $param_value );
			}
		}

		return $config;
	}

	/**
	 * Resolve a data source identifier to a WordPress post type.
	 *
	 * For built-in sources (posts, pages), returns the mapped post type.
	 * For dynamic CPTs, returns the slug directly since WordPress CPT slugs
	 * are the post_type argument to WP_Query.
	 *
	 * @param string $source The data source identifier.
	 * @return string The WordPress post type.
	 */
	private function resolve_post_type( string $source ): string {
		return (string) RKX_AS_Data_Sources::resolve_post_type( $source );
	}

	/**
	 * Resolve a data source identifier to a WordPress taxonomy.
	 *
	 * Handles three cases:
	 * 1. Built-in sources (categories, tags) — returns the mapped taxonomy.
	 * 2. Legacy custom_taxonomy — reads the actual taxonomy slug from the config.
	 * 3. Dynamic custom taxonomies — returns the slug directly.
	 *
	 * @param string $source The data source identifier.
	 * @param array  $config The endpoint configuration.
	 * @return string The WordPress taxonomy.
	 */
	private function resolve_taxonomy( string $source, array $config ): string {
		return (string) RKX_AS_Data_Sources::resolve_taxonomy( $source, $config );
	}

	/**
	 * Build a tax_query array from a taxonomy filters map.
	 *
	 * Converts the taxonomy_filters configuration (a map of taxonomy slugs
	 * to arrays of term IDs) into a WP_Query-compatible tax_query array
	 * with AND relation, field => term_id, and operator => IN.
	 *
	 * Skips taxonomies with empty term arrays. Returns an empty array when
	 * all entries are empty or the input is empty.
	 *
	 * @param array $taxonomy_filters Map of taxonomy slug => int[] term IDs.
	 * @return array The tax_query array for WP_Query, or empty array.
	 */
	public function build_tax_query( array $taxonomy_filters ): array {
		$clauses = array();

		foreach ( $taxonomy_filters as $taxonomy => $term_ids ) {
			if ( empty( $term_ids ) || ! is_array( $term_ids ) ) {
				continue;
			}

			$clauses[] = array(
				'taxonomy' => $taxonomy,
				'field'    => 'term_id',
				'terms'    => $term_ids,
				'operator' => 'IN',
			);
		}

		if ( empty( $clauses ) ) {
			return array();
		}

		$tax_query = array(
			'relation' => 'AND',
		);

		foreach ( $clauses as $clause ) {
			$tax_query[] = $clause;
		}

		return $tax_query;
	}

	/**
	 * Query posts using WP_Query and map results.
	 *
	 * @param string              $source           The data source identifier.
	 * @param int                 $page             Current page number.
	 * @param int                 $per_page         Items per page.
	 * @param array               $fields           Configured field identifiers.
	 * @param RKX_AS_Field_Mapper $mapper           The field mapper instance.
	 * @param string              $order            Sort direction (ASC or DESC).
	 * @param string              $orderby          Field to sort by.
	 * @param int                 $offset           Base offset to skip items.
	 * @param array               $extra_args       Additional WP_Query arguments.
	 * @param array               $config           The endpoint configuration.
	 * @param array               $field_formatters Map of field identifier to formatter ID list.
	 * @return array{items: array, total: int}
	 */
	private function query_posts(
		string $source,
		int $page,
		int $per_page,
		array $fields,
		RKX_AS_Field_Mapper $mapper,
		string $order = 'DESC',
		string $orderby = 'date',
		int $offset = 0,
		array $extra_args = array(),
		array $config = array(),
		array $field_formatters = array()
	): array {
		$post_type        = $this->resolve_post_type( $source );
		$effective_offset = ( $page - 1 ) * $per_page + $offset;

		// WP_Query expects 'ID' (uppercase) for post ID ordering.
		$wp_orderby = ( 'id' === $orderby ) ? 'ID' : $orderby;

		$query_args = array(
			'post_type'      => $post_type,
			'posts_per_page' => $per_page,
			'offset'         => $effective_offset,
			'post_status'    => 'publish',
			'has_password'   => false,
			'order'          => $order,
			'orderby'        => $wp_orderby,
		);

		// Merge any additional native query parameters from WP Defaults Mode.
		if ( ! empty( $extra_args ) ) {
			$query_args = array_merge( $query_args, $extra_args );
		}

		// Build and merge tax_query from taxonomy_filters config.
		$taxonomy_filters = $config['taxonomy_filters'] ?? array();
		if ( ! empty( $taxonomy_filters ) ) {
			$tax_query = $this->build_tax_query( $taxonomy_filters );
			if ( ! empty( $tax_query ) ) {
				// phpcs:ignore WordPress.DB.SlowDBQuery.slow_db_query_tax_query -- required for taxonomy filtering.
				$query_args['tax_query'] = $tax_query;
			}
		}

		$query = new WP_Query( $query_args );

		$total = (int) $query->found_posts;
		$items = array();

		$mapping_context = apply_filters( 'rkx_as_mapping_context', array(), $config );

		if ( ! empty( $query->posts ) ) {
			foreach ( $query->posts as $post ) {
				$mapped  = $mapper->map_post( $post, $fields, $field_formatters, $mapping_context );
				$items[] = $this->escape_values( $mapped );
			}
		}

		return array(
			'items' => $items,
			'total' => $total,
		);
	}

	/**
	 * Query terms using WP_Term_Query and map results.
	 *
	 * @param string              $source           The data source identifier.
	 * @param array               $config           The endpoint configuration.
	 * @param int                 $page             Current page number.
	 * @param int                 $per_page         Items per page.
	 * @param array               $fields           Configured field identifiers.
	 * @param RKX_AS_Field_Mapper $mapper           The field mapper instance.
	 * @param string              $order            Sort direction (ASC or DESC).
	 * @param string              $orderby          Field to sort by.
	 * @param int                 $offset           Base offset to skip items.
	 * @param array               $extra_args       Additional WP_Term_Query arguments.
	 * @param array               $field_formatters Map of field identifier to formatter ID list.
	 * @return array{items: array, total: int}
	 */
	private function query_terms(
		string $source,
		array $config,
		int $page,
		int $per_page,
		array $fields,
		RKX_AS_Field_Mapper $mapper,
		string $order = 'DESC',
		string $orderby = 'name',
		int $offset = 0,
		array $extra_args = array(),
		array $field_formatters = array()
	): array {
		$taxonomy         = $this->resolve_taxonomy( $source, $config );
		$effective_offset = ( $page - 1 ) * $per_page + $offset;

		// First, get the total count (without limit/offset).
		$count_query = new WP_Term_Query(
			array(
				'taxonomy'   => $taxonomy,
				'hide_empty' => false,
				'fields'     => 'count',
			)
		);

		$total = (int) $count_query->get_terms();

		// Then, get the paginated terms.
		$term_args = array(
			'taxonomy'   => $taxonomy,
			'hide_empty' => false,
			'number'     => $per_page,
			'offset'     => $effective_offset,
			'order'      => $order,
			'orderby'    => $orderby,
		);

		// Merge any additional native query parameters from WP Defaults Mode.
		if ( ! empty( $extra_args ) ) {
			$term_args = array_merge( $term_args, $extra_args );
		}

		$term_query = new WP_Term_Query( $term_args );

		$terms = $term_query->get_terms();
		$items = array();

		if ( ! empty( $terms ) && is_array( $terms ) ) {
			foreach ( $terms as $term ) {
				$mapped  = $mapper->map_term( $term, $fields, $field_formatters );
				$items[] = $this->escape_values( $mapped );
			}
		}

		return array(
			'items' => $items,
			'total' => $total,
		);
	}

	/**
	 * Recursively escape all string values in a mapped field array.
	 *
	 * @param array $mapped The mapped field values.
	 * @return array The escaped field values.
	 */
	private function escape_values( array $mapped ): array {
		return $mapped;
	}
}
