import { useState, useCallback } from '@wordpress/element';
import { Modal, Button } from '@wordpress/components';
import { __ } from '@wordpress/i18n';
import type { DuplicateEntry } from '../../utils/import-validator';

interface DuplicateResolutionModalProps {
	duplicates: DuplicateEntry[];
	onConfirm: ( resolved: DuplicateEntry[] ) => void;
	onCancel: () => void;
}

/**
 * Modal dialog for resolving import conflicts.
 *
 * Lists each conflicting endpoint with its name, slug, and match type,
 * and provides an Overwrite/Skip toggle for each entry (defaulting to Skip).
 * @param root0
 * @param root0.duplicates
 * @param root0.onConfirm
 * @param root0.onCancel
 */
export function DuplicateResolutionModal( {
	duplicates,
	onConfirm,
	onCancel,
}: DuplicateResolutionModalProps ) {
	const [ resolutions, setResolutions ] = useState<
		Record< number, 'overwrite' | 'skip' >
	>( () => {
		const initial: Record< number, 'overwrite' | 'skip' > = {};
		for ( let i = 0; i < duplicates.length; i++ ) {
			initial[ i ] = duplicates[ i ].resolution ?? 'skip';
		}
		return initial;
	} );

	const handleToggle = useCallback(
		( index: number, value: 'overwrite' | 'skip' ) => {
			setResolutions( ( prev ) => ( {
				...prev,
				[ index ]: value,
			} ) );
		},
		[]
	);

	const handleConfirm = useCallback( () => {
		const resolved = duplicates.map( ( entry, index ) => ( {
			...entry,
			resolution: resolutions[ index ] ?? 'skip',
		} ) );
		onConfirm( resolved );
	}, [ duplicates, resolutions, onConfirm ] );

	return (
		<Modal
			title={ __( 'Resolve Duplicate Endpoints', 'rkx-api-studio' ) }
			onRequestClose={ onCancel }
			className="rkx-as-duplicate-modal"
		>
			<p className="rkx-as-duplicate-modal__description">
				{ __(
					'The following imported endpoints conflict with existing ones. Choose whether to overwrite or skip each entry.',
					'rkx-api-studio'
				) }
			</p>

			<table className="rkx-as-duplicate-modal__table">
				<thead>
					<tr>
						<th>{ __( 'Name', 'rkx-api-studio' ) }</th>
						<th>{ __( 'Slug', 'rkx-api-studio' ) }</th>
						<th>{ __( 'Match', 'rkx-api-studio' ) }</th>
						<th>{ __( 'Action', 'rkx-api-studio' ) }</th>
					</tr>
				</thead>
				<tbody>
					{ duplicates.map( ( entry, index ) => (
						<tr key={ index }>
							<td>{ entry.importedEndpoint.name }</td>
							<td>
								<code>{ entry.importedEndpoint.slug }</code>
							</td>
							<td>{ entry.matchType }</td>
							<td>
								<div
									className="rkx-as-duplicate-modal__toggle"
									role="radiogroup"
									aria-label={ `Resolution for ${ entry.importedEndpoint.name }` }
								>
									<button
										type="button"
										role="radio"
										aria-checked={
											resolutions[ index ] === 'skip'
										}
										className={ `rkx-as-duplicate-modal__toggle-btn${
											resolutions[ index ] === 'skip'
												? ' rkx-as-duplicate-modal__toggle-btn--active'
												: ''
										}` }
										onClick={ () =>
											handleToggle( index, 'skip' )
										}
									>
										{ __( 'Skip', 'rkx-api-studio' ) }
									</button>
									<button
										type="button"
										role="radio"
										aria-checked={
											resolutions[ index ] === 'overwrite'
										}
										className={ `rkx-as-duplicate-modal__toggle-btn${
											resolutions[ index ] === 'overwrite'
												? ' rkx-as-duplicate-modal__toggle-btn--active'
												: ''
										}` }
										onClick={ () =>
											handleToggle( index, 'overwrite' )
										}
									>
										{ __( 'Overwrite', 'rkx-api-studio' ) }
									</button>
								</div>
							</td>
						</tr>
					) ) }
				</tbody>
			</table>

			<div className="rkx-as-duplicate-modal__actions">
				<Button variant="tertiary" onClick={ onCancel }>
					{ __( 'Cancel', 'rkx-api-studio' ) }
				</Button>
				<Button variant="primary" onClick={ handleConfirm }>
					{ __( 'Confirm', 'rkx-api-studio' ) }
				</Button>
			</div>
		</Modal>
	);
}
