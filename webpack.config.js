const base = require( '@wordpress/scripts/config/webpack.config' );
const path = require( 'path' );

// Keep the plugin path unchanged: webpack derives module IDs from it, and the
// committed build/ must stay byte-identical to the WordPress.org release.
const plugin = 'plugins/rkx-api-studio';

module.exports = {
	...base,
	entry: {
		index: path.resolve( __dirname, plugin, 'src/index.js' ),
		'settings-index': path.resolve( __dirname, plugin, 'src/settings-index.js' ),
	},
	output: {
		...base.output,
		path: path.resolve( __dirname, plugin, 'build' ),
	},
};
