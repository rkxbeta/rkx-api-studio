import { applyFilters } from '@wordpress/hooks';
import type { HttpMethod } from '../types';
import { METHOD_COLORS } from '../types';
import { RKX_AS_HOOK_METHODS } from '../hooks/rkx-as-hooks';

const KNOWN_METHODS: HttpMethod[] = [ 'GET', 'POST', 'PUT', 'DELETE' ];

/**
 * HTTP methods that have an installed request handler.
 *
 * RKX API Studio serves GET endpoints. An installed extension that
 * implements additional methods may add them through `rkxAs.endpoint.methods`.
 */
export function getAvailableMethods(): HttpMethod[] {
	const filtered = applyFilters( RKX_AS_HOOK_METHODS, [ 'GET' ] );
	const list = Array.isArray( filtered ) ? filtered.map( String ) : [];
	return KNOWN_METHODS.filter( ( m ) => m === 'GET' || list.includes( m ) );
}

interface MethodSelectorProps {
	method: HttpMethod;
	onChange: ( method: HttpMethod ) => void;
}

/**
 * Method selector. Renders only the methods that can actually be served;
 * with GET as the only available method nothing is rendered.
 * @param root0
 * @param root0.method
 * @param root0.onChange
 */
export function MethodSelector( { method, onChange }: MethodSelectorProps ) {
	const availableMethods = getAvailableMethods();

	if ( availableMethods.length < 2 ) {
		return null;
	}

	return (
		<div className="rkx-as-method-selector">
			<div className="rkx-as-method-selector__segments">
				{ availableMethods.map( ( m ) => {
					const isActive = m === method;
					const color = METHOD_COLORS[ m ];
					const segmentStyle: React.CSSProperties = isActive
						? {
								backgroundColor: color,
								color: '#fff',
								borderColor: color,
						  }
						: {
								backgroundColor: 'transparent',
								color,
								borderColor: '#d0d5dd',
						  };

					return (
						<button
							key={ m }
							type="button"
							className={ `rkx-as-method-selector__segment${
								isActive
									? ' rkx-as-method-selector__segment--active'
									: ''
							}` }
							style={ segmentStyle }
							onClick={ () => onChange( m ) }
							aria-pressed={ isActive }
							aria-label={ m }
						>
							<span className="rkx-as-method-selector__label">
								{ m }
							</span>
						</button>
					);
				} ) }
			</div>
		</div>
	);
}
