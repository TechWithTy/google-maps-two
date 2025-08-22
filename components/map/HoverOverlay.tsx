"use client";

import { memo } from "react";
import { OverlayView } from "@react-google-maps/api";

export type HoverDetails = {
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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  photos?: any[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  reviews?: any[];
  country?: string;
  addressType?: string;
  neighborhood?: string;
  city?: string;
  state?: string;
  postalCode?: string;
};

export type HoverOverlayProps = {
  position: google.maps.LatLngLiteral;
  address: string;
  details: HoverDetails | null;
  validation: any | null; // eslint-disable-line @typescript-eslint/no-explicit-any
  validating: boolean;
  reviewsExpanded: boolean;
  setReviewsExpanded: (v: (prev: boolean) => boolean) => void;
  getPhotoUrl: (photo: any, size?: number) => string | null; // eslint-disable-line @typescript-eslint/no-explicit-any
  setLightboxUrl: (url: string | null) => void;
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

function HoverOverlayImpl({
  position,
  address,
  details,
  validation,
  validating,
  reviewsExpanded,
  setReviewsExpanded,
  getPhotoUrl,
  setLightboxUrl,
  onViewPlace,
  onAddToList,
}: HoverOverlayProps) {
  return (
    <OverlayView position={position} mapPaneName="floatPane">
      <div
        className="pointer-events-auto w-64 rounded-md border bg-popover p-3 text-popover-foreground shadow outline outline-1 outline-border"
        style={{ transform: "translate(-50%, -100%) translateY(-10px)" }}
      >
        {address ? (
          <div className="space-y-1.5">
            <div className="font-semibold leading-snug">
              <span className="rounded bg-primary/15 px-1">
                {details?.name ?? address.split(",")[0]}
              </span>
            </div>
            <div className="text-sm text-muted-foreground">
              {details?.name ? address.replace(/^.*?,\s*/, "") : address.split(",").slice(1).join(",").trim()}
            </div>
            {typeof details?.rating === "number" && (
              <div className="text-xs text-muted-foreground">
                Rating: <span className="font-medium text-foreground">{details.rating.toFixed(1)}</span>
                {typeof details.userRatingsTotal === "number" && ` (${details.userRatingsTotal})`}
              </div>
            )}
            {/* Residential details when not a POI */}
            {(!details?.placeId && (details?.city || details?.state || details?.postalCode || details?.country || details?.neighborhood)) && (
              <div className="space-y-1 pt-1 text-xs">
                <div className="font-medium text-foreground">Location details</div>
                {details?.neighborhood && (
                  <div className="text-muted-foreground">Neighborhood: {details.neighborhood}</div>
                )}
                <div className="text-muted-foreground">
                  {[details?.city, details?.state, details?.postalCode].filter(Boolean).join(", ")}
                </div>
                {details?.country && (
                  <div className="text-muted-foreground">{details.country}</div>
                )}
              </div>
            )}
            {typeof details?.openNow === "boolean" && (
              <div className="text-xs">
                <span className={`${details.openNow ? "bg-green-500/15 text-green-600" : "bg-red-500/15 text-red-600"} rounded px-1`}>
                  {details.openNow ? "Open now" : "Closed now"}
                </span>
              </div>
            )}
            {(details?.formattedAddress || typeof details?.rating === "number" || details?.priceLevel !== undefined || details?.businessStatus || details?.hoursToday || details?.editorialSummary) && (
              <div className="space-y-1 pt-1 text-xs">
                {details?.formattedAddress && (
                  <div className="text-muted-foreground">{details.formattedAddress}</div>
                )}
                {(typeof details?.rating === "number" || typeof details?.userRatingsTotal === "number") && (
                  <div>
                    <span className="font-medium text-foreground">{details.rating?.toFixed?.(1)}</span>
                    {typeof details?.userRatingsTotal === "number" && <span className="text-muted-foreground"> ({details.userRatingsTotal})</span>}
                  </div>
                )}
                {details?.priceLevel !== undefined && (
                  <div className="text-muted-foreground">{"$".repeat(Math.max(1, Math.min(4, details.priceLevel)))} price range</div>
                )}
                {details?.businessStatus && details.businessStatus !== "OPERATIONAL" && (
                  <div className="text-amber-600">Status: {details.businessStatus}</div>
                )}
                {details?.hoursToday && (
                  <div className="text-muted-foreground">Today: {details.hoursToday}</div>
                )}
                {details?.editorialSummary && (
                  <div className="text-muted-foreground line-clamp-3">{details.editorialSummary}</div>
                )}
              </div>
            )}
            {details?.phone && (
              <div className="text-xs text-muted-foreground">{details.phone}</div>
            )}
            {Array.isArray(details?.photos) && details!.photos!.length > 0 && (
              <div className="pt-2">
                <div className="grid grid-cols-3 gap-1">
                  {details!.photos!.slice(0, 3).map((ph, idx) => {
                    const src = getPhotoUrl(ph, 256);
                    return src ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        key={idx}
                        src={src}
                        alt="Place photo"
                        loading="lazy"
                        className="h-20 w-full cursor-zoom-in rounded object-cover"
                        onClick={() => setLightboxUrl(getPhotoUrl(ph, 1200))}
                      />
                    ) : null;
                  })}
                </div>
              </div>
            )}
            {Array.isArray(details?.reviews) && details!.reviews!.length > 0 && (
              <div className="pt-2 text-xs">
                <div className="font-medium text-foreground">Top review</div>
                {(() => {
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  const r: any = details!.reviews![0];
                  const author = r?.authorAttribution?.displayName || r?.author_name || "Reviewer";
                  const rating = typeof r?.rating === "number" ? r.rating : undefined;
                  const text: string = r?.text?.text || r?.text || "";
                  const short = text.length > 180 && !reviewsExpanded ? text.slice(0, 180) + "…" : text;
                  return (
                    <div className="space-y-1">
                      <div className="text-muted-foreground">{author}{rating ? ` • ${rating.toFixed(1)}★` : ""}</div>
                      <div className="text-foreground">{short}</div>
                      {text.length > 180 && (
                        <button type="button" className="text-primary underline" onClick={() => setReviewsExpanded((v) => !v)}>
                          {reviewsExpanded ? "Show less" : "Read more"}
                        </button>
                      )}
                    </div>
                  );
                })()}
              </div>
            )}
            <div className="flex flex-wrap items-center gap-3 pt-1">
              <a
                className="text-primary text-sm underline"
                href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                  details?.placeId ? "" : `${position.lat},${position.lng}`,
                )}${details?.placeId ? `&query_place_id=${details.placeId}` : ""}`}
                target="_blank"
                rel="noreferrer"
              >
                Open in Google Maps
              </a>
              <a
                className="text-primary text-sm underline"
                href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(
                  details?.placeId ? "" : `${position.lat},${position.lng}`,
                )}${details?.placeId ? `&destination_place_id=${details.placeId}` : ""}`}
                target="_blank"
                rel="noreferrer"
              >
                Directions
              </a>
              <a
                className="text-primary text-sm underline"
                href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                  `restaurants near ${position.lat},${position.lng}`,
                )}${details?.placeId ? `&query_place_id=${details.placeId}` : ""}`}
                target="_blank"
                rel="noreferrer"
              >
                Nearby
              </a>
              {details?.website && (
                <a className="text-primary text-sm underline" href={details.website} target="_blank" rel="noreferrer">
                  Website
                </a>
              )}
              {details?.url && (
                <a className="text-primary text-sm underline" href={details.url} target="_blank" rel="noreferrer">
                  Place page
                </a>
              )}
              <button
                type="button"
                className="rounded bg-primary px-2 py-1 text-xs text-primary-foreground"
                onClick={() => {
                  onViewPlace?.({
                    placeId: details?.placeId,
                    position,
                    name: details?.name,
                    address: details?.formattedAddress,
                    googleMapsUri: details?.googleMapsUri,
                    website: details?.website,
                  });
                }}
              >
                View place
              </button>
              <button
                type="button"
                className="rounded bg-secondary px-2 py-1 text-xs text-secondary-foreground"
                onClick={() => {
                  onAddToList?.({
                    placeId: details?.placeId,
                    position,
                    name: details?.name,
                    address: details?.formattedAddress,
                    googleMapsUri: details?.googleMapsUri,
                    website: details?.website,
                  });
                }}
              >
                Add to list
              </button>
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
    </OverlayView>
  );
}

export const HoverOverlay = memo(HoverOverlayImpl);
