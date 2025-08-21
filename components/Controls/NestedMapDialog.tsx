"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

// Minimal placeholder for demo usage in MapsTestComposite.
// Provides quick actions instead of a full modal UI.
export function NestedMapDialog({
  coords,
  results,
  onApply,
  onResultsChange,
}: {
  coords: google.maps.LatLngLiteral;
  results: google.maps.LatLngLiteral[];
  onApply: (c: google.maps.LatLngLiteral) => void;
  onResultsChange: (pins: google.maps.LatLngLiteral[]) => void;
}) {
  const [busy, setBusy] = useState(false);

  const addSimulatedPins = () => {
    setBusy(true);
    // Generate a few pins near the current coords
    const pins: google.maps.LatLngLiteral[] = Array.from({ length: 5 }).map((_, i) => ({
      lat: coords.lat + (Math.random() - 0.5) * 0.01,
      lng: coords.lng + (Math.random() - 0.5) * 0.01,
    }));
    onResultsChange([...(results || []), ...pins]);
    setBusy(false);
  };

  return (
    <div className="flex items-center gap-2">
      <Button type="button" variant="outline" onClick={() => onApply(coords)}>
        Apply Center
      </Button>
      <Button type="button" onClick={addSimulatedPins} disabled={busy}>
        {busy ? "Adding…" : "Add Pins"}
      </Button>
    </div>
  );
}
