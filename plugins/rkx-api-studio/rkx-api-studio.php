<?php
/**
 * Plugin Name: RKX API Studio
 * Plugin URI: https://rkxbeta.com/plugins/rkx-api-studio
 * Description: Create custom, clean REST API endpoints visually.
 * Version: 1.0.0
 * Requires at least: 6.8
 * Requires PHP: 8.0
 * Author: RKXBeta
 * Author URI: https://rkxbeta.com/
 * License: GPL-2.0-or-later
 * License URI: https://www.gnu.org/licenses/gpl-2.0.html
 * Text Domain: rkx-api-studio
 * Domain Path: /languages
 *
 * @package RKX_API_Studio
 */

defined( 'ABSPATH' ) || exit;

define( 'RKX_AS_VERSION', '1.0.0' );
define( 'RKX_AS_PLUGIN_DIR', plugin_dir_path( __FILE__ ) );
define( 'RKX_AS_PLUGIN_URL', plugin_dir_url( __FILE__ ) );
if ( ! defined( 'RKX_AS_PLUGIN_BASENAME' ) ) {
	define( 'RKX_AS_PLUGIN_BASENAME', plugin_basename( __FILE__ ) );
}
define( 'RKX_AS_OPTION_KEY', 'rkx_as_endpoint_configs' );
define( 'RKX_AS_REST_NAMESPACE', 'rkx-api-studio/v1' );

add_filter(
	'rest_allowed_cors_headers',
	static function ( $headers ) {
		return array_unique(
			array_merge(
				$headers,
				array(
					'X-RKX-API-Studio-Key',
				)
			)
		);
	}
);

require_once __DIR__ . '/includes/functions.php';

require_once __DIR__ . '/includes/class-data-sources.php';
require_once __DIR__ . '/includes/class-admin-page.php';
require_once __DIR__ . '/includes/class-config-controller.php';
require_once __DIR__ . '/includes/class-settings-controller.php';
require_once __DIR__ . '/includes/class-route-registrar.php';
require_once __DIR__ . '/includes/class-field-mapper.php';
require_once __DIR__ . '/includes/class-field-formatter.php';
require_once __DIR__ . '/includes/class-cache-manager.php';
require_once __DIR__ . '/includes/class-security-key-manager.php';

add_action(
	'plugins_loaded',
	static function () {
		( new RKX_AS_Admin_Page() )->register();
		$cache = new RKX_AS_Cache_Manager();
		add_action(
			'save_post',
			static function ( $id, $post ) use ( $cache ) {
				$cache->invalidate_by_data_source( $post->post_type );
			},
			10,
			2
		);
		add_action(
			'before_delete_post',
			static function ( $id, $post ) use ( $cache ) {
				$cache->invalidate_by_data_source( $post->post_type );
			},
			10,
			2
		);
		$invalidate_term = static function ( $id, $tt_id, $taxonomy ) use ( $cache ) {
			$cache->invalidate_by_data_source( $taxonomy );
		};
		add_action( 'created_term', $invalidate_term, 10, 3 );
		add_action( 'edited_term', $invalidate_term, 10, 3 );
		add_action( 'delete_term', $invalidate_term, 10, 3 );
	}
);

add_action(
	'rest_api_init',
	static function () {
		( new RKX_AS_Config_Controller() )->register_routes();
		( new RKX_AS_Settings_Controller() )->register_routes();
		( new RKX_AS_Security_Key_Manager() )->register_routes();
		( new RKX_AS_Route_Registrar() )->register();
	}
);
