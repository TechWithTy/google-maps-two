"use client";
import { GoogleMap, LoadScript, DrawingManager } from "@react-google-maps/api";
import { useCallback, useEffect, useRef, useState } from "react";
import { getBoundsFromShape, generatePinsWithinBounds } from "../utils/bounds";
import { AirQualityMount } from "./map/AirQualityMount";
import { DrawingControls } from "./map/DrawingControls";
import { HoverOverlay } from "./map/HoverOverlay";

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
  // Optional external selection: when provided, fetch details and open popover
  selectedPlace?: { placeId?: string; location?: google.maps.LatLngLiteral } | null;
  // Actions from popover
  onViewPlace?: (payload: {
    placeId?: string;
    position: google.maps.LatLngLiteral;
    name?: string;
    address?: string;
    googleMapsUri?: string;
    website?: string;
  }) => void;
  onAddToList?: (payload: {
    placeId?: string;
    position: google.maps.LatLngLiteral;
    name?: string;
    address?: string;
    googleMapsUri?: string;
    website?: string;
  }) => void;
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
    selectedPlace,
    onViewPlace,
    onAddToList,
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
    formattedAddress?: string;
    url?: string;
    website?: string;
    phone?: string;
    rating?: number;
    userRatingsTotal?: number;
    openNow?: boolean;
    placeId?: string;
    googleMapsUri?: string;
    priceLevel?: number;
    businessStatus?: string;
    hoursToday?: string;
    editorialSummary?: string;
    photos?: any[];
    reviews?: any[];
    country?: string;
    addressType?: string; // e.g., street_address, premise, plus_code, route
  } | null>(null);
  const geocodeCache = useRef<Map<string, string>>(new Map());
  const placesRef = useRef<google.maps.places.PlacesService | null>(null);
  const geocodeReqId = useRef(0);
  const [validating, setValidating] = useState(false);
  const [validation, setValidation] = useState<any | null>(null);
  const [reviewsExpanded, setReviewsExpanded] = useState(false);
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
  // Suppress hover popover right after a click to avoid double popover
  const suppressHoverRef = useRef(false);
  // Color scheme readiness and enum
  const [colorSchemeEnum, setColorSchemeEnum] = useState<google.maps.ColorScheme | undefined>(undefined);
  const [googleReady, setGoogleReady] = useState(false);
  // Theme token HSL strings from CSS variables (no external util): e.g., "210 40% 98%"
  const [themeHsl, setThemeHsl] = useState<{ primary: string; background: string }>({ primary: "", background: "" });

  // Helper to safely extract a photo URL from various SDK shapes
  const getPhotoUrl = useCallback((photo: any, size = 320): string | null => {
    try {
      if (!photo) return null;
      if (typeof photo.getURI === "function") {
        return photo.getURI({ maxHeight: size, maxWidth: size });
      }
      if (typeof photo.getUrl === "function") {
        return photo.getUrl({ maxWidth: size, maxHeight: size });
      }
      if (typeof photo === "string") return photo;
      if (photo?.url) return photo.url;
    } catch {}
    return null;
  }, []);

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

  // Read CSS variables for tokens (HSL triplets) so we can feed Google Maps colors
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const root = document.documentElement;
      const styles = getComputedStyle(root);
      const primary = styles.getPropertyValue("--primary").trim();
      const background = styles.getPropertyValue("--background").trim();
      setThemeHsl({ primary, background });
    } catch {
      // no-op
    }
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
      // Also refresh CSS variable-derived colors on theme class changes
      const refreshCssVars = () => {
        try {
          const styles = getComputedStyle(document.documentElement);
          const primary = styles.getPropertyValue("--primary").trim();
          const background = styles.getPropertyValue("--background").trim();
          setThemeHsl((prev) => (prev.primary !== primary || prev.background !== background ? { primary, background } : prev));
        } catch {
          // ignore
        }
      };
      refreshCssVars();
      const mo = new MutationObserver(refreshCssVars);
      mo.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
      observer = mo;
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
      // Keep previous details if any; don't overwrite on cache hit
      return;
    }
    const reqId = ++geocodeReqId.current;
    try {
      const geocoder = new google.maps.Geocoder();
      geocoder.geocode({ location: pos }, (results, status) => {
        if (reqId !== geocodeReqId.current) return; // stale response
        const primary = status === "OK" && results && results[0] ? results[0] : null;
        const addr = primary?.formatted_address ?? "";
        geocodeCache.current.set(key, addr);
        setHoverAddress(addr);
        if (primary) {
          const get = (type: string, short = false) =>
            primary.address_components?.find((c) => c.types.includes(type))?.[short ? "short_name" : "long_name"];
          setHoverDetails((prev) => ({
            ...(prev || {}),
            formattedAddress: addr || undefined,
            neighborhood: get("neighborhood") || get("sublocality") || get("sublocality_level_1") || undefined,
            city: get("locality") || get("postal_town") || undefined,
            county: get("administrative_area_level_2") || undefined,
            state: get("administrative_area_level_1", true) || get("administrative_area_level_1") || undefined,
            postalCode: get("postal_code") || undefined,
            country: get("country", true) || undefined,
            addressType: primary.types?.[0] || undefined,
            // ensure we don't show business-only fields for residential-only addresses
            placeId: (prev?.placeId ? prev.placeId : undefined),
          }));
        }
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
    <div className="bg-background" style={{ position: "relative", width: "100%", height: containerStyle.height }}>
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
          // Use theme background if available; otherwise let Google default
          backgroundColor: themeHsl.background ? (`hsl(${themeHsl.background})` as unknown as string) : undefined,
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
            // If user clicked a POI, use Place.fetchFields (new Places SDK) to fetch details
            if ((e as any).placeId) {
              if (typeof (e as any).stop === "function") (e as any).stop();
              const placeId = (e as any).placeId as string;
              setHoverAddress("");
              setHoverDetails(null);
              setValidation(null);
              (async () => {
                try {
                  // New Places SDK
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  const placesLib: any = await (google.maps as any).importLibrary("places");
                  const PlaceCtor = placesLib.Place as any;
                  const place = new PlaceCtor({ id: placeId, requestedLanguage: "en" });
                  await place.fetchFields({
                    fields: [
                      "displayName",
                      "formattedAddress",
                      "location",
                      "rating",
                      "userRatingCount",
                      "currentOpeningHours",
                      "internationalPhoneNumber",
                      "websiteUri",
                      "id",
                      "googleMapsUri",
                      "priceLevel",
                      "businessStatus",
                      "editorialSummary",
                      "photos",
                      "reviews",
                    ],
                  });
                  const pos = place.location ? place.location.toJSON() : p!;
                  setHoverPosition(pos);
                  const title: string = place.displayName?.toString?.() ?? place.displayName ?? "";
                  const addr: string = place.formattedAddress ?? "";
                  setHoverAddress(title ? `${title}, ${addr}` : addr);
                  const openNow = typeof place.currentOpeningHours?.openNow === "boolean" ? place.currentOpeningHours.openNow : undefined;
                  setHoverDetails({
                    name: title || undefined,
                    formattedAddress: addr || undefined,
                    url: undefined, // not exposed in new fields; keep undefined
                    website: place.websiteUri ?? undefined,
                    phone: place.internationalPhoneNumber ?? undefined,
                    rating: typeof place.rating === "number" ? place.rating : undefined,
                    userRatingsTotal: typeof place.userRatingCount === "number" ? place.userRatingCount : undefined,
                    openNow,
                    placeId: place.id ?? placeId,
                    googleMapsUri: place.googleMapsUri ?? undefined,
                    priceLevel: typeof place.priceLevel === "number" ? place.priceLevel : undefined,
                    businessStatus: place.businessStatus ?? undefined,
                    hoursToday: Array.isArray(place.currentOpeningHours?.weekdayDescriptions)
                      ? place.currentOpeningHours.weekdayDescriptions[new Date().getDay() === 0 ? 6 : new Date().getDay() - 1]
                      : undefined,
                    editorialSummary: typeof place.editorialSummary?.text === "string" ? place.editorialSummary.text : undefined,
                    photos: Array.isArray(place.photos) ? place.photos.slice(0, 6) : undefined,
                    reviews: Array.isArray(place.reviews) ? place.reviews.slice(0, 3) : undefined,
                  });
                  validateAddressIfEnabled(addr || title);
                } catch {
                  // Fallback to legacy PlacesService if importLibrary or fields fail
                  if (placesRef.current) {
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
                          "place_id",
                          // best-effort legacy extras
                          // @ts-ignore
                          "price_level",
                          // @ts-ignore
                          "business_status",
                          // @ts-ignore
                          "photos",
                          // @ts-ignore
                          "reviews",
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
                            formattedAddress: place.formatted_address ?? undefined,
                            url: place.url ?? undefined,
                            website: place.website ?? undefined,
                            phone: place.international_phone_number ?? undefined,
                            rating: place.rating ?? undefined,
                            userRatingsTotal: place.user_ratings_total ?? undefined,
                            openNow,
                            placeId: place.place_id ?? undefined,
                            googleMapsUri: place.url ?? undefined,
                            // @ts-ignore legacy typings
                            priceLevel: typeof (place as any).price_level === "number" ? (place as any).price_level : undefined,
                            // @ts-ignore legacy typings
                            businessStatus: (place as any).business_status ?? undefined,
                            // @ts-ignore legacy typings
                            photos: Array.isArray((place as any).photos) ? (place as any).photos.slice(0, 6) : undefined,
                            // @ts-ignore legacy typings
                            reviews: Array.isArray((place as any).reviews) ? (place as any).reviews.slice(0, 3) : undefined,
                          });
                          validateAddressIfEnabled(addr || title);
                        }
                      },
                    );
                  }
                }
              })();
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
          {/* Lightbox overlay */}
          {lightboxUrl && (
            <div className="absolute inset-0 z-50 flex items-center justify-center bg-background/70" style={{ pointerEvents: "auto" }}>
              <div className="relative max-h-[90%] max-w-[90%]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={lightboxUrl} alt="Preview" className="max-h-[90vh] max-w-[90vw] rounded object-contain" />
                <button
                  type="button"
                  className="absolute right-2 top-2 rounded bg-card/90 px-2 py-1 text-xs text-foreground border border-border"
                  onClick={() => setLightboxUrl(null)}
                >
                  Close
                </button>
              </div>
            </div>
          )}
            </div>
          )}
          <DrawingControls
            drawingMode={drawingMode}
            setDrawingMode={setDrawingMode}
            shapeDrawn={shapeDrawn}
            boundaryApplied={boundaryApplied}
            onCancelDrawing={handleCancelDrawing}
            onApplyDrawing={handleApplyDrawing}
            onRemoveBoundaries={handleRemoveBoundaries}
          />
          <DrawingManager
            onPolygonComplete={onShapeComplete}
            onRectangleComplete={onShapeComplete}
            onCircleComplete={onShapeComplete}
            options={{
              drawingControl: false,
              drawingMode: drawingMode,
              polygonOptions: {
                // Use theme primary for shapes if available
                fillColor: themeHsl.primary ? (`hsl(${themeHsl.primary})` as unknown as string) : undefined,
                fillOpacity: 0.5,
                strokeColor: themeHsl.primary ? (`hsl(${themeHsl.primary})` as unknown as string) : undefined,
                strokeWeight: 2,
                clickable: false,
                editable: true,
                zIndex: 1,
              },
            }}
          />
          {addressHover && hoverPosition && (
            <HoverOverlay
              position={hoverPosition}
              address={hoverAddress}
              details={hoverDetails}
              validation={validation}
              validating={validating}
              reviewsExpanded={reviewsExpanded}
              setReviewsExpanded={setReviewsExpanded}
              getPhotoUrl={getPhotoUrl}
              setLightboxUrl={setLightboxUrl}
              onViewPlace={onViewPlace}
              onAddToList={onAddToList}
            />
          )}
        </GoogleMap>
      </div>
    </LoadScript>
  );
}
