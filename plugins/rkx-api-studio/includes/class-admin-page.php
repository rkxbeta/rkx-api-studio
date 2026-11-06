<?php
/**
 * Admin page registration and rendering for RKX API Studio.
 *
 * @package RKX_API_Studio
 */

defined( 'ABSPATH' ) || exit;

/**
 * Handles the WordPress admin menu page, asset enqueueing,
 * and rendering of the React-based Builder UI.
 */
class RKX_AS_Admin_Page {

	/**
	 * Script handle used for enqueueing the admin JS bundle.
	 *
	 * @var string
	 */
	const SCRIPT_HANDLE = 'rkx-as-admin';

	/**
	 * Script handle used for enqueueing the settings JS bundle.
	 *
	 * @var string
	 */
	const SETTINGS_SCRIPT_HANDLE = 'rkx-as-settings-index';

	/**
	 * Hook suffixes for all registered pages.
	 *
	 * @var string[]
	 */
	private array $hook_suffixes = array();

	/**
	 * Hook suffix for the settings page.
	 *
	 * @var string
	 */
	private string $settings_hook_suffix = '';

	/**
	 * The documentation page URL.
	 *
	 * @var string
	 */
	const DOCS_URL = 'https://rkxbeta.com/plugins/rkx-api-studio/docs';

	/**
	 * Product page describing the separately distributed add-on.
	 *
	 * @var string
	 */
	const ADDON_URL = 'https://rkxbeta.com/plugins/rkx-api-studio';

	/**
	 * Free vs Pro comparison section on the official product page.
	 *
	 * @var string
	 */
	const COMPARE_URL = 'https://rkxbeta.com/plugins/rkx-api-studio#comparison';

	/**
	 * Optional override for whether the separate Pro add-on is active.
	 *
	 * @var bool|null
	 */
	private ?bool $pro_addon_active_override;

	/**
	 * Constructor.
	 *
	 * @param bool|null $pro_addon_active Optional override for testing.
	 */
	public function __construct( ?bool $pro_addon_active = null ) {
		$this->pro_addon_active_override = $pro_addon_active;
	}

	/**
	 * Whether the separately distributed Pro add-on plugin is active.
	 *
	 * @return bool
	 */
	public function is_pro_addon_active(): bool {
		if ( null !== $this->pro_addon_active_override ) {
			return $this->pro_addon_active_override;
		}

		return defined( 'RKX_AS_PRO_VERSION' );
	}

	/**
	 * Build localized navigation and product information URLs for the admin UI.
	 *
	 * Promotional URLs are omitted when the separate Pro add-on is active.
	 *
	 * @return array<string, string>
	 */
	public function get_navigation_urls(): array {
		$docs_url          = (string) apply_filters( 'rkx_as_documentation_url', self::DOCS_URL );
		$include_pro_links = ! $this->is_pro_addon_active();

		return array(
			'docsUrl'     => esc_url_raw( $docs_url ),
			'settingsUrl' => esc_url_raw( admin_url( 'admin.php?page=rkx-api-studio-settings' ) ),
			'proUrl'      => $include_pro_links ? esc_url_raw( self::ADDON_URL ) : '',
			'compareUrl'  => $include_pro_links ? esc_url_raw( self::COMPARE_URL ) : '',
		);
	}

	/**
	 * Register hooks with WordPress.
	 *
	 * @return void
	 */
	public function register(): void {
		add_action( 'admin_menu', array( $this, 'add_menu_pages' ) );
		$basename = defined( 'RKX_AS_PLUGIN_BASENAME' ) ? RKX_AS_PLUGIN_BASENAME : 'rkx-api-studio/rkx-api-studio.php';
		add_filter(
			'plugin_action_links_' . $basename,
			array( $this, 'filter_action_links' )
		);
	}

