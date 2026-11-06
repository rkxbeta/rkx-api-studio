<?php
/**
 * Shared data source lookup tables and visibility rules.
 *
 * @package RKX_API_Studio
 */

defined( 'ABSPATH' ) || exit;

/**
 * Shared WordPress source lookup tables.
 *
 * Only post types and taxonomies that WordPress itself marks as public and
 * exposed in the REST API may be used as endpoint data sources.
 */
class RKX_AS_Data_Sources {
	public const POST_TYPES = array(
		'posts' => 'post',
		'pages' => 'page',
	);
	public const TAXONOMIES = array(
		'categories' => 'category',
		'tags'       => 'post_tag',
	);

	/**
	 * Internal post types that are never offered as data sources.
	 *
	 * @var string[]
	 */
	public const EXCLUDED_POST_TYPES = array(
		'attachment',
		'wp_block',
		'wp_template',
		'wp_template_part',
		'wp_navigation',
		'wp_font_family',
		'wp_font_face',
		'wp_global_styles',
	);

	/**
	 * Internal taxonomies that are never offered as data sources.
	 *
	 * @var string[]
	 */
	public const EXCLUDED_TAXONOMIES = array(
		'post_format',
		'nav_menu',
		'link_category',
		'wp_theme',
		'wp_template_part_area',
		'wp_pattern_category',
	);

	/**
	 * Whether a WordPress post type may be exposed through an endpoint.
	 *
	 * @param string $post_type WordPress post type name.
	 * @return bool
	 */
	public static function is_allowed_post_type( string $post_type ): bool {
		if ( in_array( $post_type, self::EXCLUDED_POST_TYPES, true ) ) {
			return false;
		}
		$object = get_post_type_object( $post_type );
		return $object instanceof WP_Post_Type && ! empty( $object->public ) && ! empty( $object->show_in_rest );
	}

	/**
	 * Whether a WordPress taxonomy may be exposed through an endpoint.
	 *
	 * @param string $taxonomy WordPress taxonomy name.
	 * @return bool
	 */
	public static function is_allowed_taxonomy( string $taxonomy ): bool {
		if ( in_array( $taxonomy, self::EXCLUDED_TAXONOMIES, true ) ) {
			return false;
		}
		$object = get_taxonomy( $taxonomy );
		return $object instanceof WP_Taxonomy && ! empty( $object->public ) && ! empty( $object->show_in_rest );
	}

	/**
	 * Resolve a data source identifier to an allowed post type.
	 *
	 * @param string $source Data source identifier.
	 * @return string|null WordPress post type, or null when not an allowed post type.
	 */
	public static function resolve_post_type( string $source ): ?string {
		$post_type = self::POST_TYPES[ $source ] ?? $source;
		return self::is_allowed_post_type( $post_type ) ? $post_type : null;
	}

	/**
	 * Resolve a data source identifier to an allowed taxonomy.
	 *
	 * @param string $source Data source identifier.
	 * @param array  $config Optional endpoint configuration (legacy custom_taxonomy support).
	 * @return string|null WordPress taxonomy, or null when not an allowed taxonomy.
	 */
	public static function resolve_taxonomy( string $source, array $config = array() ): ?string {
		$taxonomy = self::TAXONOMIES[ $source ] ?? $source;
		if ( 'custom_taxonomy' === $source ) {
			$taxonomy = (string) ( $config['custom_taxonomy'] ?? '' );
		}
		return '' !== $taxonomy && self::is_allowed_taxonomy( $taxonomy ) ? $taxonomy : null;
	}

	/**
	 * Whether a meta key may be exposed for the given object type.
	 *
	 * Protected keys (for example keys starting with an underscore, or keys a
	 * plugin marks protected through the is_protected_meta filter) are rejected.
	 *
	 * @param string $meta_key  Meta key.
	 * @param string $meta_type Object type: post or term.
	 * @return bool
	 */
	public static function is_allowed_meta_key( string $meta_key, string $meta_type ): bool {
		return '' !== trim( $meta_key ) && ! is_protected_meta( $meta_key, $meta_type );
	}
}
