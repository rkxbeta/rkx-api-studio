import { useState, useCallback } from '@wordpress/element';
import { Notice } from '@wordpress/components';
import { ExportCard } from './ExportCard';
import { ImportCard } from './ImportCard';
import { CacheSettingsCard } from './CacheSettingsCard';

export interface NoticePayload {
	type: 'success' | 'error' | 'info' | 'warning';
	message: string;
}

export function ToolsTab( {
	onImported,
}: {
	onImported?: () => Promise< void >;
} ) {
	const [ cacheRevision, setCacheRevision ] = useState( 0 );
	const handleImported = async () => {
		await onImported?.();
		setCacheRevision( ( value ) => value + 1 );
	};
	const [ notices, setNotices ] = useState< NoticePayload[] >( [] );

	const handleNotice = useCallback( ( payload: NoticePayload ) => {
		setNotices( ( prev ) => [ ...prev, payload ] );
	}, [] );

	const removeNotice = useCallback( ( index: number ) => {
		setNotices( ( prev ) => prev.filter( ( _, i ) => i !== index ) );
	}, [] );

	return (
		<div className="rkx-as-tools-tab">
			{ notices.map( ( notice, index ) => (
				<Notice
					key={ `${ notice.type }-${ index }` }
					status={ notice.type }
					isDismissible
					onRemove={ () => removeNotice( index ) }
				>
					{ notice.message }
				</Notice>
			) ) }

			<ExportCard onNotice={ handleNotice } />
			<ImportCard
				onNotice={ handleNotice }
				onImported={ handleImported }
			/>
			<CacheSettingsCard
				key={ cacheRevision }
				onNotice={ handleNotice }
			/>
		</div>
	);
}
