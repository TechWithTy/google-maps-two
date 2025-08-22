export type PlaceResult = google.maps.places.PlaceResult;

export interface SearchOutcome {
  results: PlaceResult[];
  pagination: any | null; // Legacy pagination object
}

// Wraps legacy PlacesService.textSearch in a Promise
export function runTextSearch(params: {
  query: string;
  location: google.maps.LatLngLiteral;
  radius?: number;
  type?: string;
}): Promise<SearchOutcome> {
  return new Promise((resolve) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const svc = new (google.maps as any).places.PlacesService(document.createElement("div"));
    svc.textSearch(
      {
        query: params.query,
        location: params.location,
        radius: params.radius,
        type: params.type || undefined,
      },
      (results: PlaceResult[] | null, status: google.maps.places.PlacesServiceStatus, pagination?: any) => {
        if (status === google.maps.places.PlacesServiceStatus.OK && Array.isArray(results)) {
          resolve({ results, pagination: pagination || null });
        } else {
          resolve({ results: [], pagination: null });
        }
      },
    );
  });
}

// Wraps legacy PlacesService.nearbySearch in a Promise
export function runNearbySearch(params: {
  location: google.maps.LatLngLiteral;
  radius?: number;
  keyword?: string;
  type?: string;
}): Promise<SearchOutcome> {
  return new Promise((resolve) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const svc = new (google.maps as any).places.PlacesService(document.createElement("div"));
    svc.nearbySearch(
      {
        location: params.location,
        radius: params.radius,
        keyword: params.keyword || undefined,
        type: params.type || undefined,
      },
      (results: PlaceResult[] | null, status: google.maps.places.PlacesServiceStatus, pagination?: any) => {
        if (status === google.maps.places.PlacesServiceStatus.OK && Array.isArray(results)) {
          resolve({ results, pagination: pagination || null });
        } else {
          resolve({ results: [], pagination: null });
        }
      },
    );
  });
}
