export function getBoundsFromShape(
  shape: google.maps.Polygon | google.maps.Rectangle | google.maps.Circle,
): google.maps.LatLngBounds | null {
  if (shape instanceof google.maps.Rectangle) {
    return shape.getBounds() ?? null;
  }
  if (shape instanceof google.maps.Circle) {
    return shape.getBounds() ?? null;
  }
  if (shape instanceof google.maps.Polygon) {
    const b = new google.maps.LatLngBounds();
    const path = shape.getPath();
    for (const latLng of path.getArray()) b.extend(latLng);
    return b;
  }
  return null;
}

export function isWithinCircle(
  circle: google.maps.Circle,
  point: google.maps.LatLng,
): boolean {
  const center = circle.getCenter();
  if (!center) return false;
  const radius = circle.getRadius();
  const d = google.maps.geometry.spherical.computeDistanceBetween(center, point);
  return d <= radius;
}

export function isWithinPolygon(
  polygon: google.maps.Polygon,
  point: google.maps.LatLng,
): boolean {
  return google.maps.geometry.poly.containsLocation(point, polygon);
}

export function generatePinsWithinBounds(
  bounds: google.maps.LatLngBounds,
  shape: google.maps.Polygon | google.maps.Rectangle | google.maps.Circle | null,
  count = 30,
): google.maps.LatLngLiteral[] {
  const pts: google.maps.LatLngLiteral[] = [];
  const sw = bounds.getSouthWest();
  const ne = bounds.getNorthEast();
  const rand = (min: number, max: number) => Math.random() * (max - min) + min;

  const within = (p: google.maps.LatLng) => {
    if (!shape) return true;
    if (shape instanceof google.maps.Circle) return isWithinCircle(shape, p);
    if (shape instanceof google.maps.Polygon) return isWithinPolygon(shape, p);
    return true; // rectangle handled by bounds
  };

  let attempts = 0;
  while (pts.length < count && attempts < count * 50) {
    attempts++;
    const lat = rand(sw.lat(), ne.lat());
    const lng = rand(sw.lng(), ne.lng());
    const p = new google.maps.LatLng(lat, lng);
    if (within(p)) pts.push({ lat, lng });
  }
  return pts;
}
