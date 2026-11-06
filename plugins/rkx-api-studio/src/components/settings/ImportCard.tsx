import { useState, useRef, useCallback } from '@wordpress/element';
import { applyFilters } from '@wordpress/hooks';
import { Spinner } from '@wordpress/components';
import { __, sprintf } from '@wordpress/i18n';
import {
	getEndpoints,
	createEndpoint,
	updateEndpoint,
	fromApiResponse,
} from '../../api/client';
import { getSettings, updateSettings } from '../../api/settings-client';
import {
	validateImportData,
	detectDuplicates,
} from '../../utils/import-validator';
import type {
	ImportedEndpoint,
	ImportedCacheSettings,
	DuplicateEntry,
	SkippedEndpoint,
} from '../../utils/import-validator';
import type { EndpointConfig } from '../../types';
import type { NoticePayload } from './ToolsTab';
import { DuplicateResolutionModal } from './DuplicateResolutionModal';

type ImportState =
	| 'idle'
	| 'validating'
	| 'duplicates'
	| 'importing'
	| 'complete';

interface ImportCardProps {
	onNotice: ( notice: NoticePayload ) => void;
	onImported?: () => Promise< void >;
}

/**
 * Convert an ImportedEndpoint (snake_case) to an EndpointConfig (camelCase)
 * using the existing fromApiResponse helper.
 * @param imported
 */
function toEndpointConfig( imported: ImportedEndpoint ): EndpointConfig {
	return fromApiResponse( imported as unknown as Record< string, unknown > );
}

/**
 * Include backend field errors so rejected imports explain their requirements.
 * @param error REST or transport error.
 */
function importErrorMessage( error: unknown ): string {
	const restError = error as {
		message?: string;
		data?: { errors?: Record< string, string > };
	};
	return restError?.data?.errors
		? Object.values( restError.data.errors ).join( ' ' )
		: restError?.message || __( 'Unknown error', 'rkx-api-studio' );
}

