<?php
/**
 * REST controller for endpoint configuration CRUD operations.
 *
 * @package RKX_API_Studio
 */

defined( 'ABSPATH' ) || exit;

/**
 * Handles REST API routes for creating, reading, updating,
 * and deleting endpoint configurations stored in wp_options.
 */
class RKX_AS_Config_Controller {

	/**
	 * Register REST API routes for endpoint configuration management.
	 *
	 * @return void
	 */
	public function register_routes(): void {
		register_rest_route(
			RKX_AS_REST_NAMESPACE,
			'/endpoints',
			array(
				array(
					'methods'             => WP_REST_Server::READABLE,
					'callback'            => array( $this, 'get_endpoints' ),
					'permission_callback' => array( $this, 'check_permissions' ),
				),
				array(
					'methods'             => WP_REST_Server::CREATABLE,
					'callback'            => array( $this, 'create_endpoint' ),
					'permission_callback' => array( $this, 'check_permissions' ),
				),
			)
		);

		register_rest_route(
			RKX_AS_REST_NAMESPACE,
			'/endpoints/(?P<id>[a-zA-Z0-9_-]+)',
			array(
				array(
					'methods'             => WP_REST_Server::EDITABLE,
					'callback'            => array( $this, 'update_endpoint' ),
					'permission_callback' => array( $this, 'check_permissions' ),
				),
				array(
					'methods'             => WP_REST_Server::DELETABLE,
					'callback'            => array( $this, 'delete_endpoint' ),
					'permission_callback' => array( $this, 'check_permissions' ),
				),
			)
		);

		register_rest_route(
			RKX_AS_REST_NAMESPACE,
			'/data-sources',
			array(
				'methods'             => WP_REST_Server::READABLE,
				'callback'            => array( $this, 'get_data_sources' ),
				'permission_callback' => array( $this, 'check_permissions' ),
			)
		);

		register_rest_route(
			RKX_AS_REST_NAMESPACE,
			'/preview',
			array(
				'methods'             => WP_REST_Server::READABLE,
				'callback'            => array( $this, 'get_preview' ),
				'permission_callback' => array( $this, 'check_permissions' ),
			)
		);

		register_rest_route(
			RKX_AS_REST_NAMESPACE,
			'/terms',
			array(
				'methods'             => WP_REST_Server::READABLE,
				'callback'            => array( $this, 'get_terms_search' ),
				'permission_callback' => array( $this, 'check_permissions' ),
				'args'                => array(
					'taxonomy' => array(
						'required'          => true,
						'sanitize_callback' => 'sanitize_key',
					),
					'search'   => array(
						'required'          => false,
						'sanitize_callback' => 'sanitize_text_field',
					),
					'include'  => array(
						'required'          => false,
						'sanitize_callback' => 'sanitize_text_field',
					),
				),
			)
		);
	}

	/**
	 * Permission callback: verify the user has manage_options capability.
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

		// Verify nonce on mutating requests (POST, PUT, DELETE).
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
	 * GET /terms — Search taxonomy terms for autocomplete.
	 *
	 * Returns matching terms for the given taxonomy and search string.
	 * Used by the frontend FormTokenField for live-search autocomplete.
	 *
	 * Query parameters:
	 *   - taxonomy (required): The taxonomy slug.
	 *   - search (required): The search string.
	 *
	 * @param WP_REST_Request $request The incoming request.
	 * @return WP_REST_Response|WP_Error
	 */
	public function get_terms_search( WP_REST_Request $request ) {
		$taxonomy = $request->get_param( 'taxonomy' );

		if ( empty( $taxonomy ) ) {
			return new WP_Error(
				'missing_taxonomy',
				__( 'The taxonomy parameter is required.', 'rkx-api-studio' ),
				array( 'status' => 400 )
			);
		}

		if ( ! RKX_AS_Data_Sources::is_allowed_taxonomy( $taxonomy ) ) {
			return new WP_Error(
				'rkx_as_invalid_taxonomy',
				__( 'The specified taxonomy is not available.', 'rkx-api-studio' ),
				array( 'status' => 400 )
			);
		}

		$include = $request->get_param( 'include' );
		$search  = $request->get_param( 'search' );

		// When include parameter is provided, fetch terms by IDs.
		if ( ! empty( $include ) ) {
			$ids = array_filter( array_map( 'absint', explode( ',', $include ) ) );
			if ( empty( $ids ) ) {
				return new WP_REST_Response( array(), 200 );
			}

			$terms = get_terms(
				array(
					'taxonomy'   => $taxonomy,
					'include'    => $ids,
					'hide_empty' => false,
				)
			);

			return is_wp_error( $terms )
				? new WP_REST_Response( array(), 200 )
				: new WP_REST_Response( $this->format_terms( $terms ), 200 );
		}

		if ( empty( $search ) ) {
			return new WP_REST_Response( array(), 200 );
		}

		$terms = get_terms(
			array(
				'taxonomy'   => $taxonomy,
				'search'     => $search,
				'hide_empty' => false,
				'number'     => 20,
			)
		);

		return is_wp_error( $terms )
			? new WP_REST_Response( array(), 200 )
			: new WP_REST_Response( $this->format_terms( $terms ), 200 );
	}

	/**
	 * Map an array of WP_Term objects to a plain id/name/slug array.
	 *
	 * @param WP_Term[] $terms The terms to format.
	 * @return array<int, array{id: int, name: string, slug: string}>
	 */
	private function format_terms( array $terms ): array {
		return array_map(
			function ( $term ) {
				return array(
					'id'   => (int) $term->term_id,
					'name' => $term->name,
					'slug' => $term->slug,
				);
			},
			$terms
		);
	}

