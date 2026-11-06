import { Modal, Button } from '@wordpress/components';
import { __ } from '@wordpress/i18n';

interface ConfirmationModalProps {
	title: string;
	message: string;
	confirmLabel: string;
	cancelLabel?: string;
	isDestructive?: boolean;
	onConfirm: () => void;
	onCancel: () => void;
}

/**
 * Reusable confirmation modal for destructive or important actions.
 *
 * Uses the WordPress Modal component which handles Escape key to close
 * via the onRequestClose callback. Renders confirm and cancel buttons
 * with optional destructive styling.
 * @param root0
 * @param root0.title
 * @param root0.message
 * @param root0.confirmLabel
 * @param root0.cancelLabel
 * @param root0.isDestructive
 * @param root0.onConfirm
 * @param root0.onCancel
 */
export function ConfirmationModal( {
	title,
	message,
	confirmLabel,
	cancelLabel = __( 'Cancel', 'rkx-api-studio' ),
	isDestructive = false,
	onConfirm,
	onCancel,
}: ConfirmationModalProps ) {
	return (
		<Modal
			title={ title }
			onRequestClose={ onCancel }
			className="rkx-as-confirmation-modal"
		>
			<p className="rkx-as-confirmation-modal__message">{ message }</p>
			<div className="rkx-as-confirmation-modal__actions">
				<Button variant="secondary" onClick={ onCancel }>
					{ cancelLabel }
				</Button>
				<Button
					variant="primary"
					isDestructive={ isDestructive }
					onClick={ onConfirm }
				>
					{ confirmLabel }
				</Button>
			</div>
		</Modal>
	);
}
