"use client";
import { GoogleMap, LoadScript, DrawingManager, InfoWindow } from "@react-google-maps/api";
import { useCallback, useEffect, useRef, useState } from "react";
import { getBoundsFromShape, generatePinsWithinBounds } from "../utils/bounds";

export type MapWithDrawingProps = {
  apiKey: string;
  mapId?: string;
  libraries?: ("drawing" | "marker" | "places" | "geometry")[];
  center: google.maps.LatLngLiteral;
  onCenterChange: (c: google.maps.LatLngLiteral) => void;
  results: google.maps.LatLngLiteral[];
  onResultsChange: (pins: google.maps.LatLngLiteral[]) => void;
  defaultZoom?: number;
  containerStyle?: { width: string; height: string };
  centerChangeZoom?: number;
  showAirQualityMeter?: boolean;
  // Refinement options
  pinSnapToGrid?: boolean;
  pinGridSizeDeg?: number; // e.g., 0.001 degrees ~ 100m
  // Address info window on hover
  showAddressHoverInfo?: boolean;
  // Deprecated: kept for backward compatibility
  showAddressInfoWindow?: boolean;
  // Address validation (Preview API)
  enableAddressValidation?: boolean;
  validationRegionCode?: string; // default US
  validationLanguageCode?: string; // default en
  // Pre-render validation for pins
  validatePinsBeforeRender?: boolean; // default true
  onPinValidated?: (payload: {
    pin: google.maps.LatLngLiteral;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    validation: any | null;
    formattedAddress: string;
  }) => void;
  // Map color scheme: light, dark, or follow system/app theme
  mapColorScheme?: "light" | "dark" | "system";
};

const defaultContainer = { width: "100%", height: "500px" } as const;