	/**
	 * GET /data-sources — Discover all public post types and taxonomies.
	 *
	 * Returns a JSON response with two arrays: `postTypes` and `taxonomies`.
	 * Each item contains `slug`, `label`, and `rest_base` properties.
	 *
	 * @param WP_REST_Request $request The incoming request.
	 * @return WP_REST_Response
	 */
	public function get_data_sources( WP_REST_Request $request ): WP_REST_Response {
		$post_types = get_post_types(
			array(
				'public'       => true,
				'show_in_rest' => true,
			),
			'objects'
		);
		$taxonomies = get_taxonomies(
			array(
				'public'       => true,
				'show_in_rest' => true,
			),
			'objects'
		);

		// Exclude WordPress internal types that aren't useful as API data sources.
		$excluded_post_types = RKX_AS_Data_Sources::EXCLUDED_POST_TYPES;
		$excluded_taxonomies = RKX_AS_Data_Sources::EXCLUDED_TAXONOMIES;

		$post_type_items = array();
		if ( ! empty( $post_types ) ) {
			foreach ( $post_types as $post_type ) {
				if ( in_array( $post_type->name, $excluded_post_types, true ) ) {
					continue;
				}

				// Discover public, REST-visible taxonomies registered to this post type.
				$pt_taxonomies    = get_object_taxonomies( $post_type->name, 'objects' );
				$taxonomy_entries = array();
				foreach ( $pt_taxonomies as $tax ) {
					if (
						! empty( $tax->public ) &&
						! empty( $tax->show_in_rest ) &&
						! in_array( $tax->name, $excluded_taxonomies, true )
					) {
						$taxonomy_entries[] = array(
							'slug'      => sanitize_key( $tax->name ),
							'label'     => sanitize_text_field( $tax->label ),
							'rest_base' => sanitize_key(
								! empty( $tax->rest_base ) && is_string( $tax->rest_base )
									? $tax->rest_base
									: $tax->name
							),
						);
					}
				}

				$post_type_items[] = array(
					'slug'       => sanitize_key( $post_type->name ),
					'label'      => sanitize_text_field( $post_type->label ),
					'rest_base'  => sanitize_key( $post_type->rest_base ),
					'taxonomies' => $taxonomy_entries,
				);
			}
		}

		$taxonomy_items = array();
		if ( ! empty( $taxonomies ) ) {
			foreach ( $taxonomies as $taxonomy ) {
				if ( in_array( $taxonomy->name, $excluded_taxonomies, true ) ) {
					continue;
				}
				$taxonomy_items[] = array(
					'slug'      => sanitize_key( $taxonomy->name ),
					'label'     => sanitize_text_field( $taxonomy->label ),
					'rest_base' => sanitize_key( $taxonomy->rest_base ),
				);
			}
		}

		return new WP_REST_Response(
			array(
				'postTypes'  => $post_type_items,
				'taxonomies' => $taxonomy_items,
			),
			200
		);
	}

	/**
	 * GET /preview — Fetch a small sample of real data for a given data source.
	 *
	 * Uses WP_Query for post types and WP_Term_Query for taxonomies directly,
	 * so it works for any registered public type regardless of show_in_rest.
	 *
	 * Query parameters:
	 *   - data_source (required): The post type or taxonomy slug.
	 *   - per_page (optional): Number of items to return (default 3, max 5).
	 *
	 * @param WP_REST_Request $request The incoming request.
	 * @return WP_REST_Response
	 */
	public function get_preview( WP_REST_Request $request ): WP_REST_Response {
		$data_source  = sanitize_text_field( $request->get_param( 'data_source' ) ?? '' );
		$per_page     = min( 5, max( 1, absint( $request->get_param( 'per_page' ) ?? 3 ) ) );
		$fields_param = $request->get_param( 'fields' ) ?? '';

		if ( empty( $data_source ) ) {
			return new WP_REST_Response(
				array(
					'code'    => 'missing_data_source',
					'message' => __( 'data_source parameter is required.', 'rkx-api-studio' ),
				),
				400
			);
		}

		// Parse optional meta fields from the fields parameter (comma-separated).
		$meta_fields = array();
		if ( ! empty( $fields_param ) ) {
			$requested_fields = array_map( 'trim', explode( ',', $fields_param ) );
			foreach ( $requested_fields as $field ) {
				if ( str_starts_with( $field, 'meta:' ) ) {
					$meta_fields[] = $field;
				}
			}
		}

		$mapping_context = apply_filters( 'rkx_as_preview_mapping_context', array(), $request );

		// Parse field_formatters from the request for live preview formatting.
		$field_formatters_param = $request->get_param( 'field_formatters' ) ?? '';
		$field_formatters       = array();
		if ( ! empty( $field_formatters_param ) ) {
			$decoded_formatters = json_decode( $field_formatters_param, true );
			if ( is_array( $decoded_formatters ) ) {
				$field_formatters = $decoded_formatters;
			}
		}

		$mapper = new RKX_AS_Field_Mapper();

		// Determine if this is an allowed post type or taxonomy source.
		$wp_post_type = RKX_AS_Data_Sources::resolve_post_type( $data_source );
		$wp_taxonomy  = null === $wp_post_type ? RKX_AS_Data_Sources::resolve_taxonomy( $data_source ) : null;

		if ( null !== $wp_post_type ) {

			$query_args = array(
				'post_type'      => $wp_post_type,
				'posts_per_page' => $per_page,
				'post_status'    => 'publish',
				'has_password'   => false,
				'orderby'        => 'date',
				'order'          => 'DESC',
			);

			// Apply taxonomy filters if provided.
			$taxonomy_filters_param = $request->get_param( 'taxonomy_filters' );
			if ( ! empty( $taxonomy_filters_param ) ) {
				$taxonomy_filters = json_decode( $taxonomy_filters_param, true );
				if ( is_array( $taxonomy_filters ) ) {
					$registrar = new RKX_AS_Route_Registrar();
					$tax_query = $registrar->build_tax_query( $taxonomy_filters );
					if ( ! empty( $tax_query ) ) {
						// phpcs:ignore WordPress.DB.SlowDBQuery.slow_db_query_tax_query -- required for taxonomy filtering.
						$query_args['tax_query'] = $tax_query;
					}
				}
			}

			$query = new WP_Query( $query_args );

			// Include standard fields plus taxonomy fields for registered taxonomies.
			$all_fields = self::POST_TYPE_FIELDS;

			$registered_taxonomies = get_object_taxonomies( $wp_post_type, 'objects' );
			foreach ( $registered_taxonomies as $tax ) {
				if ( RKX_AS_Data_Sources::is_allowed_taxonomy( $tax->name ) ) {
					$all_fields[] = 'taxonomy:' . $tax->name;
				}
			}

			// Include any meta: fields requested by the frontend.
			$all_fields = array_merge( $all_fields, $meta_fields );

			// Extensions may supply additional preview fields.
			$all_fields = apply_filters( 'rkx_as_preview_fields', $all_fields, $request );

			$items = array();

			if ( ! empty( $query->posts ) ) {
				foreach ( $query->posts as $post ) {
					$items[] = $mapper->map_post( $post, $all_fields, $field_formatters, $mapping_context );
				}
			}

			return new WP_REST_Response(
				array(
					'type'  => 'post_type',
					'items' => $items,
					'total' => (int) $query->found_posts,
				),
				200
			);
		}

		if ( null !== $wp_taxonomy ) {

			$term_query = new WP_Term_Query(
				array(
					'taxonomy'   => $wp_taxonomy,
					'hide_empty' => false,
					'number'     => $per_page,
					'orderby'    => 'name',
					'order'      => 'ASC',
				)
			);

			$all_fields = self::TAXONOMY_FIELDS;

			// Include any meta: fields requested by the frontend.
			$all_fields = array_merge( $all_fields, $meta_fields );

			$terms = $term_query->get_terms();
			$items = array();

			if ( ! empty( $terms ) && is_array( $terms ) ) {
				foreach ( $terms as $term ) {
					$items[] = $mapper->map_term( $term, $all_fields, $field_formatters );
				}
			}

			// Get total count.
			$count_query = new WP_Term_Query(
				array(
					'taxonomy'   => $wp_taxonomy,
					'hide_empty' => false,
					'fields'     => 'count',
				)
			);

			return new WP_REST_Response(
				array(
					'type'  => 'taxonomy',
					'items' => $items,
					'total' => (int) $count_query->get_terms(),
				),
				200
			);
		}

		return new WP_REST_Response(
			array(
				'code'    => 'rkx_as_invalid_data_source',
				'message' => __( 'Unknown data source.', 'rkx-api-studio' ),
			),
			404
		);
	}

