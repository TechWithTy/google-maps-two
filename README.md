# google-maps-two (submodule)

Reusable Google Maps UI components and helpers for Next.js/React apps.

This package provides:
- Components: `MapWithDrawing`, `MapsTestComposite`
- Utils: bounds helpers for shapes and pin generation

Directory: `external/google-maps-two/`

## Features
- Load Google Maps JS API (with drawing, geometry, places, marker libs)
- Draggable primary marker synced with app state
- Drawing tools (polygon/rectangle/circle) with overlay UI
- Fit bounds on apply; generate simulated pins within shape
- Typed utils for shape bounds and point-in-shape checks

## Installation
Use it directly in this monorepo, or copy the folder into another project.

Peer deps expected in the host app (see versions in root package.json):
- react, react-dom
- next (optional, but components are client components)
- @react-google-maps/api
- @types/google.maps (dev)

## Environment variables
Provide a Google Maps API key and (optionally) a Map ID for vector maps.

Copy to your root `.env.local` (or similar):

```
# One of the two keys below is sufficient — choose your convention
NEXT_PUBLIC_GMAPS_KEY=""
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=""

# Optional: map styling id from Google Cloud console
NEXT_PUBLIC_GMAPS_MAP_ID=""
```

You can also use the `.env.example` in this folder as a reference.

## Usage
Import from the barrel export:

```tsx
"use client";
import { MapWithDrawing } from "@/external/google-maps-two/components";

export default function Example() {
  const [center, setCenter] = useState({ lat: 39.7392, lng: -104.9903 });
  const [pins, setPins] = useState<google.maps.LatLngLiteral[]>([]);

  return (
    <MapWithDrawing
      apiKey={process.env.NEXT_PUBLIC_GMAPS_KEY || process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || ""}
      mapId={process.env.NEXT_PUBLIC_GMAPS_MAP_ID}
      center={center}
      onCenterChange={setCenter}
      results={pins}
      onResultsChange={setPins}
      defaultZoom={12}
      containerStyle={{ width: "100%", height: "500px" }}
      centerChangeZoom={16}
    />
  );
}
```

Or render the full demo page UI:

```tsx
import MapsTestPage from "@/app/maps-test/page"; // already re-exported
// or use directly
import { MapsTestComposite } from "@/external/google-maps-two/components";
```

## Exports
- Components: `@/external/google-maps-two/components`
  - `MapWithDrawing`
  - `MapsTestComposite`
- Utils: `@/external/google-maps-two/utils`
  - `getBoundsFromShape`
  - `isWithinCircle`
  - `isWithinPolygon`
  - `generatePinsWithinBounds`

## Notes
- Components assume TailwindCSS utility classes for styles, but work without Tailwind too.
- The composite uses your UI kit (`@/components/ui/*`) and `NestedMapDialog`; if extracting to a separate repo, either:
  - Move those into this package, or
  - Replace with your own UI/props.

## License
MIT