export function MapWithDrawing(props: MapWithDrawingProps) {
  const {
    apiKey,
    mapId,
    libraries = ["drawing", "marker", "places", "geometry"],
    center,
    onCenterChange,
    results,
    onResultsChange,
    defaultZoom = 12,
    containerStyle = defaultContainer,
    centerChangeZoom,
    showAirQualityMeter = true,
    pinSnapToGrid = false,
    pinGridSizeDeg = 0.001,
    showAddressHoverInfo,
    showAddressInfoWindow,
    enableAddressValidation = false,
    validationRegionCode = "US",
    validationLanguageCode = "en",
    validatePinsBeforeRender = true,
    onPinValidated,
    mapColorScheme = "system",
  } = props;

  // Compute final flag with backward compatibility
  const addressHover =
    typeof showAddressHoverInfo === "boolean"
      ? showAddressHoverInfo
      : showAddressInfoWindow ?? true;

  const [drawingMode, setDrawingMode] =
    useState<google.maps.drawing.OverlayType | null>(null);
  const [shapeDrawn, setShapeDrawn] = useState(false);
  const [boundaryApplied, setBoundaryApplied] = useState(false);

  const shapeRef = useRef<
    google.maps.Polygon | google.maps.Rectangle | google.maps.Circle | null
  >(null);
  const mapRef = useRef<google.maps.Map | null>(null);
  const markerRef = useRef<google.maps.marker.AdvancedMarkerElement | null>(
    null,
  );
  const simMarkerRefs = useRef<google.maps.marker.AdvancedMarkerElement[]>([]);
  const isUserDraggingRef = useRef(false);
  // Air quality meter element host and ref
  const meterHostRef = useRef<HTMLDivElement | null>(null);
  const meterElRef = useRef<any>(null);
  // Hover InfoWindow state
  const [hoverPosition, setHoverPosition] = useState<google.maps.LatLngLiteral | null>(null);
  const [hoverAddress, setHoverAddress] = useState<string>("");
  const [hoverDetails, setHoverDetails] = useState<{
    name?: string;
    url?: string;
    website?: string;
    phone?: string;
    rating?: number;
    userRatingsTotal?: number;
    openNow?: boolean;
  } | null>(null);
  const geocodeCache = useRef<Map<string, string>>(new Map());
  const placesRef = useRef<google.maps.places.PlacesService | null>(null);
  const geocodeReqId = useRef(0);
  const [validating, setValidating] = useState(false);
  const [validation, setValidation] = useState<any | null>(null);
  // Suppress hover popover right after a click to avoid double popover
  const suppressHoverRef = useRef(false);
  // Color scheme readiness and enum
  const [colorSchemeEnum, setColorSchemeEnum] = useState<google.maps.ColorScheme | undefined>(undefined);
  const [googleReady, setGoogleReady] = useState(false);

  const clearShape = useCallback(() => {
    if (shapeRef.current) {
      shapeRef.current.setMap(null);
      shapeRef.current = null;
    }
  }, []);

  // Load ColorScheme enum and resolve which scheme to use before map init
  useEffect(() => {
    if (!googleReady) return;
    let mounted = true;
    (async () => {
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const core: any = await (google.maps as any).importLibrary("core");
        const CS: typeof google.maps.ColorScheme = core.ColorScheme ?? (google.maps as any).ColorScheme;
        if (!mounted || !CS) return;
        if (mapColorScheme === "light") {
          setColorSchemeEnum(CS.LIGHT);
          return;
        }
        if (mapColorScheme === "dark") {
          setColorSchemeEnum(CS.DARK);
          return;
        }
        // system: force dark initially if app or system prefers dark; otherwise follow system
        const prefersAppDark = typeof document !== "undefined" && document.documentElement.classList.contains("dark");
        const mql = typeof window !== "undefined" ? window.matchMedia("(prefers-color-scheme: dark)") : undefined;
        const prefersSystemDark = !!mql?.matches;
        setColorSchemeEnum(prefersAppDark || prefersSystemDark ? CS.DARK : CS.FOLLOW_SYSTEM);
      } catch {
        // Fallback: no enum -> undefined (map will use default light)
        setColorSchemeEnum(undefined);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [googleReady, mapColorScheme]);

  // Track theme changes and remount map when scheme should change
  const [mapKey, setMapKey] = useState(0);
  useEffect(() => {
    if (!googleReady) return;
    let disposed = false;
    let observer: MutationObserver | null = null;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let CS: typeof google.maps.ColorScheme | undefined;
    // Setup listeners only for system mode
    if (mapColorScheme !== "system") return;
    (async () => {
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const core: any = await (google.maps as any).importLibrary("core");
        CS = core.ColorScheme ?? (google.maps as any).ColorScheme;
      } catch {
        CS = undefined;
      }
      if (disposed) return;
      const mql = window.matchMedia("(prefers-color-scheme: dark)");
      const evalAndSet = () => {
        const prefersAppDark = document.documentElement.classList.contains("dark");
        if (!CS) return;
        const next = prefersAppDark || mql.matches ? CS.DARK : CS.FOLLOW_SYSTEM;
        setColorSchemeEnum((prev) => {
          if (prev !== next) {
            setMapKey((k) => k + 1); // force remount of GoogleMap
          }
          return next;
        });
      };
      const mqlHandler = () => evalAndSet();
      mql.addEventListener?.("change", mqlHandler);
      // Observe html class changes
      observer = new MutationObserver(evalAndSet);
      observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
      // Initial check
      evalAndSet();
      // Cleanup
      return () => {
        mql.removeEventListener?.("change", mqlHandler);
      };
    })();
    return () => {
      disposed = true;
      if (observer) {
        observer.disconnect();
      }
    };
  }, [googleReady, mapColorScheme]);

  // Get validation result without touching component UI state
  const fetchAddressValidation = useCallback(async (address: string) => {
    if (!enableAddressValidation || !address) return null;
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { AddressValidation }: any = await (google.maps as any).importLibrary("addressValidation");
      const result = await AddressValidation.fetchAddressValidation({
        address: {
          addressLines: [address],
          regionCode: validationRegionCode,
          languageCode: validationLanguageCode,
        },
      });
      return result;
    } catch {
      return null;
    }
  }, [enableAddressValidation, validationRegionCode, validationLanguageCode]);

  // Reverse geocode but return the formatted address without touching UI state
  const reverseGeocodeOnce = useCallback(async (pos: google.maps.LatLngLiteral): Promise<string> => {
    const key = `${pos.lat.toFixed(6)},${pos.lng.toFixed(6)}`;
    const cached = geocodeCache.current.get(key);
    if (cached) return cached;
    return new Promise<string>((resolve) => {
      try {
        const geocoder = new google.maps.Geocoder();
        geocoder.geocode({ location: pos }, (results, status) => {
          const addr = status === "OK" && results && results[0] ? results[0].formatted_address ?? "" : "";
          geocodeCache.current.set(key, addr);
          resolve(addr);
        });
      } catch {
        resolve("");
      }
    });
  }, []);

  const onShapeComplete = useCallback(
    (shape: google.maps.Polygon | google.maps.Rectangle | google.maps.Circle) => {
      clearShape();
      shapeRef.current = shape;
      setDrawingMode(null);
      setShapeDrawn(true);
    },
    [clearShape],
  );

  const handleCancelDrawing = useCallback(() => {
    clearShape();
    setDrawingMode(null);
    setShapeDrawn(false);
    setBoundaryApplied(false);
    onResultsChange([]);
    for (const m of simMarkerRefs.current) m.map = null;
    simMarkerRefs.current = [];
  }, [clearShape, onResultsChange]);

  const handleApplyDrawing = useCallback(() => {
    if (!shapeRef.current || !mapRef.current) return;
    const bounds = getBoundsFromShape(shapeRef.current);
    if (bounds) mapRef.current.fitBounds(bounds);
    if (bounds) {
      const pins = generatePinsWithinBounds(bounds, shapeRef.current, 30);
      onResultsChange(pins);
      setBoundaryApplied(true);
    }
  }, [onResultsChange]);

  const handleRemoveBoundaries = useCallback(() => {
    handleCancelDrawing();
  }, [handleCancelDrawing]);

  // Render simulated pins as AdvancedMarkers (draggable; dblclick to delete)
  useEffect(() => {
    if (!mapRef.current) return;
    // Clear previous sim markers
    for (const m of simMarkerRefs.current) m.map = null;
    simMarkerRefs.current = [];
    if (results && results.length) {
      const buildMarker = (p: google.maps.LatLngLiteral, index: number) => {
        const marker = new google.maps.marker.AdvancedMarkerElement({
          map: mapRef.current!,
          position: p,
          gmpDraggable: true,
          zIndex: 10,
        });
        marker.addListener("dragend", (e: google.maps.MapMouseEvent) => {
          const pos = e.latLng?.toJSON();
          if (!pos) return;
          const next = results.slice();
          let newPos = pos;
          if (pinSnapToGrid && pinGridSizeDeg > 0) {
            const snap = (v: number, step: number) => Math.round(v / step) * step;
            newPos = { lat: snap(pos.lat, pinGridSizeDeg), lng: snap(pos.lng, pinGridSizeDeg) };
          }
          next[index] = newPos;
          onResultsChange(next);
          // After snapping, validate the new address for analytics/UX
          (async () => {
            const addr = await reverseGeocodeOnce(newPos);
            const val = await fetchAddressValidation(addr);
            onPinValidated?.({ pin: newPos, validation: val, formattedAddress: addr });
          })();
        });
        // Hover events for simulated pins
        const onEnter = () => {
          if (!addressHover) return;
          if (suppressHoverRef.current) return;
          setHoverAddress("");
          setHoverDetails(null);
          setValidation(null);
          setHoverPosition(p);
          reverseGeocode(p);
        };
        const onLeave = () => {
          setHoverPosition(null);
          setHoverAddress("");
          setHoverDetails(null);
          setValidation(null);
        };
        marker.addListener("gmp-mouseover", onEnter as any);
        marker.addListener("mouseover", onEnter as any);
        marker.addListener("gmp-mouseout", onLeave as any);
        marker.addListener("mouseout", onLeave as any);
        return marker;
      };

      if (validatePinsBeforeRender) {
        // Validate pins sequentially before rendering to the map
        (async () => {
          const newMarkers: google.maps.marker.AdvancedMarkerElement[] = [];
          for (let i = 0; i < results.length; i++) {
            const p = results[i];
            const addr = await reverseGeocodeOnce(p);
            const val = await fetchAddressValidation(addr);
            onPinValidated?.({ pin: p, validation: val, formattedAddress: addr });
            // Regardless of verdict, we still render; adjust here if you want to filter
            const m = buildMarker(p, i);
            newMarkers.push(m);
          }
          simMarkerRefs.current = newMarkers;
        })();
      } else {
        simMarkerRefs.current = results.map((p, i) => buildMarker(p, i));
      }
    }
    return () => {
      for (const m of simMarkerRefs.current) m.map = null;
    };
  // Note: reverseGeocode is intentionally omitted to avoid TDZ during initial render since it's defined later.
  }, [results, addressHover, onResultsChange, pinSnapToGrid, pinGridSizeDeg, reverseGeocodeOnce, fetchAddressValidation, validatePinsBeforeRender, onPinValidated]);

  // Initialize / update AdvancedMarker for primary pin
  useEffect(() => {
    if (!mapRef.current || !center) return;
    if (!markerRef.current) {
      markerRef.current = new google.maps.marker.AdvancedMarkerElement({
        map: mapRef.current,
        position: center,
        gmpDraggable: true,
      });
      markerRef.current.addListener(
        "dragend",
        (e: google.maps.MapMouseEvent) => {
          const p = e.latLng?.toJSON();
          if (p) onCenterChange(p);
        },
      );
      // Hover events for center marker
      const onEnter = () => {
        if (!addressHover) return;
        if (suppressHoverRef.current) return;
        setHoverAddress("");
        setHoverDetails(null);
        setValidation(null);
        setHoverPosition(center);
        reverseGeocode(center);
      };
      const onLeave = () => {
        setHoverPosition(null);
        setHoverAddress("");
        setHoverDetails(null);
        setValidation(null);
      };
      markerRef.current.addListener("gmp-mouseover", onEnter as any);
      markerRef.current.addListener("mouseover", onEnter as any);
      markerRef.current.addListener("gmp-mouseout", onLeave as any);
      markerRef.current.addListener("mouseout", onLeave as any);
    } else {
      markerRef.current.position = center;
      if (!markerRef.current.map) markerRef.current.map = mapRef.current;
    }
    // Pan map to keep marker in view when center changes
    mapRef.current?.panTo(center);
    if (typeof centerChangeZoom === "number") {
      mapRef.current?.setZoom(centerChangeZoom);
    }
    // Update Air Quality meter location when center changes
    if (meterElRef.current) {
      meterElRef.current.setAttribute("location", `${center.lat},${center.lng}`);
    }
  }, [center, onCenterChange]);

  // Helper: reverse geocode with caching
  const reverseGeocode = useCallback((pos: google.maps.LatLngLiteral) => {
    const key = `${pos.lat.toFixed(6)},${pos.lng.toFixed(6)}`;
    const cached = geocodeCache.current.get(key);
    if (cached !== undefined) {
      setHoverAddress(cached);
      return;
    }
    const reqId = ++geocodeReqId.current;
    try {
      const geocoder = new google.maps.Geocoder();
      geocoder.geocode({ location: pos }, (results, status) => {
        if (reqId !== geocodeReqId.current) return; // stale response
        const addr = status === "OK" && results && results[0] ? results[0].formatted_address ?? "" : "";
        geocodeCache.current.set(key, addr);
        setHoverAddress(addr);
      });
    } catch {
      if (reqId === geocodeReqId.current) setHoverAddress("");
    }
  }, []);

  // Address Validation (optional, Preview API)
  const validateAddressIfEnabled = useCallback(async (address: string) => {
    if (!enableAddressValidation || !address) return;
    setValidating(true);
    setValidation(null);
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { AddressValidation }: any = await (google.maps as any).importLibrary("addressValidation");
      const result = await AddressValidation.fetchAddressValidation({
        address: {
          addressLines: [address],
          regionCode: validationRegionCode,
          languageCode: validationLanguageCode,
        },
      });
      setValidation(result);
    } catch {
      // noop
    } finally {
      setValidating(false);
    }
  }, [enableAddressValidation, validationRegionCode, validationLanguageCode]);

  return (
    <LoadScript
      googleMapsApiKey={apiKey}
      libraries={libraries}
      onLoad={() => setGoogleReady(true)}
    >
    <div style={{ position: "relative", width: "100%", height: containerStyle.height }}>
      <GoogleMap
        key={`map-${mapKey}-${colorSchemeEnum ?? "default"}`}
        mapContainerStyle={containerStyle}
        center={center}
        zoom={defaultZoom}
        options={{
          mapTypeId: "roadmap",
          disableDefaultUI: true,
          clickableIcons: true,
          gestureHandling: "greedy",
          backgroundColor: "#0B0B0C",
          ...(colorSchemeEnum ? { colorScheme: colorSchemeEnum } : {}),
          mapId: mapId,
        }}
        onLoad={(map) => {
          mapRef.current = map;
          try {
            placesRef.current = new google.maps.places.PlacesService(map);
          } catch {
            placesRef.current = null;
          }
          // Map click: if POI, show its details; else reverse-geocode clicked position
          map.addListener("click", (e: google.maps.MapMouseEvent) => {
            suppressHoverRef.current = true;
            setTimeout(() => {
              suppressHoverRef.current = false;
            }, 600);
            const p = e.latLng?.toJSON();
            // If user clicked a POI, use placeId to fetch details and show
            if ((e as any).placeId) {
              if (typeof (e as any).stop === "function") (e as any).stop();
              const placeId = (e as any).placeId as string;
              if (placesRef.current) {
                  setHoverAddress("");
                  setHoverDetails(null);
                  setValidation(null);
                  placesRef.current.getDetails(
                    {
                      placeId,
                      fields: [
                        "name",
                        "formatted_address",
                        "geometry",
                        "url",
                        "website",
                        "international_phone_number",
                        "opening_hours",
                        "rating",
                        "user_ratings_total",
                        "types",
                        "place_id",
                      ],
                    },
                    (place, status) => {
                      if (status === google.maps.places.PlacesServiceStatus.OK && place) {
                        const pos = place.geometry?.location?.toJSON() ?? p!;
                        setHoverPosition(pos);
                        const title = place.name ?? "";
                        const addr = place.formatted_address ?? "";
                        setHoverAddress(title ? `${title}, ${addr}` : addr);
                        const openNow = place.opening_hours?.isOpen?.() ?? undefined;
                        setHoverDetails({
                          name: place.name ?? undefined,
                          url: place.url ?? undefined,
                          website: place.website ?? undefined,
                          phone: place.international_phone_number ?? undefined,
                          rating: place.rating ?? undefined,
                          userRatingsTotal: place.user_ratings_total ?? undefined,
                          openNow,
                        });
                        validateAddressIfEnabled(addr || title);
                      }
                    },
                  );
                }
                return;
              }
              // Non-POI: show address for clicked lat/lng and also update center
              if (p) {
                setHoverAddress("");
                setHoverDetails(null);
                setValidation(null);
                setHoverPosition(p);
                reverseGeocode(p);
                onCenterChange(p);
                // Run validation after reverse geocode fills address
                // Defer slightly to allow reverseGeocode state to populate
                setTimeout(() => {
                  validateAddressIfEnabled(geocodeCache.current.get(`${p.lat.toFixed(6)},${p.lng.toFixed(6)}`) || "");
                }, 150);
              }
            });
            map.addListener("dragstart", () => {
              isUserDraggingRef.current = true;
            });
            map.addListener("idle", () => {
              if (!isUserDraggingRef.current) return;
              const c = map.getCenter()?.toJSON();
              if (c) onCenterChange(c);
              isUserDraggingRef.current = false;
            });
          }}
        >
          {showAirQualityMeter && (
            <div
              ref={meterHostRef}
              className="absolute bottom-4 left-4 z-10"
              style={{ pointerEvents: "auto" }}
            >
              {/* We attach the custom element on first render */}
              {!meterElRef.current && (
                <AirQualityMount
                  center={center}
                  onReady={(el) => {
                    meterElRef.current = el;
                    // Also append into host to ensure it's in DOM
                    if (meterHostRef.current && el && !meterHostRef.current.contains(el)) {
                      meterHostRef.current.appendChild(el);
                    }
                  }}
                />
              )}
            </div>
          )}
          {!boundaryApplied && (
            <div
              className="-translate-x-1/2 absolute top-10 left-1/2 z-10 transform rounded-lg bg-white p-2 text-center opacity-80 shadow-lg transition-opacity duration-300 hover:opacity-100 lg:top-2"
              style={{ pointerEvents: "auto" }}
            >
              {!drawingMode ? (
                <p className="mb-2 font-semibold text-gray-800 text-sm">
                  Draw a shape to search in that area
                </p>
              ) : (
                <p className="mb-2 font-semibold text-gray-800 text-sm">Start Drawing!</p>
              )}
              {!shapeDrawn && (
                <div className="mb-2 flex flex-col items-center space-y-2">
                  <div className="flex justify-center space-x-2">
                    <button
                      type="button"
                      className="rounded bg-blue-600 px-4 py-2 text-white text-xs hover:bg-blue-700"
                      onClick={() => setDrawingMode(google.maps.drawing.OverlayType.POLYGON)}
                    >
                      Polygon
                    </button>
                    <button
                      type="button"
                      className="rounded bg-blue-600 px-4 py-2 text-white text-xs hover:bg-blue-700"
                      onClick={() => setDrawingMode(google.maps.drawing.OverlayType.RECTANGLE)}
                    >
                      Rectangle
                    </button>
                    <button
                      type="button"
                      className="rounded bg-blue-600 px-4 py-2 text-white text-xs hover:bg-blue-700"
                      onClick={() => setDrawingMode(google.maps.drawing.OverlayType.CIRCLE)}
                    >
                      Circle
                    </button>
                  </div>
                  {drawingMode && (
                    <button
                      type="button"
                      className="mt-2 rounded bg-red-600 px-4 py-2 text-white text-xs hover:bg-red-700"
                      onClick={handleCancelDrawing}
                    >
                      Cancel Drawing
                    </button>
                  )}
                </div>
              )}
              {shapeDrawn && (
                <div className="flex justify-center space-x-4">
                  <button
                    type="button"
                    onClick={handleCancelDrawing}
                    className="rounded bg-gray-300 px-4 py-1 text-black shadow hover:bg-gray-400"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleApplyDrawing}
                    className="rounded bg-blue-600 px-4 py-1 text-white shadow hover:bg-blue-700"
                  >
                    Apply
                  </button>
                </div>
              )}
            </div>
          )}
          {boundaryApplied && (
            <button
              onClick={handleRemoveBoundaries}
              type="button"
              className="absolute top-4 right-4 z-10 flex cursor-pointer items-center rounded-lg bg-red-500 px-4 py-2 text-white shadow-lg hover:bg-red-600"
            >
              <span className="mr-2">Remove Boundaries</span>
              <button type="button">&#x2715;</button>
            </button>
          )}
          <DrawingManager
            onPolygonComplete={onShapeComplete}
            onRectangleComplete={onShapeComplete}
            onCircleComplete={onShapeComplete}
            options={{
              drawingControl: false,
              drawingMode: drawingMode,
              polygonOptions: {
                fillColor: "#2196F3",
                fillOpacity: 0.5,
                strokeWeight: 2,
                clickable: false,
                editable: true,
                zIndex: 1,
              },
            }}
          />
          {addressHover && hoverPosition && (
            <InfoWindow position={hoverPosition} options={{ disableAutoPan: false }}>
              <div className="max-w-xs rounded-md border bg-popover p-3 text-popover-foreground shadow">
                {hoverAddress ? (
                  <div className="space-y-1.5">
                    <div className="font-semibold leading-snug">
                      <span className="rounded bg-primary/15 px-1">
                        {hoverDetails?.name ?? hoverAddress.split(",")[0]}
                      </span>
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {hoverDetails?.name ? hoverAddress.replace(/^.*?,\s*/, "") : hoverAddress.split(",").slice(1).join(",").trim()}
                    </div>
                    {typeof hoverDetails?.rating === "number" && (
                      <div className="text-xs text-muted-foreground">
                        Rating: <span className="font-medium text-foreground">{hoverDetails.rating.toFixed(1)}</span>
                        {typeof hoverDetails.userRatingsTotal === "number" && ` (${hoverDetails.userRatingsTotal})`}
                      </div>
                    )}
                    {typeof hoverDetails?.openNow === "boolean" && (
                      <div className="text-xs">
                        <span className={`rounded px-1 ${hoverDetails.openNow ? "bg-green-500/15 text-green-600" : "bg-red-500/15 text-red-600"}`}>
                          {hoverDetails.openNow ? "Open now" : "Closed now"}
                        </span>
                      </div>
                    )}
                    {hoverDetails?.phone && (
                      <div className="text-xs text-muted-foreground">{hoverDetails.phone}</div>
                    )}
                    <div className="flex flex-wrap gap-3 pt-1">
                      <a
                        className="text-primary text-sm underline"
                        href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                          `${hoverPosition.lat},${hoverPosition.lng}`,
                        )}`}
                        target="_blank"
                        rel="noreferrer"
                      >
                        View on Google Maps
                      </a>
                      {hoverDetails?.website && (
                        <a className="text-primary text-sm underline" href={hoverDetails.website} target="_blank" rel="noreferrer">
                          Website
                        </a>
                      )}
                      {hoverDetails?.url && (
                        <a className="text-primary text-sm underline" href={hoverDetails.url} target="_blank" rel="noreferrer">
                          Place page
                        </a>
                      )}
                    </div>
                    {validation && (
                      <div className="mt-2 rounded border bg-card p-2 text-xs">
                        <div className="font-medium">Validation</div>
                        <div className="text-muted-foreground">Formatted: {validation.address?.formattedAddress || ""}</div>
                        <div className="text-muted-foreground">Entered: {validation.verdict?.inputGranularity || ""}</div>
                        <div className="text-muted-foreground">Validated: {validation.verdict?.validationGranularity || ""}</div>
                        <div className="text-muted-foreground">Complete: {String(validation.verdict?.addressComplete)}</div>
                        <div className="text-muted-foreground">Unconfirmed: {String(validation.verdict?.hasUnconfirmedComponents)}</div>
                      </div>
                    )}
                    {validating && (
                      <div className="text-xs text-muted-foreground">Validating…</div>
                    )}
                  </div>
                ) : (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <span className="inline-block h-3 w-3 animate-pulse rounded-full bg-muted" />
                    Fetching address…
                  </div>
                )}
              </div>
            </InfoWindow>
          )}
        </GoogleMap>
      </div>
    </LoadScript>
  );
}

// Helper component to mount the Air Quality custom element lazily
function AirQualityMount({
  center,
  onReady,
}: {
  center: google.maps.LatLngLiteral;
  onReady: (el: any) => void;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    // Always create the custom element tag; avoid experimental constructors
    const el: any = document.createElement("gmp-air-quality-meter");
    el.setAttribute("location", `${center.lat},${center.lng}`);
    if (containerRef.current) containerRef.current.appendChild(el);
    onReady(el);
    return () => {
      try {
        if (containerRef.current && el && containerRef.current.contains(el)) {
          containerRef.current.removeChild(el);
        }
      } catch {
        // noop
      }
    };
  }, []);
  return <div ref={containerRef} />;
}
