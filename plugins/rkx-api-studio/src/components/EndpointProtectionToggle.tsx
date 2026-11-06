import { ToggleControl } from '@wordpress/components';
import { __ } from '@wordpress/i18n';
import { applyFilters } from '@wordpress/hooks';
import { RKX_AS_HOOK_PROTECTION_FIELDS } from '../hooks/rkx-as-hooks';
import type { BuilderAction } from '../hooks/useEndpointBuilder';
import type { EndpointConfig } from '../types';

interface EndpointProtectionToggleProps {
	isProtected: boolean;
	onChange: ( value: boolean ) => void;
	hasApiKey: boolean;
	config?: EndpointConfig;
	dispatch?: React.Dispatch< BuilderAction >;
	isWriteMode?: boolean;
}

export function EndpointProtectionToggle( {
	isProtected,
	onChange,
	hasApiKey,
	config,
	dispatch,
	isWriteMode = false,
}: EndpointProtectionToggleProps ) {
	const getHelpText = () => {
		if ( isWriteMode ) {
			if ( ! hasApiKey ) {
				return __(
					'Endpoints using this method always require authentication. Generate an API key in the Security settings.',
					'rkx-api-studio'
				);
			}
			return __(
				'Endpoints using this method always require a valid API key.',
				'rkx-api-studio'
			);
		}
		if ( ! hasApiKey ) {
			return __(
				'An API key must be generated in the Security settings before enabling protection.',
				'rkx-api-studio'
			);
		}
		return isProtected
			? __(
					'This endpoint requires a valid API key for access.',
					'rkx-api-studio'
			  )
			: __(
					'This endpoint is publicly accessible without authentication.',
					'rkx-api-studio'
			  );
	};

	// Write mode: always checked, always disabled (auth is mandatory).
	// Read mode: disabled only when no API key exists.
	const isDisabled = isWriteMode ? true : ! hasApiKey;

	const effectiveProtected = isWriteMode ? true : isProtected;

	// Installed extensions may add protection settings of their own.
	const extensionContent = applyFilters(
		RKX_AS_HOOK_PROTECTION_FIELDS,
		null,
		{
			isProtected: effectiveProtected,
			config,
			dispatch,
		}
	) as React.ReactNode;

	return (
		<div className="rkx-as-endpoint-protection">
			<ToggleControl
				label={ __( 'Require API Key', 'rkx-api-studio' ) }
				help={ getHelpText() }
				checked={ effectiveProtected }
				onChange={ onChange }
				disabled={ isDisabled }
				__nextHasNoMarginBottom
			/>
			{ extensionContent }
		</div>
	);
}