	/**
	 * GET /endpoints — List all saved endpoint configurations.
	 *
	 * @param WP_REST_Request $request The incoming request.
	 * @return WP_REST_Response
	 */
	public function get_endpoints( WP_REST_Request $request ): WP_REST_Response {
		$configs = get_option( RKX_AS_OPTION_KEY, array() );
		$configs = is_array( $configs ) ? array_values( $configs ) : array();

		return new WP_REST_Response( array_map( array( self::class, 'prepare_response' ), $configs ), 200 );
	}

	/**
	 * POST /endpoints — Create a new endpoint configuration.
	 *
	 * Generates a unique ID and timestamps, validates, sanitizes,
	 * and persists the configuration.
	 *
	 * @param WP_REST_Request $request The incoming request.
	 * @return WP_REST_Response|WP_Error
	 */
	public function create_endpoint( WP_REST_Request $request ) {
		$body        = $request->get_json_params();
		$body        = is_array( $body ) ? $body : array();
		$unsupported = $this->check_formatter_support( $body );
		if ( is_wp_error( $unsupported ) ) {
			return $unsupported;
		}

		$unsupported_auth = $this->check_auth_support( $body );
		if ( is_wp_error( $unsupported_auth ) ) {
			return $unsupported_auth;
		}

		$data_source     = $body['data_source'] ?? '';
		$default_orderby = self::get_default_orderby( $data_source );

		$config = array(
			'id'                     => 'endpoint_' . uniqid(),
			'name'                   => $body['name'] ?? '',
			'slug'                   => $body['slug'] ?? '',
			'method'                 => $body['method'] ?? 'GET',
			'description'            => $body['description'] ?? '',
			'data_source'            => $data_source,
			'custom_taxonomy'        => $body['custom_taxonomy'] ?? '',
			'fields'                 => $body['fields'] ?? array(),
			'field_formatters'       => $body['field_formatters'] ?? array(),
			'per_page'               => $body['per_page'] ?? 10,
			'offset'                 => $body['offset'] ?? 0,
			'order'                  => $body['order'] ?? 'DESC',
			'orderby'                => $body['orderby'] ?? $default_orderby,
			'use_wordpress_defaults' => $body['use_wordpress_defaults'] ?? false,
			'taxonomy_filters'       => $body['taxonomy_filters'] ?? array(),
			'protected'              => ! empty( $body['protected'] ),
			'auth_scheme'            => 'key',
			'created_at'             => gmdate( 'Y-m-d\TH:i:s\Z' ),
			'updated_at'             => gmdate( 'Y-m-d\TH:i:s\Z' ),
		);

		$config = $this->prepare_config( $this->sanitize_config( $config ), $body, array() );

		$validation = $this->validate_config( $config, $body );
		if ( is_wp_error( $validation ) ) {
			return $validation;
		}

		$configs                  = get_option( RKX_AS_OPTION_KEY, array() );
		$configs                  = is_array( $configs ) ? $configs : array();
		$configs[ $config['id'] ] = $config;

		$updated = update_option( RKX_AS_OPTION_KEY, $configs );
		if ( false === $updated ) {
			return new WP_Error(
				'storage_error',
				__( 'Failed to save endpoint configuration. Please try again.', 'rkx-api-studio' ),
				array( 'status' => 500 )
			);
		}

		// Invalidate any cached responses for this endpoint slug.
		( new RKX_AS_Cache_Manager() )->clear_endpoint( $config['slug'] );

		/**
		 * Fires after an endpoint configuration was saved.
		 *
		 * @param array $config Saved configuration.
		 * @param array $body   Request body.
		 */
		do_action( 'rkx_as_endpoint_saved', $config, $body );

		return new WP_REST_Response( self::prepare_response( $config ), 201 );
	}

