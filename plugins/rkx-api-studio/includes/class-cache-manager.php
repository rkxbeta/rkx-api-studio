<?php
/**
 * Cache manager for transient-based API response caching.
 *
 * Handles cache key generation, transient storage and retrieval,
 * index management, and cache invalidation.
 *
 * @package RKX_API_Studio
 */

defined( 'ABSPATH' ) || exit;

/**
 * Manages cached API responses using WordPress transients
 * with an index stored in wp_options for efficient bulk operations.
 */
class RKX_AS_Cache_Manager {

	/**
	 * The wp_options key used to store the cache index.
	 *
	 * @var string
	 */
	const INDEX_OPTION_KEY = 'rkx_as_cache_index';

	/**
	 * Prefix for all cache transient keys.
	 *
	 * @var string
	 */
	const KEY_PREFIX = 'rkx_as_api_';

	/**
	 * Maximum transient key length to comply with WordPress limits.
	 *
	 * @var int
	 */
	const MAX_KEY_LENGTH = 172;

	/**
	 * Maps data source identifiers to WordPress post types.
	 *
	 * Mirrors the SOURCE_TO_POST_TYPE constant in RKX_AS_Route_Registrar.
	 *
	 * @var array<string, string>
	 */
	private const SOURCE_TO_POST_TYPE = RKX_AS_Data_Sources::POST_TYPES;

	/**
	 * Maps data source identifiers to WordPress taxonomies.
	 *
	 * Mirrors the SOURCE_TO_TAXONOMY constant in RKX_AS_Route_Registrar.
	 *
	 * @var array<string, string>
	 */
	private const SOURCE_TO_TAXONOMY = RKX_AS_Data_Sources::TAXONOMIES;

	/**
	 * Generate a deterministic, length-capped cache key.
	 *
	 * @param string $endpoint_slug The endpoint slug.
	 * @param int    $page          The page number.
	 * @param array  $params        Query parameters used to derive the hash.
	 * @return string Cache key truncated to MAX_KEY_LENGTH characters.
	 */
	public function generate_key( string $endpoint_slug, int $page, array $params ): string {
		ksort( $params, SORT_STRING );

		// Encode delimiters so distinct request parameter maps cannot share a key.
		$params_string = http_build_query( $params, '', '&', PHP_QUERY_RFC3986 );
		$hash          = md5( $params_string );

		$key = self::KEY_PREFIX . $endpoint_slug . '_' . $page . '_' . $hash;

		if ( strlen( $key ) > self::MAX_KEY_LENGTH ) {
			$key = substr( $key, 0, self::MAX_KEY_LENGTH );
		}

		return $key;
	}

	/**
	 * Retrieve a cached response.
	 *
	 * @param string $cache_key The cache key.
	 * @return array|false Cached response data or false on miss.
	 */
	public function get( string $cache_key ) {
		$data = get_transient( $cache_key );

		if ( ! is_array( $data ) ) {
			return false;
		}

		return $data;
	}

	/**
	 * Store a response in the transient cache and update the index.
	 *
	 * @param string $cache_key     The cache key.
	 * @param array  $data          The response data to cache.
	 * @param string $endpoint_slug The endpoint slug used for index grouping.
	 * @param int    $ttl           Time to live in seconds.
	 * @return bool True on success, false on failure.
	 */
	public function set( string $cache_key, array $data, string $endpoint_slug, int $ttl ): bool {
		$result = set_transient( $cache_key, $data, $ttl );

		if ( false === $result ) {
			if ( defined( 'WP_DEBUG' ) && WP_DEBUG && defined( 'WP_DEBUG_LOG' ) && WP_DEBUG_LOG ) {
				// phpcs:ignore WordPress.PHP.DevelopmentFunctions.error_log_error_log -- Debug-only diagnostic.
				error_log( 'RKX API Studio: response cache could not be stored.' );
			}
			return false;
		}

		$this->add_to_index( $endpoint_slug, $cache_key );

		return true;
	}

	/**
	 * Get the current cache index.
	 *
	 * @return array<string, string[]> Map of endpoint_slug to cache key arrays.
	 */
	public function get_index(): array {
		$index = get_option( self::INDEX_OPTION_KEY, array() );

		if ( ! is_array( $index ) ) {
			return array();
		}

		return $index;
	}

