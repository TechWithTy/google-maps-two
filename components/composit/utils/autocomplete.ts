export interface ACSeed {
  placeId?: string;
  location?: google.maps.LatLngLiteral;
  formattedAddress?: string;
  name?: string;
}

export type PlaceChangedHandler = (seed: ACSeed) => void;

export interface ACOptions {
  fields?: string[];
  types?: string[];
  // e.g., { country: 'us' }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  componentRestrictions?: any;
}

export async function initAutocomplete(
  input: HTMLInputElement,
  onPlaceChanged: PlaceChangedHandler,
  options?: ACOptions,
): Promise<() => void> {
  // SSR guard
  if (typeof window === "undefined") {
    return () => {};
  }

  let ac: any | null = null;
  let listener: any | null = null;

  // Wait until the global Places library is present to avoid double-loading via multiple loaders
  const waitUntilPlacesAvailable = async (timeoutMs = 8000, intervalMs = 100): Promise<boolean> => {
    const start = Date.now();
    for (;;) {
      const hasPlaces = !!((window as any).google?.maps as any)?.places;
      if (hasPlaces) return true;
      if (Date.now() - start > timeoutMs) return false;
      await new Promise((r) => setTimeout(r, intervalMs));
    }
  };

  await waitUntilPlacesAvailable();

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const placesLib: any = await ((window as any).google?.maps as any)?.importLibrary?.("places");
    const AutocompleteCtor = (placesLib as any)?.Autocomplete || ((window as any).google?.maps as any)?.places?.Autocomplete;
    if (!AutocompleteCtor) throw new Error("AutocompleteCtor missing");
    ac = new AutocompleteCtor(input, {
      fields: options?.fields || ["place_id", "geometry", "name", "formatted_address"],
      // When types is undefined, Google shows a broad set (cities, addresses, POIs)
      types: options?.types,
      componentRestrictions: options?.componentRestrictions,
    });
  } catch {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const LegacyAC = ((window as any).google?.maps as any)?.places?.Autocomplete;
    if (LegacyAC) {
      ac = new LegacyAC(input, {
        fields: options?.fields || ["place_id", "geometry", "name", "formatted_address"],
        types: options?.types,
        componentRestrictions: options?.componentRestrictions,
      });
    }
  }

  if (ac) {
    listener = ac.addListener("place_changed", () => {
      const place = ac.getPlace?.();
      const loc = place?.geometry?.location?.toJSON?.();
      const pid = place?.place_id as string | undefined;
      const formattedAddress = place?.formatted_address as string | undefined;
      const name = place?.name as string | undefined;
      if (loc && Number.isFinite(loc.lat) && Number.isFinite(loc.lng)) {
        onPlaceChanged({ placeId: pid, location: loc, formattedAddress, name });
      } else if (formattedAddress) {
        onPlaceChanged({ placeId: pid, formattedAddress });
      }
    });
  }

  return () => {
    if (listener) listener.remove?.();
  };
}
