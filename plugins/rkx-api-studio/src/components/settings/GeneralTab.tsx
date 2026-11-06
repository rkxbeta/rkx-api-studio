import { ToggleControl } from '@wordpress/components';
import { __ } from '@wordpress/i18n';

interface GeneralTabProps {
	deleteDataOnUninstall: boolean;
	onChange: ( value: boolean ) => void;
}

export function GeneralTab( {
	deleteDataOnUninstall,
	onChange,
}: GeneralTabProps ) {
	return (
		<div className="rkx-as-general-tab">
			<ToggleControl
				label={ __(
					'Delete all plugin data upon uninstallation',
					'rkx-api-studio'
				) }
				help={
					deleteDataOnUninstall
						? __(
								'All endpoint configurations and plugin settings will be permanently removed when the plugin is deleted.',
								'rkx-api-studio'
						  )
						: __(
								'Plugin data will be preserved in the database if the plugin is uninstalled.',
								'rkx-api-studio'
						  )
				}
				checked={ deleteDataOnUninstall }
				onChange={ onChange }
				__nextHasNoMarginBottom
			/>
		</div>
	);
}
