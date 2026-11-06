import { useDraggable } from '@dnd-kit/core';
import { applyFilters } from '@wordpress/hooks';
import { __ } from '@wordpress/i18n';
import { RKX_AS_HOOK_FIELD_PANEL_SECTIONS } from '../hooks/rkx-as-hooks';
import type { DataSourceMetadata, FieldDefinition } from '../types';
import {
	CUSTOM_META_FIELD,
	POST_FIELDS,
	TAXONOMY_FIELDS,
	isPostTypeSource,
	isTaxonomySource,
} from '../types';

/**
 * Prefix for draggable IDs in the field panel to avoid collisions
 * with sortable IDs in the ActiveOutputZone.
 */
export const FIELD_PANEL_PREFIX = 'panel-';

interface FieldPanelProps {
	dataSource: string;
	activeFields: string[];
	metadata?: DataSourceMetadata;
}

interface DraggableFieldItemProps {
	field: FieldDefinition;
	isActive: boolean;
}

function DraggableFieldItem( { field, isActive }: DraggableFieldItemProps ) {
	const draggableId = FIELD_PANEL_PREFIX + field.id;

	const { attributes, listeners, setNodeRef, isDragging } = useDraggable( {
		id: draggableId,
		data: { field, fieldId: field.id },
		disabled: isActive,
	} );

	const className = [
		'rkx-as-field-item',
		isDragging ? 'rkx-as-field-item--dragging' : '',
		isActive ? 'rkx-as-field-item--active' : '',
	]
		.filter( Boolean )
		.join( ' ' );

	// Hide the original element while dragging — the DragOverlay shows the floating copy.
	const style: React.CSSProperties = isDragging ? { opacity: 0.3 } : {};

	return (
		<div
			ref={ setNodeRef }
			className={ className }
			style={ style }
			{ ...( isActive ? {} : listeners ) }
			{ ...attributes }
		>
			<span className="rkx-as-field-item__label">{ field.label }</span>
			{ isActive && (
				<span className="rkx-as-field-item__badge">
					{ __( 'Added', 'rkx-api-studio' ) }
				</span>
			) }
		</div>
	);
}

/**
 * Find the matching post type item from metadata.
 * Checks both slug and restBase to handle the case where the initial
 * dataSource value uses the REST base (e.g., 'posts') before the
 * DataSourceSelector normalizes it to the WP slug (e.g., 'post').
 * @param dataSource
 * @param metadata
 */
function findPostTypeItem( dataSource: string, metadata: DataSourceMetadata ) {
	return (
		metadata.postTypes.find( ( item ) => item.slug === dataSource ) ??
		metadata.postTypes.find( ( item ) => item.restBase === dataSource )
	);
}

export function getAvailableFields(
	dataSource: string,
	metadata?: DataSourceMetadata
): FieldDefinition[] {
	if ( metadata ) {
		const postTypeItem = findPostTypeItem( dataSource, metadata );

		if ( postTypeItem ) {
			const taxonomies = postTypeItem.taxonomies;
			if ( ! taxonomies || taxonomies.length === 0 ) {
				return [ ...POST_FIELDS, CUSTOM_META_FIELD ];
			}

			const taxonomyFields: FieldDefinition[] = taxonomies.map(
				( taxonomy ) => ( {
					id: `taxonomy:${ taxonomy.slug }`,
					label: taxonomy.label, // Already translated by WordPress core registration.
					sourceTypes: [ dataSource ],
				} )
			);

			return [ ...POST_FIELDS, ...taxonomyFields, CUSTOM_META_FIELD ];
		}
		if ( isTaxonomySource( dataSource, metadata ) ) {
			return [ ...TAXONOMY_FIELDS, CUSTOM_META_FIELD ];
		}
	}

	// Fallback for when metadata is not available: use hardcoded classification
	const knownPostTypes = [ 'posts', 'pages' ];
	const knownTaxonomies = [ 'categories', 'tags', 'custom_taxonomy' ];

	if ( knownPostTypes.includes( dataSource ) ) {
		return [ ...POST_FIELDS, CUSTOM_META_FIELD ];
	}
	if ( knownTaxonomies.includes( dataSource ) ) {
		return [ ...TAXONOMY_FIELDS, CUSTOM_META_FIELD ];
	}
	return [];
}

export function FieldPanel( {
	dataSource,
	activeFields,
	metadata,
}: FieldPanelProps ) {
	const fields = getAvailableFields( dataSource, metadata );

	// Determine if the current data source is a post type (not a taxonomy).
	// When metadata is not yet loaded, fall back to known post type slugs.
	const knownTaxonomies = [ 'categories', 'tags', 'custom_taxonomy' ];
	const isPostType = metadata
		? isPostTypeSource( dataSource, metadata )
		: ! knownTaxonomies.includes( dataSource );

	// Resolve data source to the actual WP post type slug for extensions.
	// dataSource can be a restBase (e.g., 'posts') or slug (e.g., 'post').
	const builtinMap: Record< string, string > = {
		posts: 'post',
		pages: 'page',
	};
	let resolvedPostType = builtinMap[ dataSource ] ?? dataSource;
	if ( metadata ) {
		const match = findPostTypeItem( dataSource, metadata );
		if ( match ) {
			resolvedPostType = match.slug;
		}
	}

	return (
		<div className="rkx-as-field-panel">
			<h3 className="rkx-as-field-panel__title">
				{ __( 'Available Fields', 'rkx-api-studio' ) }
			</h3>
			<div className="rkx-as-field-panel__list">
				{ fields.map( ( field ) => (
					<DraggableFieldItem
						key={ field.id }
						field={ field }
						isActive={ activeFields.includes( field.id ) }
					/>
				) ) }
			</div>
			{ isPostType &&
				// Installed extensions may provide additional field sources.
				( applyFilters( RKX_AS_HOOK_FIELD_PANEL_SECTIONS, null, {
					postType: resolvedPostType,
					activeFields,
					useDraggable,
				} ) as React.ReactElement | null ) }
		</div>
	);
}
