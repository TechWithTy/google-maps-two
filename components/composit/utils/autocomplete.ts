export interface ACSeed {
  placeId?: string;
  location?: google.maps.LatLngLiteral;
}

export type PlaceChangedHandler = (seed: ACSeed) => void;

export async function initAutocomplete(
  input: HTMLInputElement,
  onPlaceChanged: PlaceChangedHandler,
): Promise<() => void> {
  let ac: any | null = null;
  let listener: any | null = null;

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const placesLib: any = await (google.maps as any).importLibrary("places");
    const AutocompleteCtor = (placesLib as any).Autocomplete || (google.maps as any).places?.Autocomplete;
    if (!AutocompleteCtor) throw new Error("AutocompleteCtor missing");
    ac = new AutocompleteCtor(input, {
      fields: ["place_id", "geometry", "name", "formatted_address"],
      types: ["geocode"],
    });
  } catch {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const LegacyAC = (google.maps as any)?.places?.Autocomplete;
    if (LegacyAC) {
      ac = new LegacyAC(input, {
        fields: ["place_id", "geometry", "name", "formatted_address"],
        types: ["geocode"],
      });
    }
  }

  if (ac) {
    listener = ac.addListener("place_changed", () => {
      const place = ac.getPlace?.();
      const loc = place?.geometry?.location?.toJSON?.();
      const pid = place?.place_id as string | undefined;
      if (loc && Number.isFinite(loc.lat) && Number.isFinite(loc.lng)) {
        onPlaceChanged({ placeId: pid, location: loc });
      }
    });
  }

  return () => {
    if (listener) listener.remove?.();
  };
}
