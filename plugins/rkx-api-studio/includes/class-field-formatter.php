<?php
/**
 * Field formatter pipeline for applying text transformations to API response values.
 *
 * @package RKX_API_Studio
 */

defined( 'ABSPATH' ) || exit;

/**
 * Stateless registry of built-in field formatters.
 *
 * Formatters are applied in array order to string scalar values only.
 * Non-string values (integers, arrays, objects) are returned unchanged.
 */
class RKX_AS_Field_Formatter {

	const VALID_FORMATTERS = array(
		'strip_html',
		'remove_blocks',
		'normalize_whitespace',
		'excerpt',
		'truncate_200',
		'format_date',
		'uppercase',
		'lowercase',
		'slugify',
		'remove_special_chars',
	);

	/**
	 * Whether an object-type formatter entry has an installed handler.
	 *
	 * Built-in formatters are plain string IDs. Object entries (for example
	 * {"id":"…","config":{…}}) are processed only by an installed extension
	 * that declares support through the rkx_as_formatter_supported filter.
	 *
	 * @param array $entry Formatter entry.
	 * @return bool
	 */
	public static function is_supported_entry( array $entry ): bool {
		return isset( $entry['id'] ) && is_string( $entry['id'] ) &&
			(bool) apply_filters( 'rkx_as_formatter_supported', false, $entry );
	}

	/**
	 * Apply an ordered list of formatters to a value.
	 *
	 * Each entry in $formatters may be either a string (built-in formatter ID)
	 * or an associative array (object-type formatter delegated via filter hook).
	 *
	 * @param mixed $value      The raw field value.
	 * @param array $formatters Ordered list of formatter entries to apply.
	 * @return mixed Formatted value, or original if not a string.
	 */
	public static function apply( $value, array $formatters ) {
		if ( ! is_string( $value ) || empty( $formatters ) ) {
			return $value;
		}

		foreach ( $formatters as $entry ) {
			if ( is_array( $entry ) ) {
				/**
				 * Filters the value through an external formatter handler (installed extension).
				 *
				 * @param string $value The current string value in the pipeline.
				 * @param array  $entry The formatter entry containing 'id' and 'config' keys.
				 */
				$value = apply_filters( 'rkx_as_apply_formatter', $value, $entry );
			} else {
				$value = self::run( $value, $entry );
			}
		}

		return $value;
	}

	/**
	 * Apply a single formatter transform to a string value.
	 *
	 * @param string $value The string to transform.
	 * @param string $id    The formatter identifier.
	 * @return string The transformed string.
	 */
	private static function run( string $value, string $id ): string {
		switch ( $id ) {
			case 'strip_html':
				return wp_strip_all_tags( $value );

			case 'remove_blocks':
				// Remove Gutenberg block comment delimiters (<!-- wp:... --> and <!-- /wp:... -->).
				return preg_replace( '/<!--\s*\/?wp:[^>]*?-->/is', '', $value );

			case 'normalize_whitespace':
				// Collapse all whitespace sequences (newlines, tabs, multiple spaces) to a single space.
				return trim( preg_replace( '/\s+/', ' ', $value ) );

			case 'excerpt':
				return wp_trim_words( $value, 55 );

			case 'truncate_200':
				return mb_strimwidth( $value, 0, 200, '…' );

			case 'format_date':
				$timestamp = strtotime( $value );
				return $timestamp ? date_i18n( get_option( 'date_format' ), $timestamp ) : $value;

			case 'uppercase':
				return mb_strtoupper( $value );

			case 'lowercase':
				return mb_strtolower( $value );

			case 'slugify':
				return sanitize_title( $value );

			case 'remove_special_chars':
				return preg_replace( '/[^a-zA-Z0-9\s]/u', '', $value );

			default:
				return $value;
		}
	}
}
