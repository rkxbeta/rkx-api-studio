import { createRoot, createElement } from '@wordpress/element';
import * as dndKitCore from '@dnd-kit/core';
import { App } from './components/App';
import './style.css';

// Expose @dnd-kit/core for Pro extensions to share the exact same React context.
if ( typeof window !== 'undefined' ) {
	window.rkxAsDndKitCore = dndKitCore;
}

const mount = () => {
	const container = document.getElementById( 'rkx-as-app' );
	if ( container ) {
		const root = createRoot( container );
		root.render( createElement( App ) );
	}
};
if ( document.readyState === 'loading' ) {
	document.addEventListener( 'DOMContentLoaded', mount, { once: true } );
} else {
	mount();
}