	/**
	 * PUT /endpoints/{id} — Update an existing endpoint configuration.
	 *
	 * @param WP_REST_Request $request The incoming request.
	 * @return WP_REST_Response|WP_Error
	 */
	public function update_endpoint( WP_REST_Request $request ) {
		$id      = $request->get_param( 'id' );
		$configs = get_option( RKX_AS_OPTION_KEY, array() );

		if ( ! isset( $configs[ $id ] ) ) {
			return new WP_Error(
				'not_found',
				__( 'The requested endpoint configuration was not found.', 'rkx-api-studio' ),
				array( 'status' => 404 )
			);
		}

		$body        = $request->get_json_params();
		$body        = is_array( $body ) ? $body : array();
		$existing    = $configs[ $id ];
		$unsupported = $this->check_formatter_support( $body + $existing );
		if ( is_wp_error( $unsupported ) ) {
			return $unsupported;
		}

		$unsupported_auth = $this->check_auth_support( $body, $existing );
		if ( is_wp_error( $unsupported_auth ) ) {
			return $unsupported_auth;
		}

		$data_source     = $body['data_source'] ?? $existing['data_source'];
		$default_orderby = self::get_default_orderby( $data_source );

		$config = array(
			'id'                     => $id,
			'name'                   => $body['name'] ?? $existing['name'],
			'slug'                   => $existing['slug'],
			'method'                 => $body['method'] ?? $existing['method'] ?? 'GET',
			'description'            => $body['description'] ?? $existing['description'] ?? '',
			'data_source'            => $data_source,
			'custom_taxonomy'        => $body['custom_taxonomy'] ?? $existing['custom_taxonomy'],
			'fields'                 => $body['fields'] ?? $existing['fields'],
			'field_formatters'       => $body['field_formatters']
				?? $existing['field_formatters'] ?? array(),
			'per_page'               => $body['per_page'] ?? $existing['per_page'],
			'offset'                 => $body['offset'] ?? $existing['offset'] ?? 0,
			'order'                  => $body['order'] ?? $existing['order'] ?? 'DESC',
			'orderby'                => $body['orderby'] ?? $existing['orderby'] ?? $default_orderby,
			'use_wordpress_defaults' => $body['use_wordpress_defaults']
				?? $existing['use_wordpress_defaults'] ?? false,
			'taxonomy_filters'       => $body['taxonomy_filters']
				?? $existing['taxonomy_filters'] ?? array(),
			'protected'              => array_key_exists( 'protected', $body )
				? ! empty( $body['protected'] )
				: ! empty( $existing['protected'] ),
			// Kept on every edit; only an installed extension may change it (see prepare_config()).
			'auth_scheme'            => RKX_AS_Route_Registrar::auth_scheme( $existing ),
			'created_at'             => $existing['created_at'],
			'updated_at'             => gmdate( 'Y-m-d\TH:i:s\Z' ),
		);

		$config = $this->prepare_config( $this->sanitize_config( $config ), $body, $existing );

		$validation = $this->validate_config( $config, $body );
		if ( is_wp_error( $validation ) ) {
			return $validation;
		}

		$configs[ $id ] = $config;

		$updated = update_option( RKX_AS_OPTION_KEY, $configs );
		if ( false === $updated ) {
			return new WP_Error(
				'storage_error',
				__( 'Failed to save endpoint configuration. Please try again.', 'rkx-api-studio' ),
				array( 'status' => 500 )
			);
		}

		// Invalidate any cached responses for this endpoint slug.
		( new RKX_AS_Cache_Manager() )->clear_endpoint( $config['slug'] );

		/** This action is documented in create_endpoint(). */
		do_action( 'rkx_as_endpoint_saved', $config, $body );

		return new WP_REST_Response( self::prepare_response( $config ), 200 );
	}

	/**
	 * DELETE /endpoints/{id} — Delete an endpoint configuration.
	 *
	 * @param WP_REST_Request $request The incoming request.
	 * @return WP_REST_Response|WP_Error
	 */
	public function delete_endpoint( WP_REST_Request $request ) {
		$id      = $request->get_param( 'id' );
		$configs = get_option( RKX_AS_OPTION_KEY, array() );

		if ( ! isset( $configs[ $id ] ) ) {
			return new WP_Error(
				'not_found',
				__( 'The requested endpoint configuration was not found.', 'rkx-api-studio' ),
				array( 'status' => 404 )
			);
		}

		// Capture the slug before removing the config so we can clear its cache.
		$deleted = $configs[ $id ];
		$slug    = $deleted['slug'] ?? '';

		unset( $configs[ $id ] );

		$updated = update_option( RKX_AS_OPTION_KEY, $configs );
		if ( false === $updated ) {
			return new WP_Error(
				'storage_error',
				__( 'Failed to save endpoint configuration. Please try again.', 'rkx-api-studio' ),
				array( 'status' => 500 )
			);
		}

		// Invalidate any cached responses for the deleted endpoint.
		if ( ! empty( $slug ) ) {
			( new RKX_AS_Cache_Manager() )->clear_endpoint( $slug );
		}

		/**
		 * Fires after an endpoint configuration was deleted.
		 *
		 * @param string $id     Endpoint ID.
		 * @param array  $config Deleted configuration.
		 */
		do_action( 'rkx_as_endpoint_deleted', $id, $deleted );

		return new WP_REST_Response( null, 204 );
	}

	/**
	 * Valid HTTP methods for endpoint configuration.
	 *
	 * @var string[]
	 */
	public const VALID_METHODS = array(
		'GET',
	);

	/**
	 * Reject object-type formatter entries that have no installed handler.
	 *
	 * Runs before sanitization so unprocessed entries (for example masking
	 * rules) are never silently dropped from a saved configuration.
	 *
	 * @param array $config Incoming configuration.
	 * @return true|WP_Error
	 */
	private function check_formatter_support( array $config ) {
		foreach ( (array) ( $config['field_formatters'] ?? array() ) as $entries ) {
			foreach ( (array) $entries as $entry ) {
				if ( is_array( $entry ) && ! RKX_AS_Field_Formatter::is_supported_entry( $entry ) ) {
					return new WP_Error(
						'rkx_as_unsupported_formatter',
						__(
							'This configuration uses a formatter that is not available on this site. It was not saved.',
							'rkx-api-studio'
						),
						array( 'status' => 400 )
					);
				}
			}
		}
		return true;
	}

