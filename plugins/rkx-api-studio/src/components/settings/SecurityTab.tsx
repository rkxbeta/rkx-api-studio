import { useState, useEffect, useCallback } from '@wordpress/element';
import { Button, Notice, Spinner } from '@wordpress/components';
import { __ } from '@wordpress/i18n';
import { applyFilters } from '@wordpress/hooks';
import { ConfirmationModal } from '../ConfirmationModal';
import { RKX_AS_HOOK_SECURITY_CONTENT } from '../../hooks/rkx-as-hooks';

declare const rkxApiStudio:
	| {
			restUrl?: string;
	  }
	| undefined;

import {
	getKeyStatus,
	generateKey,
	regenerateKey,
} from '../../api/security-client';
import type { KeyStatus } from '../../api/security-client';

export function SecurityTab() {
	const [ keyStatus, setKeyStatus ] = useState< KeyStatus | null >( null );
	const [ generatedKey, setGeneratedKey ] = useState< string | null >( null );
	const [ isLoading, setIsLoading ] = useState( true );
	const [ isGenerating, setIsGenerating ] = useState( false );
	const [ copied, setCopied ] = useState( false );
	const [ showConfirmRegenerate, setShowConfirmRegenerate ] =
		useState( false );
	const [ notice, setNotice ] = useState< {
		type: 'success' | 'error';
		message: string;
	} | null >( null );

	const restBase =
		typeof rkxApiStudio !== 'undefined' && rkxApiStudio.restUrl
			? rkxApiStudio.restUrl.replace( /\/?$/, '' )
			: `${ window.location.origin }/wp-json/rkx-api-studio/v1`;

	// Fetch key status on mount.
	useEffect( () => {
		getKeyStatus()
			.then( ( status ) => {
				setKeyStatus( status );
			} )
			.catch( () => {
				setNotice( {
					type: 'error',
					message: __(
						'Failed to load API key status.',
						'rkx-api-studio'
					),
				} );
			} )
			.finally( () => {
				setIsLoading( false );
			} );
	}, [] );

	// Clear plaintext key from state on unmount.
	useEffect( () => {
		return () => {
			setGeneratedKey( null );
		};
	}, [] );

	const handleGenerate = useCallback( async () => {
		// If a key already exists, show confirmation dialog first.
		if ( keyStatus?.exists ) {
			setShowConfirmRegenerate( true );
			return;
		}

		setIsGenerating( true );
		setNotice( null );
		try {
			const response = await generateKey();
			setGeneratedKey( response.key );
			setKeyStatus( response.status );
		} catch {
			setNotice( {
				type: 'error',
				message: __(
					'Failed to generate API key. Please try again.',
					'rkx-api-studio'
				),
			} );
		} finally {
			setIsGenerating( false );
		}
	}, [ keyStatus ] );

	const handleConfirmRegenerate = useCallback( async () => {
		setShowConfirmRegenerate( false );
		setIsGenerating( true );
		setNotice( null );
		try {
			const response = await regenerateKey();
			setGeneratedKey( response.key );
			setKeyStatus( response.status );
		} catch {
			setNotice( {
				type: 'error',
				message: __(
					'Failed to regenerate API key. Please try again.',
					'rkx-api-studio'
				),
			} );
		} finally {
			setIsGenerating( false );
		}
	}, [] );

	const handleCopy = useCallback( async () => {
		if ( ! generatedKey ) {
			return;
		}

		try {
			if ( navigator.clipboard && window.isSecureContext ) {
				await navigator.clipboard.writeText( generatedKey );
			} else {
				const textArea = document.createElement( 'textarea' );
				textArea.value = generatedKey;
				textArea.style.position = 'fixed';
				textArea.style.left = '-9999px';
				document.body.appendChild( textArea );
				textArea.select();
				document.execCommand( 'copy' );
				document.body.removeChild( textArea );
			}
			setCopied( true );
			setTimeout( () => setCopied( false ), 2000 );
		} catch {
			setNotice( {
				type: 'error',
				message: __( 'Failed to copy to clipboard.', 'rkx-api-studio' ),
			} );
		}
	}, [ generatedKey ] );

	if ( isLoading ) {
		return (
			<div className="rkx-as-security-tab">
				<Spinner />
			</div>
		);
	}

	return (
		<div className="rkx-as-security-tab">
			{ notice && (
				<Notice
					status={ notice.type }
					isDismissible
					onRemove={ () => setNotice( null ) }
				>
					{ notice.message }
				</Notice>
			) }

			{
				applyFilters(
					RKX_AS_HOOK_SECURITY_CONTENT,
					<>
						<div className="rkx-as-security-tab__card">
							<h3 className="rkx-as-security-tab__card-title">
								{ __( 'API Key', 'rkx-api-studio' ) }
							</h3>

							{ ! keyStatus?.exists && ! generatedKey && (
								<>
									<p className="rkx-as-security-tab__card-description">
										{ __(
											'Generate an API key to protect your endpoints. The key will be shown only once after generation — make sure to copy it.',
											'rkx-api-studio'
										) }
									</p>
									<Button
										variant="primary"
										onClick={ handleGenerate }
										isBusy={ isGenerating }
										disabled={ isGenerating }
									>
										{ __(
											'Generate API Key',
											'rkx-api-studio'
										) }
									</Button>
								</>
							) }

							{ generatedKey && (
								<div className="rkx-as-security-tab__key-display">
									<p className="rkx-as-security-tab__key-notice">
										{ __(
											'Your API key is shown below. Copy it now — it will not be displayed again.',
											'rkx-api-studio'
										) }
									</p>
									<code className="rkx-as-security-tab__key-value">
										{ generatedKey }
									</code>
									<div className="rkx-as-security-tab__key-actions">
										<Button
											variant="secondary"
											onClick={ handleCopy }
										>
											{ copied
												? __(
														'Copied!',
														'rkx-api-studio'
												  )
												: __(
														'Copy to Clipboard',
														'rkx-api-studio'
												  ) }
										</Button>
									</div>
								</div>
							) }

							{ keyStatus?.exists && ! generatedKey && (
								<>
									{ keyStatus.lastRegenerated && (
										<p className="rkx-as-security-tab__last-regenerated">
											{ __(
												'Last regenerated:',
												'rkx-api-studio'
											) }{ ' ' }
											{ keyStatus.lastRegenerated }
										</p>
									) }
									<Button
										variant="secondary"
										onClick={ handleGenerate }
										isBusy={ isGenerating }
										disabled={ isGenerating }
									>
										{ __(
											'Regenerate API Key',
											'rkx-api-studio'
										) }
									</Button>
								</>
							) }
						</div>

						{ keyStatus?.exists && (
							<div className="rkx-as-security-tab__card">
								<h3 className="rkx-as-security-tab__card-title">
									{ __(
										'How to Authenticate',
										'rkx-api-studio'
									) }
								</h3>
								<p className="rkx-as-security-tab__card-description">
									{ __(
										'Add the following header to your requests when calling a protected endpoint:',
										'rkx-api-studio'
									) }
								</p>
								<code className="rkx-as-security-tab__code-block">
									{
										'X-RKX-API-Studio-Key: your_api_key_here'
									}
								</code>
								<p className="rkx-as-security-tab__card-description rkx-as-security-tab__card-description--spaced">
									{ __(
										'Example using cURL:',
										'rkx-api-studio'
									) }
								</p>
								<code className="rkx-as-security-tab__code-block">
									{ `curl -H "X-RKX-API-Studio-Key: your_api_key_here" ${ restBase }/your-endpoint` }
								</code>
							</div>
						) }
					</>,
					{ keyStatus }
				) as React.ReactNode
			}

			{ showConfirmRegenerate && (
				<ConfirmationModal
					title={ __( 'Regenerate API Key', 'rkx-api-studio' ) }
					message={ __(
						'Regenerating will immediately invalidate your current API key. Any applications using the existing key will lose access. This action cannot be undone.',
						'rkx-api-studio'
					) }
					confirmLabel={ __( 'Regenerate', 'rkx-api-studio' ) }
					isDestructive
					onConfirm={ handleConfirmRegenerate }
					onCancel={ () => setShowConfirmRegenerate( false ) }
				/>
			) }
		</div>
	);
}
