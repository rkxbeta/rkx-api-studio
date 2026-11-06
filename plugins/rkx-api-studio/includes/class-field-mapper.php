<?php
/**
 * Field mapper for transforming WordPress data objects into clean API responses.
 *
 * @package RKX_API_Studio
 */

defined( 'ABSPATH' ) || exit;

/**
 * Maps WordPress post and term objects to clean associative arrays
 * based on user-configured field selections.
 */
class RKX_AS_Field_Mapper {

	/**
	 * Available fields for post-type data sources (posts, pages).
	 *
	 * @var array<string, array{label: string, type: string}>
	 */
	const POST_TYPE_FIELDS = array(
		'id'                 => array(
			'label' => 'ID',
			'type'  => 'integer',
		),
		'title'              => array(
			'label' => 'Title',
			'type'  => 'string',
		),
		'content'            => array(
			'label' => 'Content',
			'type'  => 'string',
		),
		'excerpt'            => array(
			'label' => 'Excerpt',
			'type'  => 'string',
		),
		'featured_image_url' => array(
			'label' => 'Featured Image URL',
			'type'  => 'string',
		),
		'slug'               => array(
			'label' => 'Slug',
			'type'  => 'string',
		),
		'date'               => array(
			'label' => 'Date',
			'type'  => 'string',
		),
		'author'             => array(
			'label' => 'Author',
			'type'  => 'object',
		),
	);

	/**
	 * Available fields for taxonomy data sources (categories, tags, custom taxonomies).
	 *
	 * @var array<string, array{label: string, type: string}>
	 */
	const TAXONOMY_FIELDS = array(
		'id'          => array(
			'label' => 'ID',
			'type'  => 'integer',
		),
		'name'        => array(
			'label' => 'Name',
			'type'  => 'string',
		),
		'slug'        => array(
			'label' => 'Slug',
			'type'  => 'string',
		),
		'description' => array(
			'label' => 'Description',
			'type'  => 'string',
		),
		'count'       => array(
			'label' => 'Count',
			'type'  => 'integer',
		),
		'parent'      => array(
			'label' => 'Parent',
			'type'  => 'integer',
		),
	);

	/**
	 * Maps a WP_Post to a clean associative array based on selected fields.
	 *
	 * Returns keys in the same order as the $fields array. Unknown fields
	 * are silently skipped.
	 *
	 * @param WP_Post $post                     The WordPress post object.
	 * @param array   $fields                   Ordered array of field identifiers to include.
	 * @param array   $field_formatters          Map of field identifier to formatter ID list.
	 * @param array   $extension_context   Opaque context passed to installed field extensions.
	 * @return array Associative array with clean output keys.
	 */
	public function map_post(
		WP_Post $post,
		array $fields,
		array $field_formatters = array(),
		array $extension_context = array()
	): array {
		$result = array();

		foreach ( $fields as $field ) {
			// Handle meta:{key} fields.
			if ( str_starts_with( $field, 'meta:' ) ) {
				$meta_key = substr( $field, strlen( 'meta:' ) );
				if ( ! RKX_AS_Data_Sources::is_allowed_meta_key( $meta_key, 'post' ) ) {
					continue;
				}
				$value = get_post_meta( $post->ID, $meta_key, true );
				$value = ( '' === $value ) ? null : $value;

				$result[ $meta_key ] = RKX_AS_Field_Formatter::apply( $value, $field_formatters[ $field ] ?? array() );
				continue;
			}

			// Handle taxonomy:{slug} fields — formatters are not applied to term arrays.
			if ( str_starts_with( $field, 'taxonomy:' ) ) {
				$taxonomy_slug            = substr( $field, strlen( 'taxonomy:' ) );
				$result[ $taxonomy_slug ] = $this->map_taxonomy_field( $post->ID, $taxonomy_slug );
				continue;
			}

			if ( ! array_key_exists( $field, self::POST_TYPE_FIELDS ) ) {
				/** This filter lets installed extensions map additional fields. */
				$result = apply_filters(
					'rkx_as_map_post_field',
					$result,
					$post,
					$field,
					$field_formatters,
					$extension_context
				);
				continue;
			}

			switch ( $field ) {
				case 'id':
					$result['id'] = $post->ID;
					break;

				case 'title':
					$result['title'] = RKX_AS_Field_Formatter::apply(
						$post->post_title,
						$field_formatters['title'] ?? array()
					);
					break;

				case 'content':
					$result['content'] = RKX_AS_Field_Formatter::apply(
						$post->post_content,
						$field_formatters['content'] ?? array()
					);
					break;

				case 'excerpt':
					$result['excerpt'] = RKX_AS_Field_Formatter::apply(
						$post->post_excerpt,
						$field_formatters['excerpt'] ?? array()
					);
					break;

				case 'featured_image_url':
					$thumbnail_id                 = get_post_thumbnail_id( $post->ID );
					$url                          = $thumbnail_id ? wp_get_attachment_url( $thumbnail_id ) : '';
					$result['featured_image_url'] = RKX_AS_Field_Formatter::apply(
						$url ? $url : '',
						$field_formatters['featured_image_url'] ?? array()
					);
					break;

				case 'slug':
					$result['slug'] = RKX_AS_Field_Formatter::apply(
						$post->post_name,
						$field_formatters['slug'] ?? array()
					);
					break;

				case 'date':
					$result['date'] = RKX_AS_Field_Formatter::apply(
						$post->post_date,
						$field_formatters['date'] ?? array()
					);
					break;

				case 'author':
					if ( 0 === (int) $post->post_author ) {
						$result['author'] = null;
						break;
					}

					$user = get_userdata( (int) $post->post_author );
					if ( ! $user ) {
						$result['author'] = null;
						break;
					}

					$avatar_url = get_avatar_url( $user->ID, array( 'size' => 96 ) );

					$result['author'] = array(
						'id'         => (int) $user->ID,
						'name'       => $user->display_name,
						'slug'       => $user->user_nicename,
						'avatar_url' => $avatar_url ? $avatar_url : '',
					);
					break;
			}
		}

		return $result;
	}