	/**
	 * Reject endpoint configurations specifying authentication schemes that
	 * have no active provider or were not fulfilled by the prepared config.
	 *
	 * Custom schemes require an active extension; Free must never silently
	 * convert them into global-key or public authorization.
	 *
	 * @param array $body     Incoming request body.
	 * @param array $existing Existing endpoint configuration on update.
	 * @return true|WP_Error
	 */
	private function check_auth_support( array $body, array $existing = array() ) {
		if (
			array_key_exists( 'auth_scheme', $body ) &&
			null !== $body['auth_scheme'] &&
			! is_string( $body['auth_scheme'] )
		) {
			return new WP_Error(
				'rkx_as_unsupported_auth',
				// phpcs:ignore Generic.Files.LineLength.TooLong
				__( 'This configuration uses authentication restrictions that are not available on this site. It was not saved.', 'rkx-api-studio' ),
				array( 'status' => 400 )
			);
		}
		$requested = isset( $body['auth_scheme'] ) && is_string( $body['auth_scheme'] )
			? trim( $body['auth_scheme'] )
			: '';
		if ( '' === $requested || 'key' === $requested ) {
			return true;
		}
		$sanitized = RKX_AS_Route_Registrar::auth_scheme( array( 'auth_scheme' => $requested ) );
		$probe     = $this->prepare_config(
			array(
				'id'          => (string) ( $existing['id'] ?? '' ),
				'slug'        => (string) ( $existing['slug'] ?? '' ),
				'created_at'  => (string) ( $existing['created_at'] ?? '' ),
				'updated_at'  => (string) ( $existing['updated_at'] ?? '' ),
				'protected'   => true,
				'auth_scheme' => 'key',
			),
			$body,
			$existing
		);
		$callback  = RKX_AS_Route_Registrar::permission_callback( $probe );
		if (
			$sanitized !== $requested ||
			( $probe['auth_scheme'] ?? 'key' ) !== $requested ||
			array( 'RKX_AS_Route_Registrar', 'deny_unavailable_authentication' ) === $callback
		) {
			return new WP_Error(
				'rkx_as_unsupported_auth',
				// phpcs:ignore Generic.Files.LineLength.TooLong
				__( 'This configuration uses authentication restrictions that are not available on this site. It was not saved.', 'rkx-api-studio' ),
				array( 'status' => 400 )
			);
		}
		return true;
	}

	/**
	 * Let installed extensions adjust a sanitized configuration before validation.
	 *
	 * @param array $config   Sanitized configuration.
	 * @param array $body     Request body.
	 * @param array $existing Previously stored configuration, or empty on create.
	 * @return array
	 */
	private function prepare_config( array $config, array $body, array $existing ): array {
		$prepared = apply_filters( 'rkx_as_prepare_endpoint', $config, $body, $existing );
		if ( ! is_array( $prepared ) ) {
			return $config;
		}
		// Identity, slug and timestamps are owned by RKX API Studio.
		foreach ( array( 'id', 'slug', 'created_at', 'updated_at' ) as $key ) {
			$prepared[ $key ] = $config[ $key ];
		}
		// Extensions may require protection but can never remove it.
		$prepared['protected']   = ! empty( $config['protected'] ) || ! empty( $prepared['protected'] );
		$prepared['auth_scheme'] = RKX_AS_Route_Registrar::auth_scheme( $prepared );
		if ( 'key' !== $prepared['auth_scheme'] ) {
			$prepared['protected'] = true;
		}
		return $prepared;
	}

	/**
	 * Prepare a stored configuration for a REST response.
	 *
	 * @param array $config Stored configuration.
	 * @return array
	 */
	public static function prepare_response( array $config ): array {
		$response = apply_filters( 'rkx_as_endpoint_response', $config );
		return is_array( $response ) ? $response : $config;
	}

	/**
	 * Valid fields for post-type data sources (posts, pages).
	 *
	 * @var string[]
	 */
	private const POST_TYPE_FIELDS = array(
		'id',
		'title',
		'content',
		'excerpt',
		'featured_image_url',
		'slug',
		'date',
		'author',
	);

	/**
	 * Valid fields for taxonomy data sources (categories, tags, custom taxonomies).
	 *
	 * @var string[]
	 */
	private const TAXONOMY_FIELDS = array(
		'id',
		'name',
		'slug',
		'description',
		'count',
		'parent',
	);

	/**
	 * Built-in taxonomy data sources that use TAXONOMY_FIELDS.
	 *
	 * @var string[]
	 */
	private const TAXONOMY_SOURCES = array(
		'categories',
		'tags',
	);

	/**
	 * Valid orderby fields for post-type data sources (posts, pages).
	 *
	 * @var string[]
	 */
	private const POST_TYPE_ORDERBY_FIELDS = array(
		'date',
		'title',
		'modified',
		'id',
		'author',
		'slug',
	);

	/**
	 * Valid orderby fields for taxonomy data sources (categories, tags, custom taxonomies).
	 *
	 * @var string[]
	 */
	private const TAXONOMY_ORDERBY_FIELDS = array(
		'name',
		'slug',
		'count',
		'id',
		'description',
	);

	/**
	 * Valid order direction values.
	 *
	 * @var string[]
	 */
	private const VALID_ORDER_VALUES = array(
		'ASC',
		'DESC',
	);

	/**
	 * Get the default orderby field for a given data source.
	 *
	 * Returns 'date' for post-type sources (built-in or dynamic CPTs) and
	 * 'name' for taxonomy sources (built-in or dynamic custom taxonomies).
	 *
	 * @param string $data_source The data source type.
	 * @return string The default orderby field.
	 */
	public static function get_default_orderby( string $data_source ): string {
		// Built-in post type sources.
		if ( in_array( $data_source, array( 'posts', 'pages' ), true ) ) {
			return 'date';
		}

		// Built-in taxonomy sources.
		if ( in_array( $data_source, self::TAXONOMY_SOURCES, true ) ) {
			return 'name';
		}

		// Dynamic CPTs registered at runtime.
		if ( post_type_exists( $data_source ) ) {
			return 'date';
		}

		// Dynamic custom taxonomies registered at runtime.
		if ( taxonomy_exists( $data_source ) ) {
			return 'name';
		}

		// Fallback for unknown sources.
		return 'name';
	}

