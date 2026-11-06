import type { HttpMethod } from '../types';
import { METHOD_COLORS } from '../types';

interface MethodBadgeProps {
	method?: HttpMethod | string;
}

const DEFAULT_COLOR = '#6b7280';

export function MethodBadge( { method }: MethodBadgeProps ) {
	const displayMethod = ( method || 'GET' ).toUpperCase();
	const color = METHOD_COLORS[ displayMethod as HttpMethod ] || DEFAULT_COLOR;

	return (
		<span
			className="rkx-as-method-badge"
			style={ { backgroundColor: color } }
		>
			{ displayMethod }
		</span>
	);
}
