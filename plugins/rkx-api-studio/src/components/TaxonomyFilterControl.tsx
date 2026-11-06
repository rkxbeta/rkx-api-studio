import { useState, useEffect, useCallback } from '@wordpress/element';
import { FormTokenField } from '@wordpress/components';
import type { BuilderAction } from '../hooks/useEndpointBuilder';
import { useTermSearch } from '../hooks/useTermSearch';
import { fetchTermsByIds } from '../api/client';

interface TaxonomyFilterControlProps {
	taxonomy: { slug: string; label: string };
	selectedTermIds: number[];
	disabled: boolean;
	dispatch: React.Dispatch< BuilderAction >;
}

/**
 * A taxonomy filter control that wraps FormTokenField with debounced
 * autocomplete search. Dispatches SET_TAXONOMY_FILTER on token changes
 * and resolves saved term IDs to display names on mount (edit mode).
 * @param root0
 * @param root0.taxonomy
 * @param root0.selectedTermIds
 * @param root0.disabled
 * @param root0.dispatch
 */
export function TaxonomyFilterControl( {
	taxonomy,
	selectedTermIds,
	disabled,
	dispatch,
}: TaxonomyFilterControlProps ) {
	const { suggestions, termMap, search } = useTermSearch( taxonomy.slug );

	// Map of term ID → display name for rendering tokens.
	const [ resolvedNames, setResolvedNames ] = useState<
		Map< number, string >
	>( new Map() );

	// Resolve saved term IDs to display names when selectedTermIds change.
	useEffect( () => {
		if ( selectedTermIds.length === 0 ) {
			setResolvedNames( new Map() );
			return;
		}

		// Skip fetching if all IDs are already resolved.
		const allResolved = selectedTermIds.every( ( id ) =>
			resolvedNames.has( id )
		);
		if ( allResolved ) {
			return;
		}

		let cancelled = false;

		fetchTermsByIds( taxonomy.slug, selectedTermIds )
			.then( ( terms ) => {
				if ( cancelled ) {
					return;
				}
				const nameMap = new Map< number, string >();
				for ( const term of terms ) {
					nameMap.set( term.id, term.name );
					// Also populate the termMap so name → ID resolution works
					// for tokens that were loaded from saved config.
					termMap.set( term.name, term.id );
				}
				setResolvedNames( nameMap );
			} )
			.catch( () => {
				// Name resolution failed — fallback tokens (numeric IDs) will be shown.
				if ( ! cancelled ) {
					// eslint-disable-next-line no-console
					console.warn(
						`TaxonomyFilterControl: Failed to resolve term names for taxonomy "${ taxonomy.slug }".`
					);
				}
			} );

		return () => {
			cancelled = true;
		};
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [ taxonomy.slug, selectedTermIds.join( ',' ) ] );

	// Build the current token list: display names when resolved, numeric IDs as fallback.
	const tokens: string[] = selectedTermIds.map( ( id ) => {
		return resolvedNames.get( id ) ?? String( id );
	} );

	const handleChange = useCallback(
		(
			newTokens: Parameters<
				NonNullable<
					React.ComponentProps< typeof FormTokenField >[ 'onChange' ]
				>
			>[ 0 ]
		) => {
			const newTermIds: number[] = [];

			for ( const token of newTokens ) {
				const tokenStr =
					typeof token === 'object' && 'value' in token
						? String( token.value )
						: String( token );

				// Try to resolve the token name to an ID via the termMap.
				const idFromMap = termMap.get( tokenStr );
				if ( idFromMap !== undefined ) {
					newTermIds.push( idFromMap );
					// Also update resolvedNames so the token displays correctly.
					setResolvedNames( ( prev ) => {
						const next = new Map( prev );
						next.set( idFromMap, tokenStr );
						return next;
					} );
					continue;
				}

				// Check if the token is a numeric ID (fallback token).
				const parsed = parseInt( tokenStr, 10 );
				if (
					! isNaN( parsed ) &&
					parsed > 0 &&
					String( parsed ) === tokenStr
				) {
					newTermIds.push( parsed );
					continue;
				}

				// Unknown token — skip it.
			}

			dispatch( {
				type: 'SET_TAXONOMY_FILTER',
				payload: { taxonomy: taxonomy.slug, termIds: newTermIds },
			} );
		},
		[ termMap, taxonomy.slug, dispatch ]
	);

	const handleInputChange = useCallback(
		( value: string ) => {
			search( value );
		},
		[ search ]
	);

	return (
		<div className="rkx-as-taxonomy-filter-control">
			<FormTokenField
				label={ taxonomy.label }
				value={ tokens }
				suggestions={ suggestions }
				onChange={ handleChange }
				onInputChange={ handleInputChange }
				disabled={ disabled }
				__experimentalAutoSelectFirstMatch
				__nextHasNoMarginBottom
			/>
		</div>
	);
}
