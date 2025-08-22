"use client";
import { useEffect, useRef } from "react";

export function AirQualityMount({
  center,
  onReady,
}: {
  center: google.maps.LatLngLiteral;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onReady: (el: any) => void;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    // Always create the custom element tag; avoid experimental constructors
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
