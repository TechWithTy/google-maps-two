"use client";
import { useEffect, useRef } from "react";

export interface PlaceSearchPanelProps {
  center: google.maps.LatLngLiteral;
  radiusMeters: number; // capped at 50000 by UI Kit
  includedTypes?: string[];
  onSelectPlace?: (place: any) => void; // place from UI Kit element
}

// Renders Google's Places UI Kit web components for Place Search (Place List)
// and wires selection back to the parent component.
export function PlaceSearchPanel({ center, radiusMeters, includedTypes, onSelectPlace }: PlaceSearchPanelProps) {
  const searchElRef = useRef<HTMLElement | null>(null);
  const nearbyReqRef = useRef<HTMLElement | null>(null);

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
    const el = nearbyReqRef.current as any;
    if (!el) return;
    const capped = Math.min(Math.max(1, radiusMeters || 1), 50000);
    el.maxResultCount = 10;
    el.locationRestriction = { center, radius: capped };
    el.includedTypes = includedTypes && includedTypes.length ? includedTypes : undefined;
  }, [center, radiusMeters, includedTypes]);

  // Attach select event handler
  useEffect(() => {
    const searchEl = searchElRef.current as any;
    if (!searchEl) return;
    const handler = (evt: CustomEvent) => {
      const place = (evt as any).detail?.place ?? (evt as any).target?.place;
      if (place && onSelectPlace) onSelectPlace(place);
    };
    searchEl.addEventListener("gmp-select", handler as EventListener);
    return () => {
      searchEl.removeEventListener("gmp-select", handler as EventListener);
    };
  }, [onSelectPlace]);

  return (
    <section className="mt-6">
      <h2 className="mb-2 text-lg font-semibold">UI Kit: Place Search</h2>
      {/* Web component wrapper */}
      {/* eslint-disable react/no-unknown-property */}
      <gmp-place-search ref={searchElRef as any} style={{ display: "block" }}>
        <gmp-place-nearby-search-request ref={nearbyReqRef as any} />
      </gmp-place-search>
      {/* eslint-enable react/no-unknown-property */}
    </section>
  );
}
