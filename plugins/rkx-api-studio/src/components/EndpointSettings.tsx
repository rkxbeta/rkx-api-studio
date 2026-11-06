import { Button, TextControl, TextareaControl } from '@wordpress/components';
import { __ } from '@wordpress/i18n';
import { update } from '@wordpress/icons';
import {
	applyComponentFilters as applyFilters,
	RKX_AS_HOOK_ENDPOINT_SETTINGS_FIELDS,
} from '../hooks/rkx-as-hooks';
import type { BuilderAction } from '../hooks/useEndpointBuilder';
import type { DataSource, DataSourceMetadata, EndpointConfig } from '../types';
import { DataSourceSelector } from './DataSourceSelector';
import { EndpointProtectionToggle } from './EndpointProtectionToggle';

interface EndpointSettingsProps {
	name: string;
	slug: string;
	description?: string;
	config?: EndpointConfig;
	dataSource: DataSource;
	legacyCustomTaxonomy?: string;
	errors: Record< string, string >;
	isEditMode: boolean;
	dispatch: React.Dispatch< BuilderAction >;
	metadata?: DataSourceMetadata | null;
	isProtected: boolean;
	hasApiKey: boolean;
	isWriteMode?: boolean;
}

export function EndpointSettings( {
	name,
	slug,
	description,
	config,
	dataSource,
	legacyCustomTaxonomy,
	errors,
	isEditMode,
	dispatch,
	metadata,
	isProtected,
	hasApiKey,
	isWriteMode = false,
}: EndpointSettingsProps ) {
	const handleNameChange = ( value: string ) => {
		dispatch( { type: 'SET_NAME', payload: value } );
	};

	const handleSlugChange = ( value: string ) => {
		dispatch( { type: 'SET_SLUG', payload: value } );
	};

	return (
		<div className="rkx-as-endpoint-settings">
			<h3 className="rkx-as-endpoint-settings__title">
				{ __( 'Endpoint Settings', 'rkx-api-studio' ) }
			</h3>

			<div
				className={ `rkx-as-endpoint-settings__field${
					errors.name ? ' rkx-as-endpoint-settings__field--error' : ''
				}` }
			>
				<TextControl
					label={ __( 'Endpoint Name', 'rkx-api-studio' ) }
					value={ name }
					onChange={ handleNameChange }
					help={
						errors.name ? (
							<span className="rkx-as-endpoint-settings__error">
								{ errors.name }
							</span>
						) : undefined
					}
					__nextHasNoMarginBottom
				/>
			</div>

			<div
				className={ `rkx-as-endpoint-settings__field${
					errors.slug ? ' rkx-as-endpoint-settings__field--error' : ''
				}${
					isEditMode
						? ' rkx-as-endpoint-settings__slug-field--locked'
						: ''
				}` }
			>
				<div className="rkx-as-endpoint-settings__slug-row">
					<label
						className="components-base-control__label"
						htmlFor="rkx-as-slug-input"
					>
						{ __( 'URL Slug', 'rkx-api-studio' ) }
					</label>
					<div className="rkx-as-endpoint-settings__slug-input-wrapper">
						<input
							id="rkx-as-slug-input"
							className="components-text-control__input"
							type="text"
							aria-label={ __( 'URL Slug', 'rkx-api-studio' ) }
							value={ slug }
							onChange={ ( e ) =>
								handleSlugChange( e.target.value )
							}
							disabled={ isEditMode }
						/>
						{ ! isEditMode && (
							<Button
								className="rkx-as-endpoint-settings__regenerate-btn"
								icon={ update }
								label={ __(
									'Generate slug from name',
									'rkx-api-studio'
								) }
								aria-label={ __(
									'Generate slug from name',
									'rkx-api-studio'
								) }
								onClick={ () =>
									dispatch( { type: 'REGENERATE_SLUG' } )
								}
								size="small"
							/>
						) }
					</div>
					<p className="components-base-control__help">
						{ /* eslint-disable-next-line no-nested-ternary */ }
						{ errors.slug ? (
							<span className="rkx-as-endpoint-settings__error">
								{ errors.slug }
							</span>
						) : isEditMode ? (
							__(
								'Slug cannot be changed after creation.',
								'rkx-api-studio'
							)
						) : (
							__(
								'Click the generate button or type a custom slug.',
								'rkx-api-studio'
							)
						) }
					</p>
				</div>
			</div>

			{ applyFilters( RKX_AS_HOOK_ENDPOINT_SETTINGS_FIELDS, null, {
				config,
				dispatch,
			} ) }

			<div className="rkx-as-endpoint-settings__field">
				<TextareaControl
					label={ __( 'Description', 'rkx-api-studio' ) }
					help={ __(
						'Optional. Describe the purpose of this endpoint.',
						'rkx-api-studio'
					) }
					value={ description || '' }
					onChange={ ( value: string ) =>
						dispatch( { type: 'SET_DESCRIPTION', payload: value } )
					}
					__nextHasNoMarginBottom
				/>
			</div>

			{ ! isWriteMode && (
				<div className="rkx-as-endpoint-settings__field">
					<DataSourceSelector
						dataSource={ dataSource }
						legacyCustomTaxonomy={ legacyCustomTaxonomy }
						dispatch={ dispatch }
						metadata={ metadata ?? undefined }
					/>
				</div>
			) }

			<div className="rkx-as-endpoint-settings__field">
				<EndpointProtectionToggle
					isProtected={ isProtected }
					onChange={ ( value ) =>
						dispatch( { type: 'SET_PROTECTED', payload: value } )
					}
					hasApiKey={ hasApiKey }
					config={ config }
					dispatch={ dispatch }
					isWriteMode={ isWriteMode }
				/>
			</div>
		</div>
	);
}