	/**
	 * Add the "RKX API Studio" menu and submenu items.
	 *
	 * @return void
	 */
	public function add_menu_pages(): void {
		// Top-level menu — shows the endpoint list.
		$main_hook = add_menu_page(
			__( 'RKX API Studio', 'rkx-api-studio' ),
			__( 'RKX API Studio', 'rkx-api-studio' ),
			'manage_options',
			'rkx-api-studio',
			array( $this, 'render_page' ),
			'dashicons-rest-api',
			80
		);

		if ( $main_hook ) {
			$this->hook_suffixes[] = $main_hook;
		}

		// Submenu: "All Endpoints" — same as the main page.
		$list_hook = add_submenu_page(
			'rkx-api-studio',
			__( 'All Endpoints', 'rkx-api-studio' ),
			__( 'All Endpoints', 'rkx-api-studio' ),
			'manage_options',
			'rkx-api-studio',
			array( $this, 'render_page' )
		);

		if ( $list_hook ) {
			$this->hook_suffixes[] = $list_hook;
		}

		// Submenu: "Create Endpoint" (or "Edit Endpoint" when editing).
		$create_hook = add_submenu_page(
			'rkx-api-studio',
			__( 'Create Endpoint', 'rkx-api-studio' ),
			__( 'Create Endpoint', 'rkx-api-studio' ),
			'manage_options',
			'rkx-api-studio-manage',
			array( $this, 'render_page' )
		);

		if ( $create_hook ) {
			$this->hook_suffixes[] = $create_hook;
		}

		// Submenu: "Settings" — plugin settings page.
		$settings_hook = add_submenu_page(
			'rkx-api-studio',
			__( 'Settings', 'rkx-api-studio' ),
			__( 'Settings', 'rkx-api-studio' ),
			'manage_options',
			'rkx-api-studio-settings',
			array( $this, 'render_settings_page' )
		);

		if ( $settings_hook ) {
			$this->settings_hook_suffix = $settings_hook;
		}

		// Dynamically update sidebar label and page title when editing an endpoint.
		if ( isset( $_GET['id'] ) && '' !== $_GET['id'] ) { // phpcs:ignore WordPress.Security.NonceVerification.Recommended
			global $submenu, $title;

			if ( ! empty( $submenu['rkx-api-studio'] ) ) {
				foreach ( $submenu['rkx-api-studio'] as $key => $item ) {
					if ( 'rkx-api-studio-manage' === $item[2] ) {
						$submenu['rkx-api-studio'][ $key ][0] = __( 'Edit Endpoint', 'rkx-api-studio' ); // phpcs:ignore WordPress.WP.GlobalVariablesOverride.Prohibited
						$submenu['rkx-api-studio'][ $key ][3] = __( 'Edit Endpoint', 'rkx-api-studio' ); // phpcs:ignore WordPress.WP.GlobalVariablesOverride.Prohibited
						break;
					}
				}
			}

			$title = __( 'Edit Endpoint', 'rkx-api-studio' ); // phpcs:ignore WordPress.WP.GlobalVariablesOverride.Prohibited
		}

		// Enqueue assets on all our pages.
		add_action( 'admin_enqueue_scripts', array( $this, 'enqueue_assets' ) );
	}

	/**
	 * Render the admin page content.
	 *
	 * @return void
	 */
	public function render_page(): void {
		if ( ! current_user_can( 'manage_options' ) ) {
			wp_die( esc_html__( 'You do not have permission to access this page.', 'rkx-api-studio' ), 403 ); // phpcs:ignore Generic.Files.LineLength.TooLong
		}

		echo '<div class="wrap">';
		do_action( 'rkx_as_before_admin_page' );
		echo '<div id="rkx-as-app"></div>';
		echo '</div>';
	}

	/**
	 * Render the settings page content.
	 *
	 * @return void
	 */
	public function render_settings_page(): void {
		if ( ! current_user_can( 'manage_options' ) ) {
			wp_die( esc_html__( 'You do not have permission to access this page.', 'rkx-api-studio' ), 403 ); // phpcs:ignore Generic.Files.LineLength.TooLong
		}

		echo '<div class="wrap">';
		do_action( 'rkx_as_before_admin_page' );
		echo '<div id="rkx-as-settings-app"></div>';
		echo '</div>';
	}

	/**
	 * Filter plugin action links on the WordPress Installed Plugins screen.
	 *
	 * Displays: Settings | Documentation | Explore Pro ↗ (only when Pro is inactive) | Deactivate
	 *
	 * @param array<string, string> $actions Existing action links.
	 * @return array<string, string> Modified action links.
	 */
	public function filter_action_links( array $actions ): array {
		$custom_links = array();

		if ( current_user_can( 'manage_options' ) ) {
			$custom_links['settings'] = sprintf(
				'<a href="%s">%s</a>',
				esc_url( admin_url( 'admin.php?page=rkx-api-studio-settings' ) ),
				esc_html__( 'Settings', 'rkx-api-studio' )
			);
		}

		$docs_url                      = (string) apply_filters( 'rkx_as_documentation_url', self::DOCS_URL );
		$custom_links['documentation'] = sprintf(
			'<a href="%s" target="_blank" rel="noopener noreferrer">%s</a>',
			esc_url( $docs_url ),
			esc_html__( 'Documentation', 'rkx-api-studio' )
		);

		// Link to the separately distributed Pro add-on when not active.
		if ( ! $this->is_pro_addon_active() ) {
			$custom_links['addon'] = sprintf(
				'<a href="%s" target="_blank" rel="noopener noreferrer">%s</a>',
				esc_url( self::ADDON_URL ),
				esc_html__( 'Explore Pro ↗', 'rkx-api-studio' )
			);
		}

		return array_merge( $custom_links, $actions );
	}