export function ImportCard( { onNotice, onImported }: ImportCardProps ) {
	const [ importSettings, setImportSettings ] = useState<
		ImportedCacheSettings | undefined
	>();
	const [ skippedEndpoints, setSkippedEndpoints ] = useState<
		SkippedEndpoint[]
	>( [] );
	const [ state, setState ] = useState< ImportState >( 'idle' );
	const [ duplicates, setDuplicates ] = useState< DuplicateEntry[] >( [] );
	const [ uniqueEndpoints, setUniqueEndpoints ] = useState<
		ImportedEndpoint[]
	>( [] );
	const fileInputRef = useRef< HTMLInputElement >( null );

	const resetToIdle = useCallback( () => {
		setState( 'idle' );
		setImportSettings( undefined );
		setSkippedEndpoints( [] );
		setDuplicates( [] );
		setUniqueEndpoints( [] );
		if ( fileInputRef.current ) {
			fileInputRef.current.value = '';
		}
	}, [] );

	/**
	 * Execute the import: create new endpoints and update overwrites sequentially.
	 */
	const executeImport = useCallback(
		async (
			toCreate: ImportedEndpoint[],
			toOverwrite: DuplicateEntry[],
			cacheSettings?: ImportedCacheSettings,
			skippedValidation: SkippedEndpoint[] = []
		) => {
			setState( 'importing' );

			let importedCount = 0;
			let skippedCount = 0;
			const successes: string[] = [];
			const failures: string[] = [];

			// Installed extensions may prepare their own data before endpoints are saved.
			let extensionNotices: Array< {
				type: 'success' | 'error' | 'warning' | 'info';
				message: string;
			} > = [];
			let checkEndpoint = ( endpoint: ImportedEndpoint ): void => {
				void endpoint;
			};
			try {
				const prepared = await ( applyFilters(
					'rkxAs.import.prepare',
					Promise.resolve( {
						notices: extensionNotices,
						validate: checkEndpoint,
					} ),
					{ toCreate, toOverwrite }
				) as Promise< {
					notices?: typeof extensionNotices;
					validate?: ( endpoint: ImportedEndpoint ) => void;
				} > );
				extensionNotices = Array.isArray( prepared?.notices )
					? prepared.notices
					: [];
				if ( typeof prepared?.validate === 'function' ) {
					checkEndpoint = prepared.validate;
				}
				if ( cacheSettings ) {
					const currentSettings = await getSettings();
					const updated = await updateSettings( {
						...currentSettings,
						cacheEnabled: cacheSettings.cache_enabled,
						cacheTtl: cacheSettings.cache_ttl,
					} );
					if (
						updated.cacheEnabled !== cacheSettings.cache_enabled ||
						updated.cacheTtl !== cacheSettings.cache_ttl
					) {
						throw new Error(
							__(
								'Cache settings were not restored.',
								'rkx-api-studio'
							)
						);
					}
				}
			} catch ( error ) {
				onNotice( {
					type: 'error',
					message:
						( error as { message?: string } )?.message ||
						__(
							'Failed to prepare import settings. No endpoints were imported.',
							'rkx-api-studio'
						),
				} );
				await onImported?.();
				resetToIdle();
				return;
			}

			// Create new endpoints
			for ( const endpoint of toCreate ) {
				try {
					checkEndpoint( endpoint );
					await createEndpoint( toEndpointConfig( endpoint ) );
					importedCount++;
					successes.push( endpoint.name );
				} catch ( error ) {
					const reason = importErrorMessage( error );
					failures.push( `${ endpoint.name }: ${ reason }` );
				}
			}

			// Process overwrites
			for ( const entry of toOverwrite ) {
				if ( entry.resolution === 'skip' ) {
					skippedCount++;
					continue;
				}

				try {
					checkEndpoint( entry.importedEndpoint );
					await updateEndpoint(
						entry.existingEndpoint.id,
						toEndpointConfig( entry.importedEndpoint )
					);
					importedCount++;
					successes.push( entry.importedEndpoint.name );
				} catch ( error ) {
					const reason = importErrorMessage( error );
					failures.push(
						`${ entry.importedEndpoint.name }: ${ reason }`
					);
				}
			}

			// Count skipped duplicates that were resolved as 'skip' plus unsupported endpoints skipped during validation
			const allDuplicateSkips = toOverwrite.filter(
				( e ) => e.resolution === 'skip'
			).length;
			skippedCount = allDuplicateSkips + skippedValidation.length;

			// Count protected endpoints that were actually imported (not skipped).
			// Write methods (POST/PUT/DELETE) always require auth even without protected=true.
			const isAuthRequired = ( ep: {
				protected?: boolean;
				method?: string;
			} ) => {
				if ( ep.protected === true ) {
					return true;
				}
				const m = ( ep.method ?? 'GET' ).toUpperCase();
				return [ 'POST', 'PUT', 'DELETE' ].includes( m );
			};

			const protectedCount = [
				...toCreate.filter( isAuthRequired ),
				...toOverwrite
					.filter( ( e ) => e.resolution !== 'skip' )
					.filter( ( e ) => isAuthRequired( e.importedEndpoint ) ),
			].length;

			if ( failures.length > 0 ) {
				const failureList = failures.join( '\n' );
				const successInfo =
					successes.length > 0
						? sprintf(
								/* translators: %s: comma-separated list of endpoint names */
								__(
									'Successfully saved: %s.',
									'rkx-api-studio'
								),
								successes.join( ', ' )
						  )
						: '';
				onNotice( {
					type: 'error',
					message: sprintf(
						/* translators: 1: success info (may be empty), 2: newline-separated list of failures */
						__( '%1$sFailed to import: %2$s', 'rkx-api-studio' ),
						successInfo,
						failureList
					),
				} );
			} else {
				onNotice( {
					type: 'success',
					message: sprintf(
						/* translators: 1: number of imported endpoints, 2: number of skipped endpoints */
						__(
							'Successfully imported %1$d endpoint(s). %2$d skipped.',
							'rkx-api-studio'
						),
						importedCount,
						skippedCount
					),
				} );
			}

			// Clear notification for skipped endpoints requiring a key management extension
			if ( skippedValidation.length > 0 ) {
				const skippedNames = skippedValidation
					.map( ( s ) => `"${ s.name }"` )
					.join( ', ' );
				onNotice( {
					type: 'warning',
					message: sprintf(
						/* translators: 1: number of skipped endpoints, 2: comma-separated list of names */
						__(
							'Skipped %1$d endpoint(s) with unsupported named-key restrictions: %2$s.',
							'rkx-api-studio'
						),
						skippedValidation.length,
						skippedNames
					),
				} );
			}

			// Warning for protected endpoints
			if ( protectedCount > 0 ) {
				onNotice( {
					type: 'warning',
					message: sprintf(
						/* translators: %d: number of protected endpoints */
						__(
							'%d imported endpoint(s) have protection enabled. Please configure API keys in Security Settings to ensure these endpoints remain secured.',
							'rkx-api-studio'
						),
						protectedCount
					),
				} );
			}

			for ( const extensionNotice of extensionNotices ) {
				onNotice( extensionNotice );
			}
			await onImported?.();
			resetToIdle();
		},
		[ onNotice, onImported, resetToIdle ]
	);

	/**
	 * Handle duplicate resolution modal confirmation.
	 */
	const handleDuplicateConfirm = useCallback(
		( resolved: DuplicateEntry[] ) => {
			executeImport(
				uniqueEndpoints,
				resolved,
				importSettings,
				skippedEndpoints
			);
		},
		[ uniqueEndpoints, executeImport, importSettings, skippedEndpoints ]
	);

	/**
	 * Handle duplicate resolution modal cancellation.
	 */
	const handleDuplicateCancel = useCallback( () => {
		resetToIdle();
	}, [ resetToIdle ] );

	/**
	 * Handle file selection and run the validation → duplicate detection → import pipeline.
	 */
	const handleFileChange = useCallback(
		async ( event: React.ChangeEvent< HTMLInputElement > ) => {
			const file = event.target.files?.[ 0 ];
			if ( ! file ) {
				return;
			}

			setState( 'validating' );

			// Validate file extension
			if ( ! file.name.toLowerCase().endsWith( '.json' ) ) {
				onNotice( {
					type: 'error',
					message: __(
						'Please select a .json file.',
						'rkx-api-studio'
					),
				} );
				resetToIdle();
				return;
			}

			// Check for empty file
			if ( file.size === 0 ) {
				onNotice( {
					type: 'error',
					message: __(
						'The selected file is empty.',
						'rkx-api-studio'
					),
				} );
				resetToIdle();
				return;
			}

			// Read and parse JSON
			let parsed: unknown;
			try {
				const text = await file.text();
				parsed = JSON.parse( text );
			} catch {
				onNotice( {
					type: 'error',
					message: __(
						'Invalid JSON file. Please check the file format and try again.',
						'rkx-api-studio'
					),
				} );
				resetToIdle();
				return;
			}

			// Run schema validation
			const validationResult = validateImportData( parsed );
			if ( ! validationResult.valid ) {
				const errorLines = validationResult.errors.map( ( err ) => {
					const identifier = err.name
						? `"${ err.name }"`
						: sprintf(
								/* translators: %d: entry number in the import file */
								__( 'Entry %d', 'rkx-api-studio' ),
								err.index + 1
						  );
					return `${ identifier }: ${ err.message }`;
				} );
				onNotice( {
					type: 'error',
					message: errorLines.join( '\n' ),
				} );
				resetToIdle();
				return;
			}

			setImportSettings( validationResult.settings );
			const skippedList = validationResult.skipped || [];
			setSkippedEndpoints( skippedList );

			// Fetch existing endpoints for duplicate detection
			let existingEndpoints: EndpointConfig[];
			try {
				existingEndpoints = await getEndpoints();
			} catch {
				onNotice( {
					type: 'error',
					message: __(
						'Failed to fetch existing endpoints for duplicate detection. Please try again.',
						'rkx-api-studio'
					),
				} );
				resetToIdle();
				return;
			}

			// Detect duplicates
			const { duplicates: foundDuplicates, unique } = detectDuplicates(
				validationResult.endpoints,
				existingEndpoints
			);

			if ( foundDuplicates.length > 0 ) {
				setDuplicates( foundDuplicates );
				setUniqueEndpoints( unique );
				setState( 'duplicates' );
			} else {
				// No duplicates — proceed directly to import
				setUniqueEndpoints( [] );
				executeImport(
					validationResult.endpoints,
					[],
					validationResult.settings,
					skippedList
				);
			}
		},
		[ onNotice, resetToIdle, executeImport ]
	);

	const isProcessing = state === 'validating' || state === 'importing';

	return (
		<div className="rkx-as-tools-tab__card">
			<h3 className="rkx-as-tools-tab__card-title">
				{ __( 'Import Endpoints', 'rkx-api-studio' ) }
			</h3>
			<p className="rkx-as-tools-tab__card-description">
				{ __(
					'Upload a JSON file to import endpoint configurations. Included response cache settings apply to all endpoints on this site.',
					'rkx-api-studio'
				) }
			</p>

			<div className="rkx-as-tools-tab__upload-zone">
				<input
					ref={ fileInputRef }
					type="file"
					accept=".json"
					onChange={ handleFileChange }
					disabled={ isProcessing }
					aria-label={ __( 'Upload JSON file', 'rkx-api-studio' ) }
				/>
				{ isProcessing && (
					<div className="rkx-as-tools-tab__import-progress">
						<Spinner />
						<span>
							{ state === 'validating'
								? __( 'Validating file…', 'rkx-api-studio' )
								: __(
										'Importing endpoints…',
										'rkx-api-studio'
								  ) }
						</span>
					</div>
				) }
			</div>

			{ state === 'duplicates' && (
				<DuplicateResolutionModal
					duplicates={ duplicates }
					onConfirm={ handleDuplicateConfirm }
					onCancel={ handleDuplicateCancel }
				/>
			) }
		</div>
	);
}