	/**
	 * Validate an endpoint configuration.
	 *
	 * Checks that all required fields are present and valid:
	 * - name: non-empty string
	 * - slug: non-empty, matches [a-z0-9-]+, unique among saved configs
	 * - data_source: built-in type or registered custom taxonomy
	 * - fields: non-empty array of valid field identifiers for the source type
	 * - per_page: integer between 1 and 100
	 *
	 * @param array $config The configuration to validate.
	 * @param array $body   Request body, passed to extension validation.
	 * @return true|WP_Error True if valid, WP_Error on failure.
	 */
	public function validate_config( array $config, array $body = array() ) {
		$errors = array();

		// Validate method against the methods that have a request handler.
		$method = $config['method'] ?? 'GET';
		if ( ! in_array( $method, rkx_as_supported_methods(), true ) ) {
			$errors['method'] = __( 'This HTTP method is not available on this site.', 'rkx-api-studio' );
		}

		// Methods other than GET are handled by an installed extension and need no fields.
		$is_write_method = 'GET' !== $method && in_array( $method, rkx_as_supported_methods(), true );

		// Validate name.
		if ( empty( $config['name'] ) ) {
			$errors['name'] = __( 'Endpoint name is required.', 'rkx-api-studio' );
		}

		// Validate slug: non-empty and format.
		$slug = $config['slug'] ?? '';
		if ( empty( $slug ) ) {
			$errors['slug'] = __( 'Endpoint slug is required.', 'rkx-api-studio' );
		} elseif ( ! preg_match( '/^[a-z0-9-]+$/', $slug ) ) {
			$errors['slug'] = __( 'Slug must contain only lowercase letters, numbers, and hyphens.', 'rkx-api-studio' ); // phpcs:ignore Generic.Files.LineLength.TooLong
		} else {
			// Validate slug uniqueness per method.
			// The same slug can be used by different HTTP methods (e.g., GET /users and POST /users).
			// Only reject when both slug AND method match another endpoint.
			$existing_configs = get_option( RKX_AS_OPTION_KEY, array() );
			$config_id        = $config['id'] ?? '';

			foreach ( $existing_configs as $existing ) {
				if ( $existing['slug'] === $slug && $existing['id'] !== $config_id ) {
					$existing_method = $existing['method'] ?? 'GET';
					if ( $existing_method === $method ) {
						$errors['slug'] = __( 'This slug is already in use by another endpoint with the same method.', 'rkx-api-studio' ); // phpcs:ignore Generic.Files.LineLength.TooLong
						break;
					}
				}
			}
		}

		// Validate data_source.
		$data_source  = $config['data_source'] ?? '';
		$valid_source = false;
		$is_taxonomy  = false;

		if ( empty( $data_source ) ) {
			$errors['data_source'] = __( 'A data source must be selected.', 'rkx-api-studio' );
		} elseif ( null !== RKX_AS_Data_Sources::resolve_post_type( $data_source ) ) {
			// Only public, REST-visible post types may be exposed.
			$valid_source = true;
			$is_taxonomy  = false;
		} elseif ( null !== RKX_AS_Data_Sources::resolve_taxonomy( $data_source, $config ) ) {
			// Only public, REST-visible taxonomies may be exposed.
			$valid_source = true;
			$is_taxonomy  = true;
		} else {
			$errors['data_source'] = __( 'Invalid data source type.', 'rkx-api-studio' );
		}

		// Validate fields (skip for write methods — they don't need fields).
		$fields = $config['fields'] ?? array();
		if ( ! $is_write_method && ( ! is_array( $fields ) || empty( $fields ) ) ) {
			$errors['fields'] = __( 'At least one field must be selected.', 'rkx-api-studio' );
		} elseif ( ! $is_write_method && $valid_source ) {
			$allowed_fields = $is_taxonomy ? self::TAXONOMY_FIELDS : self::POST_TYPE_FIELDS;
			$invalid_fields = array_diff( $fields, $allowed_fields );

			// Meta fields are valid unless the key is protected.
			$meta_type      = $is_taxonomy ? 'term' : 'post';
			$invalid_fields = array_filter(
				$invalid_fields,
				static function ( $field ) use ( $meta_type ) {
					return ! str_starts_with( $field, 'meta:' ) ||
						! RKX_AS_Data_Sources::is_allowed_meta_key( substr( $field, 5 ), $meta_type );
				}
			);

			// Field types without a built-in mapper need an installed handler.
			$invalid_fields = array_filter(
				$invalid_fields,
				static function ( $field ) use ( $config ) {
					return ! apply_filters( 'rkx_as_field_supported', false, $field, $config );
				}
			);

			if ( ! empty( $invalid_fields ) && ! $is_taxonomy ) {
				// For post-type sources, check if invalid fields are taxonomy:{slug} references.
				// Resolve the WordPress post type slug for get_object_taxonomies().
				$post_type_map = array(
					'posts' => 'post',
					'pages' => 'page',
				);
				$wp_post_type  = $post_type_map[ $data_source ] ?? $data_source;

				$registered_taxonomies = get_object_taxonomies( $wp_post_type, 'objects' );
				$registered_tax_slugs  = array_values(
					array_filter(
						array_keys( $registered_taxonomies ),
						array( 'RKX_AS_Data_Sources', 'is_allowed_taxonomy' )
					)
				);

				$truly_invalid = array();
				foreach ( $invalid_fields as $field ) {
					if ( preg_match( '/^taxonomy:([a-z0-9_-]+)$/', $field, $matches ) ) {
						$taxonomy_slug = $matches[1];
						if ( ! in_array( $taxonomy_slug, $registered_tax_slugs, true ) ) {
							$truly_invalid[] = $field;
						}
					} else {
						$truly_invalid[] = $field;
					}
				}

				if ( ! empty( $truly_invalid ) ) {
					$errors['fields'] = sprintf(
						/* translators: %s: comma-separated list of invalid field names */
						__( 'Invalid fields for the selected data source: %s.', 'rkx-api-studio' ),
						implode( ', ', $truly_invalid )
					);
				}
			} elseif ( ! empty( $invalid_fields ) ) {
				// For taxonomy sources, reject all invalid fields including taxonomy-prefixed ones.
				$errors['fields'] = sprintf(
					/* translators: %s: comma-separated list of invalid field names */
					__( 'Invalid fields for the selected data source: %s.', 'rkx-api-studio' ),
					implode( ', ', $invalid_fields )
				);
			}
		}

		// Validate field_formatters.
		// Supports mixed entries: strings (built-in) and associative arrays (object-type formatters).
		$field_formatters = $config['field_formatters'] ?? array();
		if ( ! is_array( $field_formatters ) ) {
			$errors['field_formatters'] = __( 'Invalid formatter configuration.', 'rkx-api-studio' );
		} else {
			$formatter_validation_failed = false;
			foreach ( $field_formatters as $formatters ) {
				if ( ! is_array( $formatters ) || $formatter_validation_failed ) {
					continue;
				}
				$invalid_strings = array();
				foreach ( $formatters as $entry ) {
					if ( is_string( $entry ) ) {
						// Built-in formatter: validate against known list.
						if ( ! in_array( $entry, RKX_AS_Field_Formatter::VALID_FORMATTERS, true ) ) {
							$invalid_strings[] = $entry;
						}
					} elseif ( is_array( $entry ) ) {
						/**
						 * Filters the validation result for an object-type formatter entry.
						 *
						 * An installed handler can validate the entry and return true on
						 * success or a WP_Error on failure.
						 *
						 * @param true|WP_Error $result The validation result.
						 * @param array         $entry  The formatter entry with 'id' and 'config' keys.
						 */
						$entry_validation = apply_filters( 'rkx_as_formatter_validate', true, $entry );
						if ( is_wp_error( $entry_validation ) ) {
							$errors['field_formatters']  = $entry_validation->get_error_message();
							$formatter_validation_failed = true;
							break;
						}
					}
				}
				if ( ! $formatter_validation_failed && ! empty( $invalid_strings ) ) {
					$errors['field_formatters'] = sprintf(
						/* translators: %s: comma-separated list of unknown formatter IDs */
						__( 'Unknown formatters: %s.', 'rkx-api-studio' ),
						implode( ', ', $invalid_strings )
					);
					$formatter_validation_failed = true;
				}
			}
		}

		// Skip query parameter validation when WP Defaults Mode is enabled or when using a write method.
		$use_wp_defaults = ! empty( $config['use_wordpress_defaults'] );

		if ( ! $use_wp_defaults && ! $is_write_method ) {
			// Validate per_page.
			$per_page = $config['per_page'] ?? null;
			if ( ! is_int( $per_page ) || $per_page < 1 || $per_page > 100 ) {
				$errors['per_page'] = __( 'Items per page must be between 1 and 100.', 'rkx-api-studio' );
			}

			// Validate offset.
			$offset = $config['offset'] ?? null;
			if ( ! is_int( $offset ) || $offset < 0 ) {
				$errors['offset'] = __( 'Offset must be a non-negative integer.', 'rkx-api-studio' );
			}

			// Validate order.
			$order = $config['order'] ?? '';
			if ( ! in_array( $order, self::VALID_ORDER_VALUES, true ) ) {
				$errors['order'] = __( 'Order must be either ASC or DESC.', 'rkx-api-studio' );
			}

			// Validate orderby (only if data source is valid).
			if ( $valid_source ) {
				$orderby         = $config['orderby'] ?? '';
				$allowed_orderby = $is_taxonomy ? self::TAXONOMY_ORDERBY_FIELDS : self::POST_TYPE_ORDERBY_FIELDS;

				if ( ! in_array( $orderby, $allowed_orderby, true ) ) {
					$errors['orderby'] = __( 'Invalid orderby field for the selected data source.', 'rkx-api-studio' ); // phpcs:ignore Generic.Files.LineLength.TooLong
				}
			}
		}

		if ( ! empty( $errors ) ) {
			return new WP_Error(
				'invalid_config',
				__( 'Endpoint configuration is invalid.', 'rkx-api-studio' ),
				array(
					'status' => 400,
					'errors' => $errors,
				)
			);
		}

		// Validate taxonomy_filters (after other validations pass).
		$taxonomy_filters = $config['taxonomy_filters'] ?? array();

		/**
		 * Lets installed extensions validate their own request data.
		 *
		 * @param true|WP_Error $result Validation result.
		 * @param array         $config Sanitized configuration.
		 * @param array         $body   Request body.
		 */
		$validation = apply_filters( 'rkx_as_validate_endpoint', true, $config, $body );
		if ( is_wp_error( $validation ) ) {
			return $validation;
		}

		if ( ! empty( $taxonomy_filters ) ) {
			$tax_validation = $this->validate_taxonomy_filters( $taxonomy_filters, $config['data_source'] ?? '' );
			if ( is_wp_error( $tax_validation ) ) {
				return $tax_validation;
			}
		}

		return true;
	}

