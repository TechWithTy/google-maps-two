"use client";
import { useEffect, useRef } from "react";

interface PlaceElement extends HTMLElement {
  place?: UIPanelPlace;
}

/**
 * Minimal place shape emitted by Google's Places UI Kit web components.
 * This is not the same as google.maps.places.PlaceResult; the UI Kit provides
 * a streamlined object containing an id and a LatLngLiteral location.
 */
export interface UIPanelPlace {
	id?: string | number;
	location?: google.maps.LatLngLiteral;
	name?: string;
	address?: string;
}

export interface PlaceSearchPanelProps {
	center: google.maps.LatLngLiteral;
	radiusMeters: number; // capped at 50000 by UI Kit
	includedTypes?: string[];
	onSelectPlace?: (place: UIPanelPlace) => void; // place from UI Kit element
}

// Renders Google's Places UI Kit web components for Place Search (Place List)
// and wires selection back to the parent component.
export function PlaceSearchPanel({
	center,
	radiusMeters,
	includedTypes,
	onSelectPlace,
}: PlaceSearchPanelProps) {
	const searchElRef = useRef<PlaceSearchElement | null>(null);
	const nearbyReqRef = useRef<NearbySearchRequestElement | null>(null);

	/**
	 * Shape of the <gmp-place-nearby-search-request> custom element we interact with.
	 */
	interface NearbySearchRequestElement extends HTMLElement {
		maxResultCount?: number;
		locationRestriction?: { center: google.maps.LatLngLiteral; radius: number };
		includedTypes?: string[];
	}

	interface PlaceSearchElement extends HTMLElement {
		place?: UIPanelPlace;
	}

	// Ensure libraries for web components are loaded (maps/places)
	useEffect(() => {
		let cancelled = false;
		(async () => {
			try {
				await google.maps.importLibrary("maps");
				await google.maps.importLibrary("places");
				if (cancelled) return;
			} catch {
				// ignore; parent likely already loaded
			}
		})();
		return () => {
			cancelled = true;
		};
	}, []);

	// Update request element props when inputs change
	useEffect(() => {
		const el = nearbyReqRef.current;
		if (!el) return;
		const capped = Math.min(Math.max(1, radiusMeters || 1), 50000);
		el.maxResultCount = 10;
		el.locationRestriction = { center, radius: capped };
		el.includedTypes = includedTypes?.length ? includedTypes : undefined;
	}, [center, radiusMeters, includedTypes]);

	// Attach select event handler
	useEffect(() => {
		const searchEl = searchElRef.current;
		if (!searchEl) return;
		const handler = (evt: Event) => {
			// Custom event emitted by UI Kit: detail.place
			const ce = evt as CustomEvent<{ place?: UIPanelPlace }>;
			const target = evt.target as PlaceSearchElement;
			const maybePlace: UIPanelPlace | undefined = ce?.detail?.place ?? target?.place;
			// ! UI Kit may sometimes omit `detail.place`; only call when defined
			if (maybePlace) {
				onSelectPlace?.(maybePlace);
			}
		};
		searchEl.addEventListener("gmp-select", handler as EventListener);
		return () => {
			searchEl.removeEventListener("gmp-select", handler as EventListener);
		};
	}, [onSelectPlace]);

	return (
		<section className="mt-6">
			<h2 className="mb-2 font-semibold text-lg">UI Kit: Place Search</h2>
			{/* Web component wrapper */}
			{/* eslint-disable react/no-unknown-property */}
			<gmp-place-search ref={searchElRef} style={{ display: "block" }}>
				<gmp-place-nearby-search-request ref={nearbyReqRef} />
			</gmp-place-search>
			{/* eslint-enable react/no-unknown-property */}
		</section>
	);
}
