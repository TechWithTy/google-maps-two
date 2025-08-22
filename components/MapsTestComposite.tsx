"use client";
import { useEffect, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { NestedMapDialog } from "@/external/google-maps-two/components/Controls/NestedMapDialog";
import { MapWithDrawing } from "./MapWithDrawing";
import { SearchControls } from "@/external/google-maps-two/components/composit/components/SearchControls";
import { ResultsList } from "@/external/google-maps-two/components/composit/components/ResultsList";
import { initAutocomplete, type ACSeed } from "@/external/google-maps-two/components/composit/utils/autocomplete";
import { LocationInputs } from "@/external/google-maps-two/components/composit/components/LocationInputs";
import { PlaceSearchPanel } from "@/external/google-maps-two/components/composit/components/PlaceSearchPanel";

const defaultCenter: google.maps.LatLngLiteral = {
  lat: 39.7392,
  lng: -104.9903,
};

const mapContainerStyle = { width: "100%", height: "500px" } as const;

export function MapsTestComposite() {
  const [coords, setCoords] = useState<google.maps.LatLngLiteral>(defaultCenter);
  const [lat, setLat] = useState<string>(String(defaultCenter.lat));
  const [lng, setLng] = useState<string>(String(defaultCenter.lng));
  const [simulatedPins, setSimulatedPins] = useState<google.maps.LatLngLiteral[]>([]);
  const [savedPlaces, setSavedPlaces] = useState<Array<{ placeId?: string; position: google.maps.LatLngLiteral; name?: string; address?: string }>>([]);
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [radius, setRadius] = useState<string>("1000"); // meters
  const [placeType, setPlaceType] = useState<string>("");
  const [poiResults, setPoiResults] = useState<any[]>([]);
  const [hasNextPage, setHasNextPage] = useState<boolean>(false);
  const paginationRef = useRef<any | null>(null);
  const [loadingSearch, setLoadingSearch] = useState<boolean>(false);
  const [selectedPlace, setSelectedPlace] = useState<{ placeId?: string; location?: google.maps.LatLngLiteral } | null>(null);
  const lastACPlaceRef = useRef<ACSeed | null>(null);
  const debounceGuardRef = useRef<number | null>(null);

  // Sync text inputs when coords change
  useEffect(() => {
    setLat(String(coords.lat));
    setLng(String(coords.lng));
  }, [coords]);

  // Setup Places Autocomplete via util
  useEffect(() => {
    let cleanup: (() => void) | undefined;
    (async () => {
      if (!searchInputRef.current) return;
      cleanup = await initAutocomplete(searchInputRef.current, (seed) => {
        if (!seed.location) return;
        setCoords(seed.location);
        setLat(String(seed.location.lat));
        setLng(String(seed.location.lng));
        lastACPlaceRef.current = seed;
        if (seed.placeId) setSelectedPlace({ placeId: seed.placeId, location: seed.location });
      });
    })();
    return () => cleanup?.();
  }, []);

  return (
    <main className="container mx-auto max-w-5xl p-6">
      <h1 className="mb-4 text-2xl font-semibold">Google Maps Test</h1>
      <div className="mb-4 flex items-end justify-between gap-4">
        <div className="grid gap-2">
          <Input ref={searchInputRef} placeholder="Search address" aria-label="Search address" />
          <LocationInputs
            lat={lat}
            lng={lng}
            onLatChange={setLat}
            onLngChange={setLng}
            onUpdatePin={() => {
              const nlat = Number(lat);
              const nlng = Number(lng);
              if (Number.isFinite(nlat) && Number.isFinite(nlng)) {
                const c = { lat: nlat, lng: nlng } as google.maps.LatLngLiteral;
                setCoords(c);
              }
            }}
            onSave={() => { /* no-op placeholder */ }}
          />
          {/* Nearby / Text Search controls */}
          <SearchControls
            searchQuery={searchQuery}
            radius={radius}
            placeType={placeType}
            loading={loadingSearch}
            onSearchQueryChange={setSearchQuery}
            onRadiusChange={setRadius}
            onPlaceTypeChange={setPlaceType}
            onTextSearch={() => {
              try {
                setLoadingSearch(true);
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const svc = new (google.maps as any).places.PlacesService(document.createElement("div"));
                svc.textSearch(
                  {
                    query: searchQuery || "",
                    location: coords,
                    radius: Number(radius) || 1000,
                    type: placeType || undefined,
                  },
                  (results: any, status: any, pagination?: any) => {
                    if (status === google.maps.places.PlacesServiceStatus.OK && Array.isArray(results)) {
                      setPoiResults(results);
                      paginationRef.current = pagination || null;
                      setHasNextPage(!!pagination?.hasNextPage);
                    } else {
                      setPoiResults([]);
                      paginationRef.current = null;
                      setHasNextPage(false);
                    }
                    setLoadingSearch(false);
                  },
                );
              } catch {
                setPoiResults([]);
                paginationRef.current = null;
                setHasNextPage(false);
                setLoadingSearch(false);
              }
            }}
            onNearbySearch={() => {
              try {
                setLoadingSearch(true);
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const svc = new (google.maps as any).places.PlacesService(document.createElement("div"));
                svc.nearbySearch(
                  {
                    location: coords,
                    radius: Number(radius) || 1000,
                    keyword: searchQuery || undefined,
                    type: placeType || undefined,
                  },
                  (results: any, status: any, pagination?: any) => {
                    if (status === google.maps.places.PlacesServiceStatus.OK && Array.isArray(results)) {
                      setPoiResults(results);
                      paginationRef.current = pagination || null;
                      setHasNextPage(!!pagination?.hasNextPage);
                    } else {
                      setPoiResults([]);
                      paginationRef.current = null;
                      setHasNextPage(false);
                    }
                    setLoadingSearch(false);
                  },
                );
              } catch {
                setPoiResults([]);
                paginationRef.current = null;
                setHasNextPage(false);
                setLoadingSearch(false);
              }
            }}
            onNearbyFromSelection={() => {
              const now = Date.now();
              if (debounceGuardRef.current && now - debounceGuardRef.current < 800) return;
              debounceGuardRef.current = now;
              const seed = lastACPlaceRef.current;
              if (!seed?.location) return;
              const loc = seed.location as google.maps.LatLngLiteral;
              try {
                setLoadingSearch(true);
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const svc = new (google.maps as any).places.PlacesService(document.createElement("div"));
                svc.nearbySearch(
                  {
                    location: loc,
                    radius: Number(radius) || 1000,
                    keyword: searchQuery || undefined,
                    type: placeType || undefined,
                  },
                  (results: any, status: any, pagination?: any) => {
                    if (status === google.maps.places.PlacesServiceStatus.OK && Array.isArray(results)) {
                      setPoiResults(results);
                      paginationRef.current = pagination || null;
                      setHasNextPage(!!pagination?.hasNextPage);
                      setCoords(loc);
                    } else {
                      setPoiResults([]);
                      paginationRef.current = null;
                      setHasNextPage(false);
                    }
                    setLoadingSearch(false);
                  },
                );
              } catch {
                setPoiResults([]);
                paginationRef.current = null;
                setHasNextPage(false);
                setLoadingSearch(false);
              }
            }}
            nearbyFromSelectionDisabled={!lastACPlaceRef.current}
          />
          <ResultsList
            results={poiResults}
            loading={loadingSearch}
            hasNextPage={hasNextPage}
            onOpen={(r: any) => {
              const p = r.geometry?.location?.toJSON?.();
              if (p) {
                setCoords(p);
                setSimulatedPins((pins) => [...pins, p]);
                const pid = r.place_id as string | undefined;
                if (pid) setSelectedPlace({ placeId: pid, location: p });
              }
            }}
            onLoadMore={() => {
              try {
                setLoadingSearch(true);
                const p = paginationRef.current;
                if (p && p.hasNextPage) {
                  p.nextPage?.();
                }
              } catch {
                // ignore
              } finally {
                setTimeout(() => setLoadingSearch(false), 50);
              }
            }}
          />
        </div>
        <NestedMapDialog
          coords={coords}
          results={simulatedPins}
          onApply={(c) => {
            if (c) setCoords(c as google.maps.LatLngLiteral);
          }}
          onResultsChange={(pins) => setSimulatedPins(pins)}
        />
      </div>
      {/* Google Places UI Kit: Place Search List */}
      <PlaceSearchPanel
        center={coords}
        radiusMeters={Number(radius) || 1000}
        includedTypes={placeType ? [placeType] : undefined}
        onSelectPlace={(place: any) => {
          const loc = place?.location as google.maps.LatLngLiteral | undefined;
          if (!loc) return;
          setCoords(loc);
          setSimulatedPins((pins) => [...pins, loc]);
          const pid = (place?.id as string | undefined) ?? (place?.id?.toString?.());
          if (pid) setSelectedPlace({ placeId: pid, location: loc });
        }}
      />
      <MapWithDrawing
        apiKey={process.env.NEXT_PUBLIC_GMAPS_KEY || process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || ""}
        mapId={process.env.NEXT_PUBLIC_GMAPS_MAP_ID}
        center={coords}
        onCenterChange={(c) => setCoords(c)}
        results={simulatedPins}
        onResultsChange={(pins) => setSimulatedPins(pins)}
        defaultZoom={12}
        containerStyle={mapContainerStyle}
        centerChangeZoom={16}
        pinSnapToGrid
        pinGridSizeDeg={0.001}
        mapColorScheme="system"
        selectedPlace={selectedPlace}
        onViewPlace={({ placeId, position, googleMapsUri }) => {
          const base = googleMapsUri || `https://www.google.com/maps/search/?api=1${placeId ? `&query_place_id=${placeId}` : `&query=${encodeURIComponent(`${position.lat},${position.lng}`)}`}`;
          try {
            window.open(base, "_blank", "noopener,noreferrer");
          } catch {
            // no-op
          }
        }}
        onAddToList={({ placeId, position, name, address }) => {
          setSavedPlaces((list) => {
            const exists = list.some((p) => p.placeId && placeId && p.placeId === placeId);
            if (exists) return list;
            return [...list, { placeId, position, name, address }];
          });
        }}
      />
    </main>
  );
}