	/**
	 * Sanitize an endpoint configuration.
	 *
	 * Strips HTML tags and applies appropriate WordPress sanitization
	 * functions to each field in the configuration array.
	 *
	 * @param array $config The configuration to sanitize.
	 * @return array The sanitized configuration.
	 */
	public function sanitize_config( array $config ): array {
		// Sanitize name via sanitize_text_field (strips tags, removes extra whitespace).
		$config['name'] = sanitize_text_field( $config['name'] ?? '' );

		// Sanitize description via sanitize_textarea_field (preserves newlines).
		$config['description'] = sanitize_textarea_field( $config['description'] ?? '' );

		// Sanitize slug via sanitize_title (lowercase, alphanumeric + hyphens).
		$config['slug'] = sanitize_title( $config['slug'] ?? '' );

		// Sanitize method — uppercase, default to 'GET' if empty or invalid.
		$method           = strtoupper( sanitize_text_field( $config['method'] ?? '' ) );
		$config['method'] = ! empty( $method ) ? $method : 'GET';

		// Sanitize data_source via sanitize_text_field.
		$config['data_source'] = sanitize_text_field( $config['data_source'] ?? '' );

		// Sanitize custom_taxonomy via sanitize_text_field.
		$config['custom_taxonomy'] = sanitize_text_field( $config['custom_taxonomy'] ?? '' );

		// Sanitize fields array — each element via sanitize_text_field.
		if ( isset( $config['fields'] ) && is_array( $config['fields'] ) ) {
			$config['fields'] = array_values(
				array_map( 'sanitize_text_field', $config['fields'] )
			);
		} else {
			$config['fields'] = array();
		}

		// Sanitize per_page — cast to absolute integer, clamp between 1 and 100.
		$per_page           = absint( $config['per_page'] ?? 10 );
		$config['per_page'] = max( 1, min( 100, $per_page ) );

		// Sanitize offset — cast to absolute integer (non-negative).
		$config['offset'] = absint( $config['offset'] ?? 0 );

		// Sanitize order — accept only 'ASC' or 'DESC', default to 'DESC'.
		$order           = strtoupper( trim( (string) ( $config['order'] ?? 'DESC' ) ) );
		$config['order'] = in_array( $order, self::VALID_ORDER_VALUES, true ) ? $order : 'DESC';

		// Sanitize orderby — strip tags and trim whitespace.
		$config['orderby'] = sanitize_text_field( $config['orderby'] ?? '' );

		// Sanitize use_wordpress_defaults — cast to boolean.
		$config['use_wordpress_defaults'] = (bool) ( $config['use_wordpress_defaults'] ?? false );

		// Sanitize id via sanitize_text_field.
		$config['id'] = sanitize_text_field( $config['id'] ?? '' );

		// Sanitize timestamps via sanitize_text_field.
		$config['created_at'] = sanitize_text_field( $config['created_at'] ?? '' );
		$config['updated_at'] = sanitize_text_field( $config['updated_at'] ?? '' );

		// Sanitize taxonomy_filters.
		$config['taxonomy_filters'] = $this->sanitize_taxonomy_filters( $config['taxonomy_filters'] ?? array() );

		// Sanitize field_formatters — strip unknown formatter IDs, sanitize keys.
		// Supports mixed entries: strings (built-in) and associative arrays (object-type formatters).
		$raw_formatters             = $config['field_formatters'] ?? array();
		$config['field_formatters'] = array();
		if ( is_array( $raw_formatters ) ) {
			foreach ( $raw_formatters as $field_key => $formatters ) {
				$key = sanitize_text_field( $field_key );
				if ( is_array( $formatters ) && '' !== $key ) {
					$filtered = array();
					foreach ( $formatters as $entry ) {
						if ( is_string( $entry ) ) {
							// Built-in formatter: validate against known list.
							if ( in_array( $entry, RKX_AS_Field_Formatter::VALID_FORMATTERS, true ) ) {
								$filtered[] = $entry;
							}
						} elseif ( is_array( $entry ) ) {
							/**
							 * Filters an object-type formatter entry during sanitization.
							 *
							 * An installed handler validates and sanitizes the entry, returning
							 * a sanitized array. Returns null if no handler is registered,
							 * in which case the entry is stripped.
							 *
							 * @param array|null $sanitized The sanitized entry, or null to strip.
							 * @param array      $entry     The raw formatter entry with 'id' and 'config' keys.
							 */
							$sanitized_entry = apply_filters( 'rkx_as_formatter_sanitize', null, $entry );
							if ( is_array( $sanitized_entry ) ) {
								$filtered[] = $sanitized_entry;
							}
						}
					}
					if ( ! empty( $filtered ) ) {
						$config['field_formatters'][ $key ] = $filtered;
					}
				}
			}
		}

		return $config;
	}

