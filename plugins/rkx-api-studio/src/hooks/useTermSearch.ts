import { useState, useCallback, useRef } from '@wordpress/element';
import apiFetch from '@wordpress/api-fetch';
import type { TermSearchResult } from '../types';

const DEBOUNCE_MS = 300;
const MIN_SEARCH_LENGTH = 3;

/**
 * Hook that provides debounced term search with AbortController cancellation.
 *
 * Calls `GET /rkx-api-studio/v1/terms?taxonomy={slug}&search={query}` when the
 * search string is ≥ 3 characters, debounced by 300ms. Maintains a `termMap`
 * (name → id) for resolving selected token names back to term IDs.
 *
 * @param taxonomy The taxonomy slug to search within.
 * @return Object with suggestions, termMap, search function, and loading state.
 */
export function useTermSearch( taxonomy: string ): {
	suggestions: string[];
	termMap: Map< string, number >;
	search: ( query: string ) => void;
	isLoading: boolean;
} {
	const [ suggestions, setSuggestions ] = useState< string[] >( [] );
	const [ isLoading, setIsLoading ] = useState< boolean >( false );
	const termMapRef = useRef< Map< string, number > >( new Map() );
	const abortControllerRef = useRef< AbortController | null >( null );
	const debounceTimerRef = useRef< ReturnType< typeof setTimeout > | null >(
		null
	);

	const search = useCallback(
		( query: string ) => {
			// Clear any pending debounce timer.
			if ( debounceTimerRef.current !== null ) {
				clearTimeout( debounceTimerRef.current );
				debounceTimerRef.current = null;
			}

			// Cancel any in-flight request.
			if ( abortControllerRef.current ) {
				abortControllerRef.current.abort();
				abortControllerRef.current = null;
			}

			// Below threshold: clear suggestions and bail out.
			if ( query.length < MIN_SEARCH_LENGTH ) {
				setSuggestions( [] );
				setIsLoading( false );
				return;
			}

			setIsLoading( true );

			debounceTimerRef.current = setTimeout( () => {
				const controller = new AbortController();
				abortControllerRef.current = controller;

				apiFetch< TermSearchResult[] >( {
					path: `/rkx-api-studio/v1/terms?taxonomy=${ encodeURIComponent(
						taxonomy
					) }&search=${ encodeURIComponent( query ) }`,
					signal: controller.signal,
				} )
					.then( ( results ) => {
						const names: string[] = [];
						for ( const term of results ) {
							termMapRef.current.set( term.name, term.id );
							names.push( term.name );
						}
						setSuggestions( names );
						setIsLoading( false );
					} )
					.catch( ( error: unknown ) => {
						// Silently ignore AbortError — expected when cancelling requests.
						if (
							error instanceof DOMException &&
							error.name === 'AbortError'
						) {
							return;
						}
						// Also handle the case where the error is a plain object with a name property,
						// which can happen with some fetch polyfills.
						if (
							typeof error === 'object' &&
							error !== null &&
							'name' in error &&
							( error as { name: string } ).name === 'AbortError'
						) {
							return;
						}
						setSuggestions( [] );
						setIsLoading( false );
					} );
			}, DEBOUNCE_MS );
		},
		[ taxonomy ]
	);

	return {
		suggestions,
		termMap: termMapRef.current,
		search,
		isLoading,
	};
}