	/**
	 * Enqueue the compiled React bundle and stylesheet on plugin pages only.
	 *
	 * @param string $hook_suffix The current admin page hook suffix.
	 * @return void
	 */
	public function enqueue_assets( string $hook_suffix ): void {
		$is_settings_page = ( $hook_suffix === $this->settings_hook_suffix && '' !== $this->settings_hook_suffix );
		$is_main_page     = in_array( $hook_suffix, $this->hook_suffixes, true );

		if ( ! $is_settings_page && ! $is_main_page ) {
			return;
		}

		if ( $is_settings_page ) {
			$this->enqueue_settings_assets();
			return;
		}

		$asset_file = RKX_AS_PLUGIN_DIR . 'build/index.asset.php';
		$js_file    = RKX_AS_PLUGIN_DIR . 'build/index.js';
		$css_file   = RKX_AS_PLUGIN_DIR . 'build/style-index.css';

		if ( ! file_exists( $asset_file ) || ! file_exists( $js_file ) ) {
			add_action( 'admin_notices', array( $this, 'render_missing_build_notice' ) );
			return;
		}

		$asset = require $asset_file;

		wp_enqueue_script(
			self::SCRIPT_HANDLE,
			RKX_AS_PLUGIN_URL . 'build/index.js',
			$asset['dependencies'] ?? array(),
			$asset['version'] ?? RKX_AS_VERSION,
			true
		);

		wp_set_script_translations( self::SCRIPT_HANDLE, 'rkx-api-studio', RKX_AS_PLUGIN_DIR . 'languages' );

		if ( file_exists( $css_file ) ) {
			wp_enqueue_style(
				self::SCRIPT_HANDLE,
				RKX_AS_PLUGIN_URL . 'build/style-index.css',
				array( 'wp-components' ),
				$asset['version'] ?? RKX_AS_VERSION
			);
		}

		// Determine the current page slug.
		// phpcs:disable WordPress.Security.NonceVerification.Recommended -- read-only page slug for asset localisation, no data mutation.
		$current_page = isset( $_GET['page'] ) ? sanitize_text_field( wp_unslash( $_GET['page'] ) ) : 'rkx-api-studio';
		$edit_id      = isset( $_GET['id'] ) ? sanitize_text_field( wp_unslash( $_GET['id'] ) ) : '';
		// phpcs:enable WordPress.Security.NonceVerification.Recommended

		wp_localize_script(
			self::SCRIPT_HANDLE,
			'rkxApiStudio',
			array_merge(
				array(
					'restUrl'     => esc_url_raw( rest_url( RKX_AS_REST_NAMESPACE ) ),
					'nonce'       => wp_create_nonce( 'wp_rest' ),
					'baseSlug'    => RKX_AS_REST_NAMESPACE,
					'currentPage' => $current_page,
					'editId'      => $edit_id,
					'adminUrl'    => admin_url( 'admin.php' ),
				),
				$this->get_navigation_urls()
			)
		);

		do_action( 'rkx_as_enqueue_extensions', self::SCRIPT_HANDLE );
	}

	/**
	 * Enqueue the settings-specific React bundle and stylesheet.
	 *
	 * @return void
	 */
	private function enqueue_settings_assets(): void {
		$asset_file = RKX_AS_PLUGIN_DIR . 'build/settings-index.asset.php';
		$js_file    = RKX_AS_PLUGIN_DIR . 'build/settings-index.js';
		$css_file   = RKX_AS_PLUGIN_DIR . 'build/settings-index.css';

		if ( ! file_exists( $asset_file ) || ! file_exists( $js_file ) ) {
			add_action( 'admin_notices', array( $this, 'render_missing_build_notice' ) );
			return;
		}

		$asset = require $asset_file;

		wp_enqueue_script(
			self::SETTINGS_SCRIPT_HANDLE,
			RKX_AS_PLUGIN_URL . 'build/settings-index.js',
			$asset['dependencies'] ?? array(),
			$asset['version'] ?? RKX_AS_VERSION,
			true
		);

		wp_set_script_translations( self::SETTINGS_SCRIPT_HANDLE, 'rkx-api-studio', RKX_AS_PLUGIN_DIR . 'languages' );

		if ( file_exists( $css_file ) ) {
			wp_enqueue_style(
				self::SETTINGS_SCRIPT_HANDLE,
				RKX_AS_PLUGIN_URL . 'build/settings-index.css',
				array( 'wp-components' ),
				$asset['version'] ?? RKX_AS_VERSION
			);
		}

		wp_localize_script(
			self::SETTINGS_SCRIPT_HANDLE,
			'rkxApiStudio',
			array_merge(
				array(
					'restUrl' => esc_url_raw( rest_url( RKX_AS_REST_NAMESPACE ) ),
					'nonce'   => wp_create_nonce( 'wp_rest' ),
				),
				$this->get_navigation_urls()
			)
		);

		do_action( 'rkx_as_enqueue_extensions', self::SETTINGS_SCRIPT_HANDLE );
	}

	/**
	 * Display an admin notice when the React build files are missing.
	 *
	 * @return void
	 */
	public function render_missing_build_notice(): void {
		echo '<div class="notice notice-error">';
		echo '<p>';
		echo esc_html__(
			'RKX API Studio: Build files are missing. Please run "npm run build" in the plugin directory to compile the admin interface.',
			'rkx-api-studio'
		);
		echo '</p>';
		echo '</div>';
	}
}
