"use client";
import { GoogleMap, LoadScript, DrawingManager } from "@react-google-maps/api";
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
  } = props;

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

  const clearShape = useCallback(() => {
    if (shapeRef.current) {
      shapeRef.current.setMap(null);
      shapeRef.current = null;
    }
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
    for (const m of simMarkerRefs.current) m.map = null;
    simMarkerRefs.current = [];
    if (window.google?.maps?.marker?.AdvancedMarkerElement) {
      simMarkerRefs.current = results.map((p, idx) => {
        const marker = new window.google.maps.marker.AdvancedMarkerElement({
          map: mapRef.current!,
          position: p,
          gmpDraggable: true,
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
          next[idx] = newPos;
          onResultsChange(next);
        });
        const handleCtrlDoubleClick = (ev: any) => {
          const ctrl = ev?.ctrlKey ?? ev?.domEvent?.ctrlKey ?? false;
          if (!ctrl) return;
          const next = results.slice();
          next.splice(idx, 1);
          onResultsChange(next);
        };
        // Support AdvancedMarker and regular double-click events
        marker.addListener("gmp-dblclick", handleCtrlDoubleClick as any);
        marker.addListener("dblclick", handleCtrlDoubleClick as any);
        // Fallback: detect two ctrl+clicks within threshold
        let lastCtrlClick = 0;
        const handleCtrlClickFallback = (ev: any) => {
          const ctrl = ev?.ctrlKey ?? ev?.domEvent?.ctrlKey ?? false;
          if (!ctrl) return;
          const now = Date.now();
          if (now - lastCtrlClick < 350) {
            const next = results.slice();
            next.splice(idx, 1);
            onResultsChange(next);
            lastCtrlClick = 0;
          } else {
            lastCtrlClick = now;
          }
        };
        marker.addListener("gmp-click", handleCtrlClickFallback as any);
        marker.addListener("click", handleCtrlClickFallback as any);
        return marker;
      });
    }
    return () => {
      for (const m of simMarkerRefs.current) m.map = null;
    };
  }, [results, onResultsChange, pinSnapToGrid, pinGridSizeDeg]);

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

  return (
    <LoadScript googleMapsApiKey={apiKey} libraries={libraries}>
      <div style={{ position: "relative", width: "100%", height: containerStyle.height }}>
        <GoogleMap
          mapContainerStyle={containerStyle}
          center={center}
          zoom={defaultZoom}
          options={{
            mapTypeId: "roadmap",
            disableDefaultUI: true,
            zoomControl: true,
            mapId,
          }}
          onLoad={(map) => {
            mapRef.current = map;
            map.addListener("click", (e: google.maps.MapMouseEvent) => {
              const p = e.latLng?.toJSON();
              if (p) onCenterChange(p);
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
