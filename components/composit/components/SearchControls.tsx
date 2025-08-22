"use client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import type { ChangeEvent } from "react";

export interface SearchControlsProps {
  searchQuery: string;
  radius: string;
  placeType: string;
  loading: boolean;
  onSearchQueryChange: (v: string) => void;
  onRadiusChange: (v: string) => void;
  onPlaceTypeChange: (v: string) => void;
  onTextSearch: () => void;
  onNearbySearch: () => void;
  onNearbyFromSelection: () => void;
  nearbyFromSelectionDisabled?: boolean;
}

export function SearchControls(props: SearchControlsProps) {
  const {
    searchQuery,
    radius,
    placeType,
    loading,
    onSearchQueryChange,
    onRadiusChange,
    onPlaceTypeChange,
    onTextSearch,
    onNearbySearch,
    onNearbyFromSelection,
    nearbyFromSelectionDisabled,
  } = props;

  return (
    <div className="mt-4 grid gap-2 rounded-md border p-3">
      <div className="grid grid-cols-3 gap-2">
        <Input value={searchQuery} onChange={(e: ChangeEvent<HTMLInputElement>) => onSearchQueryChange(e.target.value)} placeholder="Text search (e.g., coffee)" aria-label="Text search" />
        <Input value={radius} onChange={(e: ChangeEvent<HTMLInputElement>) => onRadiusChange(e.target.value)} placeholder="Radius (m)" aria-label="Radius meters" />
        <Input value={placeType} onChange={(e: ChangeEvent<HTMLInputElement>) => onPlaceTypeChange(e.target.value)} placeholder="Place type (optional)" aria-label="Place type" />
      </div>
      <div className="flex flex-wrap gap-2">
        <Button type="button" disabled={loading} onClick={onTextSearch}>
          Text Search
        </Button>
        <Button type="button" disabled={loading} onClick={onNearbySearch}>
          Nearby Search
        </Button>
        <Button type="button" variant="secondary" disabled={!!nearbyFromSelectionDisabled || loading} onClick={onNearbyFromSelection}>
          Nearby from selection
        </Button>
      </div>
    </div>
  );
}