	/**
	 * Add a cache key to the index under the given endpoint slug.
	 *
	 * @param string $endpoint_slug The endpoint slug.
	 * @param string $cache_key     The cache key to register.
	 * @return void
	 */
	private function add_to_index( string $endpoint_slug, string $cache_key ): void {
		$index = $this->get_index();

		if ( ! isset( $index[ $endpoint_slug ] ) ) {
			$index[ $endpoint_slug ] = array();
		}

		if ( ! in_array( $cache_key, $index[ $endpoint_slug ], true ) ) {
			// Bound attacker-controlled query variants and prune expired index growth.
			$excess = count( $index[ $endpoint_slug ] ) - 199;
			while ( $excess-- > 0 ) {
				delete_transient( array_shift( $index[ $endpoint_slug ] ) );
			}
			$index[ $endpoint_slug ][] = $cache_key;
		}

		update_option( self::INDEX_OPTION_KEY, $index );
	}

	/**
	 * Remove all index entries for a given endpoint slug.
	 *
	 * @param string $endpoint_slug The endpoint slug to remove from the index.
	 * @return void
	 */
	private function remove_endpoint_from_index( string $endpoint_slug ): void {
		$index = $this->get_index();

		if ( ! isset( $index[ $endpoint_slug ] ) ) {
			return;
		}

		unset( $index[ $endpoint_slug ] );

		update_option( self::INDEX_OPTION_KEY, $index );
	}

	/**
	 * Delete all cached transients for a specific endpoint slug.
	 *
	 * @param string $endpoint_slug The endpoint slug whose cache to clear.
	 * @return int Number of deleted transients.
	 */
	public function clear_endpoint( string $endpoint_slug ): int {
		$index = $this->get_index();

		if ( ! isset( $index[ $endpoint_slug ] ) ) {
			return 0;
		}

		$keys    = $index[ $endpoint_slug ];
		$deleted = 0;

		foreach ( $keys as $cache_key ) {
			if ( delete_transient( $cache_key ) ) {
				++$deleted;
			}
		}

		$this->remove_endpoint_from_index( $endpoint_slug );

		return $deleted;
	}

	/**
	 * Delete all cached transients across every endpoint.
	 *
	 * @return int Total number of deleted transients.
	 */
	public function clear_all(): int {
		$index   = $this->get_index();
		$deleted = 0;

		foreach ( $index as $slug => $keys ) {
			if ( ! is_array( $keys ) ) {
				continue;
			}

			foreach ( $keys as $cache_key ) {
				if ( delete_transient( $cache_key ) ) {
					++$deleted;
				}
			}
		}

		update_option( self::INDEX_OPTION_KEY, array() );

		return $deleted;
	}

	/**
	 * Resolve a config's data_source to the actual WordPress type slug.
	 *
	 * @param string $data_source The data_source field from the endpoint config.
	 * @param array  $config      The full endpoint configuration array.
	 * @return string The resolved WordPress post type or taxonomy slug.
	 */
	private function resolve_data_source( string $data_source, array $config ): string {
		// Check built-in post type map.
		if ( isset( self::SOURCE_TO_POST_TYPE[ $data_source ] ) ) {
			return self::SOURCE_TO_POST_TYPE[ $data_source ];
		}

		// Check built-in taxonomy map.
		if ( isset( self::SOURCE_TO_TAXONOMY[ $data_source ] ) ) {
			return self::SOURCE_TO_TAXONOMY[ $data_source ];
		}

		// Legacy custom_taxonomy: the actual taxonomy slug is in the config.
		if ( 'custom_taxonomy' === $data_source && ! empty( $config['custom_taxonomy'] ) ) {
			return $config['custom_taxonomy'];
		}

		// Dynamic CPT or taxonomy: data_source is the slug itself.
		return $data_source;
	}

	/**
	 * Invalidate caches for all endpoints matching a given data source slug.
	 *
	 * @param string $data_source WordPress post type or taxonomy slug.
	 * @return void
	 */
	public function invalidate_by_data_source( string $data_source ): void {
		$configs = get_option( RKX_AS_OPTION_KEY, array() );

		if ( empty( $configs ) || ! is_array( $configs ) ) {
			return;
		}

		foreach ( $configs as $config ) {
			if ( empty( $config['slug'] ) || empty( $config['data_source'] ) ) {
				continue;
			}

			$resolved = $this->resolve_data_source( $config['data_source'], $config );

			if ( $resolved === $data_source ) {
				$this->clear_endpoint( $config['slug'] );
			}
		}
	}
}
