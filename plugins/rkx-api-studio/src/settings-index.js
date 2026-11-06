import { createRoot, createElement } from '@wordpress/element';
import { SettingsApp } from './components/settings/SettingsApp';
import './settings-style.css';

const mount = () => {
	const container = document.getElementById( 'rkx-as-settings-app' );
	if ( container ) {
		const root = createRoot( container );
		root.render( createElement( SettingsApp ) );
	}
};
if ( document.readyState === 'loading' ) {
	document.addEventListener( 'DOMContentLoaded', mount, { once: true } );
} else {
	mount();
}
