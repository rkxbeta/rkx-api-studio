import { useDroppable } from '@dnd-kit/core';
import {
	SortableContext,
	useSortable,
	verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { CheckboxControl, Popover, TextControl } from '@wordpress/components';
import { useState, useRef } from '@wordpress/element';
import {
	applyComponentFilters as applyFilters,
	RKX_AS_HOOK_FORMATTER_SECTIONS,
} from '../hooks/rkx-as-hooks';
import { __ } from '@wordpress/i18n';
import { settings as settingsIcon } from '@wordpress/icons';
import type { BuilderAction } from '../hooks/useEndpointBuilder';
import {
	POST_FIELDS,
	TAXONOMY_FIELDS,
	isTaxonomyField,
	getTaxonomySlug,
	isMetaField,
	getMetaKey,
	META_PREFIX,
	FIELD_FORMATTERS,
} from '../types';
import type {
	DataSourceMetadata,
	FieldFormattersMap,
	FieldFormatterItem,
} from '../types';
import { applyFilters as applyValueFilters } from '@wordpress/hooks';

interface ActiveOutputZoneProps {
	fields: string[];
	dispatch: React.Dispatch< BuilderAction >;
	errors?: Record< string, string >;
	dataSource?: string;
	metadata?: DataSourceMetadata;
	fieldFormattersMap?: FieldFormattersMap;
	extensionData?: unknown;
	config?: unknown;
}

interface SortableFieldItemProps {
	fieldId: string;
	onRemove: ( id: string ) => void;
	dispatch: React.Dispatch< BuilderAction >;
	dataSource?: string;
	metadata?: DataSourceMetadata;
	activeFormatters?: FieldFormatterItem[];
	extensionData?: unknown;
	config?: unknown;
}

const ALL_FIELDS = [ ...POST_FIELDS, ...TAXONOMY_FIELDS ];

interface FieldFormatterPopoverProps {
	fieldId: string;
	activeFormatters: FieldFormatterItem[];
	dispatch: React.Dispatch< BuilderAction >;
}

function getStringFormatters( items: FieldFormatterItem[] ): string[] {
	return items.filter( ( item ): item is string => typeof item === 'string' );
}

function FieldFormatterPopover( {
	fieldId,
	activeFormatters,
	dispatch,
}: FieldFormatterPopoverProps ) {
	const [ isOpen, setIsOpen ] = useState( false );
	const btnRef = useRef< HTMLButtonElement >( null );

	const stringFormatters = getStringFormatters( activeFormatters );

	const handleToggle = ( e: React.MouseEvent ) => {
		e.stopPropagation();
		e.preventDefault();
		setIsOpen( ( prev ) => ! prev );
	};

	const handleChange = ( formatterId: string, checked: boolean ) => {
		const next = checked
			? [ ...stringFormatters, formatterId ]
			: stringFormatters.filter( ( f ) => f !== formatterId );
		dispatch( {
			type: 'SET_FIELD_FORMATTERS',
			payload: { field: fieldId, formatters: next },
		} );
	};

	const count = activeFormatters.length;

	return (
		<span className="rkx-as-sortable-field-item__formatter-wrap">
			<button
				ref={ btnRef }
				type="button"
				className={ `rkx-as-sortable-field-item__formatter-btn${
					count > 0 ? ' is-active' : ''
				}` }
				onClick={ handleToggle }
				aria-label={ __( 'Field formatters', 'rkx-api-studio' ) }
				aria-expanded={ isOpen }
			>
				{ settingsIcon }
				{ count > 0 && (
					<span className="rkx-as-sortable-field-item__formatter-badge">
						{ count }
					</span>
				) }
			</button>
			{ isOpen && (
				<Popover
					anchor={ btnRef.current }
					onClose={ () => setIsOpen( false ) }
					placement="bottom-start"
					className="rkx-as-field-formatter-popover"
				>
					<p className="rkx-as-field-formatter-popover__title">
						{ __( 'Field Formatters', 'rkx-api-studio' ) }
					</p>
					<div className="rkx-as-field-formatter-popover__list">
						{ FIELD_FORMATTERS.map( ( { id, label } ) => (
							<CheckboxControl
								key={ id }
								label={ label }
								checked={ stringFormatters.includes( id ) }
								onChange={ ( checked ) =>
									handleChange( id, checked )
								}
							/>
						) ) }
					</div>
					{ applyFilters( RKX_AS_HOOK_FORMATTER_SECTIONS, null, {
						fieldId,
						activeFormatters,
						dispatch,
					} ) }
				</Popover>
			) }
		</span>
	);
}

export function getFieldLabel(
	fieldId: string,
	dataSource?: string,
	metadata?: DataSourceMetadata
): string {
	if ( isMetaField( fieldId ) ) {
		const key = getMetaKey( fieldId );
		return key.trim() !== '' && ! /^\d+$/.test( key )
			? key
			: __( 'Custom Meta Field', 'rkx-api-studio' );
	}

	if ( isTaxonomyField( fieldId ) ) {
		const slug = getTaxonomySlug( fieldId );

		// Look up the full label from metadata when available
		if ( dataSource && metadata ) {
			const postTypeItem = metadata.postTypes.find(
				( item ) =>
					item.slug === dataSource || item.restBase === dataSource
			);
			const taxonomy = postTypeItem?.taxonomies?.find(
				( t ) => t.slug === slug
			);
			if ( taxonomy ) {
				return taxonomy.label;
			}
		}

		// Fallback to the slug itself
		return slug;
	}

	const field = ALL_FIELDS.find( ( f ) => f.id === fieldId );
	return applyValueFilters(
		'rkxAs.field.label',
		field ? field.label : fieldId,
		fieldId
	) as string;
}

function SortableFieldItem( {
	fieldId,
	onRemove,
	dispatch,
	dataSource,
	metadata,
	activeFormatters = [],
	extensionData,
	config,
}: SortableFieldItemProps ) {
	const {
		attributes,
		listeners,
		setNodeRef,
		setActivatorNodeRef,
		transform,
		transition,
		isDragging,
	} = useSortable( { id: fieldId } );

	// Use local state for the meta key input to avoid re-renders on every keystroke.
	// Dispatch the update only on blur (when the user leaves the input).
	const rawKey = isMetaField( fieldId ) ? getMetaKey( fieldId ) : '';
	const initialKey = /^\d+$/.test( rawKey ) ? '' : rawKey;
	const [ localMetaKey, setLocalMetaKey ] = useState( initialKey );

	const style: React.CSSProperties = {
		transform: CSS.Transform.toString( transform ),
		transition: transition || undefined,
		opacity: isDragging ? 0.5 : 1,
	};

	const handleRemoveClick = ( e: React.MouseEvent ) => {
		e.stopPropagation();
		e.preventDefault();
		onRemove( fieldId );
	};

	const handleMetaKeyBlur = () => {
		const newField = `${ META_PREFIX }${ localMetaKey }`;
		if ( newField !== fieldId ) {
			dispatch( {
				type: 'UPDATE_META_KEY',
				payload: {
					oldField: fieldId,
					newField,
				},
			} );
		}
	};

	return (
		<div className="rkx-as-sortable-field-item-wrapper">
			<div
				ref={ setNodeRef }
				className="rkx-as-sortable-field-item"
				style={ style }
				{ ...attributes }
			>
				<span
					ref={ setActivatorNodeRef }
					className="rkx-as-sortable-field-item__handle"
					{ ...listeners }
				>
					☰
				</span>
				<span className="rkx-as-sortable-field-item__label">
					{ isMetaField( fieldId ) ? (
						<TextControl
							value={ localMetaKey }
							placeholder={ __(
								'Enter meta key…',
								'rkx-api-studio'
							) }
							onChange={ ( newKey: string ) => {
								setLocalMetaKey( newKey );
							} }
							onBlur={ handleMetaKeyBlur }
						/>
					) : (
						getFieldLabel( fieldId, dataSource, metadata )
					) }
				</span>
				{ Boolean(
					applyValueFilters( 'rkxAs.field.formattersVisible', true, {
						fieldId,
						extensionData,
					} )
				) && (
					<FieldFormatterPopover
						fieldId={ fieldId }
						activeFormatters={ activeFormatters }
						dispatch={ dispatch }
					/>
				) }
				<button
					type="button"
					className="rkx-as-sortable-field-item__remove"
					onClick={ handleRemoveClick }
					aria-label={ __( 'Remove field', 'rkx-api-studio' ) }
				>
					✕
				</button>
			</div>
			{ applyFilters( 'rkxAs.field.details', null, {
				fieldId,
				dispatch,
				extensionData,
				config,
			} ) }
		</div>
	);
}

export function ActiveOutputZone( {
	fields,
	dispatch,
	errors,
	dataSource,
	metadata,
	fieldFormattersMap = {},
	extensionData,
	config,
}: ActiveOutputZoneProps ) {
	const { setNodeRef, isOver } = useDroppable( {
		id: 'active-output',
	} );

	const handleRemove = ( fieldId: string ) => {
		dispatch( { type: 'REMOVE_FIELD', payload: fieldId } );
	};

	const className = [
		'rkx-as-active-output-zone',
		isOver ? 'rkx-as-active-output-zone--over' : '',
		errors?.fields ? 'rkx-as-active-output-zone--error' : '',
	]
		.filter( Boolean )
		.join( ' ' );

	return (
		<div ref={ setNodeRef } className={ className }>
			<h3 className="rkx-as-active-output-zone__title">
				{ __( 'Active Output Zone', 'rkx-api-studio' ) }
			</h3>
			{ errors?.fields && (
				<p className="rkx-as-active-output-zone__error">
					{ errors.fields }
				</p>
			) }
			{ fields.length === 0 ? (
				<div className="rkx-as-active-output-zone__placeholder">
					<p>
						{ __(
							'Drag fields from the Available Fields panel to define your API response structure.',
							'rkx-api-studio'
						) }
					</p>
				</div>
			) : (
				<SortableContext
					items={ fields }
					strategy={ verticalListSortingStrategy }
				>
					{ fields.map( ( fieldId ) => {
						return (
							<SortableFieldItem
								key={ fieldId }
								fieldId={ fieldId }
								onRemove={ handleRemove }
								dispatch={ dispatch }
								dataSource={ dataSource }
								metadata={ metadata }
								activeFormatters={
									fieldFormattersMap[ fieldId ] ?? []
								}
								extensionData={ extensionData }
								config={ config }
							/>
						);
					} ) }
				</SortableContext>
			) }
		</div>
	);
}
