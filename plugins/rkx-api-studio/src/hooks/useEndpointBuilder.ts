import { applyFilters } from '@wordpress/hooks';
import { useReducer } from '@wordpress/element';
import type {
	EndpointConfig,
	FieldFormattersMap,
	DataSource,
	DataSourceMetadata,
	HttpMethod,
	OrderDirection,
	OrderbyField,
} from '../types';
import { getDefaultOrderby } from '../types';

export interface BuilderState {
	config: EndpointConfig;
	isDirty: boolean;
	isSaving: boolean;
	errors: Record< string, string >;
}

export type BuilderAction =
	| {
			type: 'SET_DATA_SOURCE';
			payload: { dataSource: DataSource; metadata: DataSourceMetadata };
	  }
	| { type: 'ADD_FIELD'; payload: string }
	| { type: 'REMOVE_FIELD'; payload: string }
	| { type: 'REORDER_FIELDS'; payload: string[] }
	| { type: 'SET_NAME'; payload: string }
	| { type: 'SET_SLUG'; payload: string }
	| { type: 'SET_PER_PAGE'; payload: number }
	| { type: 'SET_OFFSET'; payload: number }
	| { type: 'SET_ORDER'; payload: OrderDirection }
	| { type: 'SET_ORDERBY'; payload: OrderbyField }
	| { type: 'SAVE_SUCCESS'; payload: EndpointConfig }
	| { type: 'SAVE_ERROR'; payload: Record< string, string > }
	| { type: 'LOAD_CONFIG'; payload: EndpointConfig }
	| { type: 'VALIDATE'; payload: Record< string, string > }
	| { type: 'SET_DESCRIPTION'; payload: string }
	| { type: 'REGENERATE_SLUG' }
	| { type: 'SET_USE_WORDPRESS_DEFAULTS'; payload: boolean }
	| {
			type: 'UPDATE_META_KEY';
			payload: { oldField: string; newField: string };
	  }
	| {
			type: 'SET_TAXONOMY_FILTER';
			payload: { taxonomy: string; termIds: number[] };
	  }
	| { type: 'CLEAR_TAXONOMY_FILTERS' }
	| {
			type: 'SET_FIELD_FORMATTERS';
			payload: { field: string; formatters: string[] };
	  }
	| { type: 'SET_METHOD'; payload: HttpMethod }
	| { type: 'SET_PROTECTED'; payload: boolean };

/**
 * Actions defined by installed extensions. They are passed to the
 * `rkxAs.builder.reduce` filter by the default branch of builderReducer.
 */
export interface ExtensionBuilderAction {
	type: string;
	payload?: unknown;
}

function slugify( text: string ): string {
	return text
		.toLowerCase()
		.replace( /\s+/g, '-' )
		.replace( /[^a-z0-9-]/g, '' )
		.replace( /-+/g, '-' )
		.replace( /^-+|-+$/g, '' );
}

const defaultConfig: EndpointConfig = {
	id: '',
	name: '',
	slug: '',
	method: 'GET',
	dataSource: 'posts',
	fields: [],
	fieldFormatters: {},
	perPage: 10,
	offset: 0,
	order: 'DESC',
	orderby: 'date',
	useWordPressDefaults: false,
	taxonomyFilters: {},
};

export const initialState: BuilderState = {
	config: { ...defaultConfig },
	isDirty: false,
	isSaving: false,
	errors: {},
};