	/**
	 * Maps taxonomy terms for a given post and taxonomy slug.
	 *
	 * Returns an array of term objects, each containing 'id', 'name', and 'slug'.
	 * Returns an empty array on WP_Error or when no terms are assigned.
	 *
	 * @param int    $post_id       The post ID.
	 * @param string $taxonomy_slug The taxonomy slug.
	 * @return array Array of term associative arrays.
	 */
	public function map_taxonomy_field( int $post_id, string $taxonomy_slug ): array {
		if ( ! RKX_AS_Data_Sources::is_allowed_taxonomy( $taxonomy_slug ) ) {
			return array();
		}
		$terms = wp_get_object_terms( $post_id, $taxonomy_slug );

		if ( is_wp_error( $terms ) || empty( $terms ) ) {
			return array();
		}

		$mapped = array();
		foreach ( $terms as $term ) {
			$mapped[] = array(
				'id'   => $term->term_id,
				'name' => $term->name,
				'slug' => $term->slug,
			);
		}

		return $mapped;
	}

	/**
	 * Maps a WP_Term to a clean associative array based on selected fields.
	 *
	 * Returns keys in the same order as the $fields array. Unknown fields
	 * are silently skipped.
	 *
	 * @param WP_Term $term             The WordPress term object.
	 * @param array   $fields           Ordered array of field identifiers to include.
	 * @param array   $field_formatters Map of field identifier to formatter ID list.
	 * @return array Associative array with clean output keys.
	 */
	public function map_term( WP_Term $term, array $fields, array $field_formatters = array() ): array {
		$result = array();

		foreach ( $fields as $field ) {
			// Handle meta:{key} fields.
			if ( str_starts_with( $field, 'meta:' ) ) {
				$meta_key = substr( $field, strlen( 'meta:' ) );
				if ( ! RKX_AS_Data_Sources::is_allowed_meta_key( $meta_key, 'term' ) ) {
					continue;
				}
				$value = get_term_meta( $term->term_id, $meta_key, true );
				$value = ( '' === $value ) ? null : $value;

				$result[ $meta_key ] = RKX_AS_Field_Formatter::apply( $value, $field_formatters[ $field ] ?? array() );
				continue;
			}

			if ( ! array_key_exists( $field, self::TAXONOMY_FIELDS ) ) {
				continue;
			}

			switch ( $field ) {
				case 'id':
					$result['id'] = $term->term_id;
					break;

				case 'name':
					$result['name'] = RKX_AS_Field_Formatter::apply(
						$term->name,
						$field_formatters['name'] ?? array()
					);
					break;

				case 'slug':
					$result['slug'] = RKX_AS_Field_Formatter::apply(
						$term->slug,
						$field_formatters['slug'] ?? array()
					);
					break;

				case 'description':
					$result['description'] = RKX_AS_Field_Formatter::apply(
						$term->description,
						$field_formatters['description'] ?? array()
					);
					break;

				case 'count':
					$result['count'] = $term->count;
					break;

				case 'parent':
					$result['parent'] = $term->parent;
					break;
			}
		}

		return $result;
	}

	/**
	 * Returns the list of available fields for a given data source type.
	 *
	 * Post-type sources (posts, pages) return POST_TYPE_FIELDS.
	 * Taxonomy sources (categories, tags, custom taxonomies) return TAXONOMY_FIELDS.
	 *
	 * @param string $source_type The data source type identifier.
	 * @return array<string, array{label: string, type: string}> Available field definitions.
	 */
	public static function get_available_fields( string $source_type ): array {
		if ( 'posts' === $source_type || 'pages' === $source_type ) {
			return self::POST_TYPE_FIELDS;
		}

		// Categories, tags, and any custom taxonomy use taxonomy fields.
		return self::TAXONOMY_FIELDS;
	}
}