	/**
	 * Sanitize taxonomy filters map.
	 *
	 * Sanitizes each key with sanitize_key() and each term ID value with absint().
	 * Strips entries whose value arrays become empty after sanitization.
	 *
	 * @param array $filters The taxonomy filters map to sanitize.
	 * @return array The sanitized taxonomy filters map.
	 */
	public function sanitize_taxonomy_filters( array $filters ): array {
		$sanitized = array();

		foreach ( $filters as $taxonomy => $term_ids ) {
			$clean_key = sanitize_key( $taxonomy );

			if ( empty( $clean_key ) ) {
				continue;
			}

			if ( ! is_array( $term_ids ) ) {
				continue;
			}

			$clean_ids = array_values( array_map( 'absint', $term_ids ) );

			// Strip entries with empty arrays.
			if ( empty( $clean_ids ) ) {
				continue;
			}

			$sanitized[ $clean_key ] = $clean_ids;
		}

		return $sanitized;
	}

	/**
	 * Validate taxonomy filters map.
	 *
	 * Validates that each key is a taxonomy registered to the data source post type,
	 * and each value is an array of positive integers.
	 * Skips validation when the data source is not a post type.
	 *
	 * @param array  $filters     The taxonomy filters map to validate.
	 * @param string $data_source The data source slug.
	 * @return true|WP_Error True if valid, WP_Error on failure.
	 */
	public function validate_taxonomy_filters( array $filters, string $data_source ) {
		// Skip validation when data source is not a post type.
		$is_post_type = in_array( $data_source, array( 'posts', 'pages' ), true ) || post_type_exists( $data_source );

		if ( ! $is_post_type ) {
			return true;
		}

		// Empty filters are always valid.
		if ( empty( $filters ) ) {
			return true;
		}

		// Resolve the WordPress post type slug.
		$post_type_map = array(
			'posts' => 'post',
			'pages' => 'page',
		);
		$wp_post_type  = $post_type_map[ $data_source ] ?? $data_source;

		// Get taxonomies registered to this post type.
		$registered_taxonomies = get_object_taxonomies( $wp_post_type, 'objects' );
		if ( ! is_array( $registered_taxonomies ) ) {
			$registered_taxonomies = array();
		}
		$registered_slugs = array_keys( $registered_taxonomies );

		foreach ( $filters as $taxonomy => $term_ids ) {
			// Validate that the taxonomy is registered to the data source post type.
			if ( ! in_array( $taxonomy, $registered_slugs, true ) ) {
				return new WP_Error(
					'invalid_config',
					sprintf(
						/* translators: 1: taxonomy slug, 2: post type slug */
						__( "Taxonomy '%1\$s' is not registered to the '%2\$s' data source.", 'rkx-api-studio' ),
						$taxonomy,
						$data_source
					),
					array( 'status' => 400 )
				);
			}

			// Validate that the value is an array.
			if ( ! is_array( $term_ids ) ) {
				return new WP_Error(
					'invalid_config',
					__( 'Taxonomy filter values must be arrays of positive integers.', 'rkx-api-studio' ),
					array( 'status' => 400 )
				);
			}

			// Validate that each element is a positive integer.
			foreach ( $term_ids as $term_id ) {
				if ( ! is_int( $term_id ) || $term_id <= 0 ) {
					return new WP_Error(
						'invalid_config',
						__( 'Taxonomy filter values must be arrays of positive integers.', 'rkx-api-studio' ),
						array( 'status' => 400 )
					);
				}
			}
		}

		return true;
	}
}
