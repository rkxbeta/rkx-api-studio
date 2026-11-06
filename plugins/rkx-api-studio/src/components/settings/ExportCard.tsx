import { useState } from '@wordpress/element';
import { Button, Spinner } from '@wordpress/components';
import { __ } from '@wordpress/i18n';
import { getEndpoints } from '../../api/client';
import { downloadExportFile } from '../../utils/export-utils';
import type { NoticePayload } from './ToolsTab';

interface ExportCardProps {
	onNotice: ( notice: NoticePayload ) => void;
}

export function ExportCard( { onNotice }: ExportCardProps ) {
	const [ isExporting, setIsExporting ] = useState( false );

	const handleExport = async () => {
		setIsExporting( true );
		try {
			const endpoints = await getEndpoints();

			if ( endpoints.length === 0 ) {
				onNotice( {
					type: 'info',
					message: __(
						'There are no endpoints to export.',
						'rkx-api-studio'
					),
				} );
				return;
			}

			await downloadExportFile( endpoints );
			onNotice( {
				type: 'success',
				message: __(
					'Endpoints exported successfully.',
					'rkx-api-studio'
				),
			} );
		} catch {
			onNotice( {
				type: 'error',
				message: __(
					'Failed to export endpoints. Please try again.',
					'rkx-api-studio'
				),
			} );
		} finally {
			setIsExporting( false );
		}
	};

	return (
		<div className="rkx-as-tools-tab__card">
			<h3 className="rkx-as-tools-tab__card-title">
				{ __( 'Export Endpoints', 'rkx-api-studio' ) }
			</h3>
			<p className="rkx-as-tools-tab__card-description">
				{ __(
					'Download all endpoint configurations and global response cache settings as a JSON file.',
					'rkx-api-studio'
				) }
			</p>
			<Button
				variant="secondary"
				onClick={ handleExport }
				disabled={ isExporting }
				aria-disabled={ isExporting }
			>
				{ isExporting && <Spinner /> }
				{ __( 'Download Export File', 'rkx-api-studio' ) }
			</Button>
		</div>
	);
}
