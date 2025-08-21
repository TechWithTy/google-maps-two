"use client";
import { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { NestedMapDialog } from "@/external/google-maps/components/Controls/NestedMapDialog";
import { MapWithDrawing } from "./MapWithDrawing";

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

  // Sync text inputs when coords change
  useEffect(() => {
    setLat(String(coords.lat));
    setLng(String(coords.lng));
  }, [coords]);

  return (
    <main className="container mx-auto max-w-5xl p-6">
      <h1 className="mb-4 text-2xl font-semibold">Google Maps Test</h1>
      <p className="mb-6 text-sm text-muted-foreground">
        Click on the map to drop a pin. Use the search inputs and controls to
        explore features.
      </p>
      <div className="mb-4 flex items-end justify-between gap-4">
        <div className="grid gap-2">
          <Input placeholder="Search address" aria-label="Search address" />
          <div className="grid grid-cols-2 gap-2">
            <Input
              value={lat}
              onChange={(e) => setLat(e.target.value)}
              placeholder="Latitude"
              aria-label="Latitude"
            />
            <Input
              value={lng}
              onChange={(e) => setLng(e.target.value)}
              placeholder="Longitude"
              aria-label="Longitude"
            />
          </div>
          <div className="flex gap-2">
            <Button
              type="button"
              onClick={() => {
                const nlat = Number(lat);
                const nlng = Number(lng);
                if (Number.isFinite(nlat) && Number.isFinite(nlng)) {
                  const c = { lat: nlat, lng: nlng } as google.maps.LatLngLiteral;
                  setCoords(c);
                }
              }}
            >
              Update Pin
            </Button>
            <Button type="button" variant="secondary">
              Save Location
            </Button>
          </div>
        </div>
        <NestedMapDialog
          coords={coords}
          results={simulatedPins}
          onApply={(c) => setCoords(c)}
          onResultsChange={(pins) => setSimulatedPins(pins)}
        />
      </div>
      <MapWithDrawing
        apiKey={
          process.env.NEXT_PUBLIC_GMAPS_KEY ||
          process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ||
          ""
        }
        mapId={process.env.NEXT_PUBLIC_GMAPS_MAP_ID}
        center={coords}
        onCenterChange={(c) => setCoords(c)}
        results={simulatedPins}
        onResultsChange={(pins) => setSimulatedPins(pins)}
        defaultZoom={12}
        containerStyle={mapContainerStyle}
        centerChangeZoom={16}
      />
    </main>
  );
}