export function builderReducer(
	state: BuilderState,
	action: BuilderAction
): BuilderState {
	switch ( action.type ) {
		case 'SET_DATA_SOURCE': {
			return {
				...state,
				isDirty: true,
				errors: {},
				config: {
					...state.config,
					dataSource: action.payload.dataSource,
					fields: [],
					fieldFormatters: {},
					orderby: getDefaultOrderby(
						action.payload.dataSource,
						action.payload.metadata
					),
					customTaxonomy: undefined,
					taxonomyFilters: {},
				},
			};
		}

		case 'ADD_FIELD': {
			if ( state.config.fields.includes( action.payload ) ) {
				return state;
			}
			return {
				...state,
				isDirty: true,
				errors: {},
				config: {
					...state.config,
					fields: [ ...state.config.fields, action.payload ],
				},
			};
		}

		case 'REMOVE_FIELD': {
			const { [ action.payload ]: _removed, ...remainingFormatters } =
				state.config.fieldFormatters ?? {};
			return {
				...state,
				isDirty: true,
				errors: {},
				config: {
					...state.config,
					fields: state.config.fields.filter(
						( f ) => f !== action.payload
					),
					fieldFormatters: remainingFormatters,
				},
			};
		}

		case 'REORDER_FIELDS': {
			return {
				...state,
				isDirty: true,
				config: {
					...state.config,
					fields: action.payload,
				},
			};
		}

		case 'SET_NAME': {
			return {
				...state,
				isDirty: true,
				errors: {},
				config: {
					...state.config,
					name: action.payload,
				},
			};
		}

		case 'SET_SLUG': {
			return {
				...state,
				isDirty: true,
				errors: {},
				config: {
					...state.config,
					slug: action.payload,
				},
			};
		}

		case 'SET_DESCRIPTION': {
			return {
				...state,
				isDirty: true,
				errors: {},
				config: {
					...state.config,
					description: action.payload,
				},
			};
		}

		case 'REGENERATE_SLUG': {
			return {
				...state,
				isDirty: true,
				errors: {},
				config: {
					...state.config,
					slug: slugify( state.config.name ),
				},
			};
		}

		case 'SET_PER_PAGE': {
			return {
				...state,
				isDirty: true,
				errors: {},
				config: {
					...state.config,
					perPage: action.payload,
				},
			};
		}

		case 'SET_OFFSET': {
			return {
				...state,
				isDirty: true,
				errors: {},
				config: {
					...state.config,
					offset: action.payload,
				},
			};
		}

		case 'SET_ORDER': {
			return {
				...state,
				isDirty: true,
				errors: {},
				config: {
					...state.config,
					order: action.payload,
				},
			};
		}

		case 'SET_ORDERBY': {
			return {
				...state,
				isDirty: true,
				errors: {},
				config: {
					...state.config,
					orderby: action.payload,
				},
			};
		}

		case 'SET_USE_WORDPRESS_DEFAULTS': {
			return {
				...state,
				isDirty: true,
				errors: {},
				config: {
					...state.config,
					useWordPressDefaults: action.payload,
				},
			};
		}

		case 'UPDATE_META_KEY': {
			const { oldField, newField } = action.payload;
			if ( state.config.fields.includes( newField ) ) {
				return state;
			}
			const migratedFormatters: FieldFormattersMap = {
				...( state.config.fieldFormatters ?? {} ),
			};
			if ( migratedFormatters[ oldField ] ) {
				migratedFormatters[ newField ] = migratedFormatters[ oldField ];
				delete migratedFormatters[ oldField ];
			}
			return {
				...state,
				isDirty: true,
				errors: {},
				config: {
					...state.config,
					fields: state.config.fields.map( ( f ) =>
						f === oldField ? newField : f
					),
					fieldFormatters: migratedFormatters,
				},
			};
		}

		case 'SET_TAXONOMY_FILTER': {
			return {
				...state,
				isDirty: true,
				errors: {},
				config: {
					...state.config,
					taxonomyFilters: {
						...( state.config.taxonomyFilters ?? {} ),
						[ action.payload.taxonomy ]: action.payload.termIds,
					},
				},
			};
		}

		case 'CLEAR_TAXONOMY_FILTERS': {
			return {
				...state,
				config: {
					...state.config,
					taxonomyFilters: {},
				},
			};
		}

		case 'SET_FIELD_FORMATTERS': {
			const { field, formatters } = action.payload;
			const updatedFormatters: FieldFormattersMap = {
				...( state.config.fieldFormatters ?? {} ),
			};
			// Preserve existing object entries (like regex_replace) that aren't strings
			const existingObjectEntries = (
				state.config.fieldFormatters?.[ field ] ?? []
			).filter( ( entry ) => typeof entry !== 'string' );
			const merged = [ ...formatters, ...existingObjectEntries ];
			if ( merged.length === 0 ) {
				delete updatedFormatters[ field ];
			} else {
				updatedFormatters[ field ] = merged;
			}
			return {
				...state,
				isDirty: true,
				config: {
					...state.config,
					fieldFormatters: updatedFormatters,
				},
			};
		}

		case 'SET_METHOD': {
			return {
				...state,
				isDirty: true,
				errors: {},
				config: {
					...state.config,
					method: action.payload,
				},
			};
		}

		case 'SET_PROTECTED': {
			return {
				...state,
				isDirty: true,
				errors: {},
				config: {
					...state.config,
					protected: action.payload,
				},
			};
		}

		case 'SAVE_SUCCESS': {
			return {
				...state,
				isDirty: false,
				isSaving: false,
				errors: {},
				config: action.payload,
			};
		}

		case 'SAVE_ERROR': {
			return {
				...state,
				isSaving: false,
				errors: action.payload,
			};
		}

		case 'LOAD_CONFIG': {
			return {
				...state,
				isDirty: false,
				isSaving: false,
				errors: {},
				config: action.payload,
			};
		}

		case 'VALIDATE': {
			return {
				...state,
				errors: action.payload,
			};
		}

		default:
			return applyFilters(
				'rkxAs.builder.reduce',
				state,
				action
			) as BuilderState;
	}
}

export function useEndpointBuilder( initial?: EndpointConfig ) {
	const startState: BuilderState = initial
		? { ...initialState, config: initial }
		: initialState;

	const [ state, dispatch ] = useReducer( builderReducer, startState );

	return { state, dispatch };
}
