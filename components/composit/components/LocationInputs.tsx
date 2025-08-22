"use client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export interface LocationInputsProps {
  lat: string;
  lng: string;
  onLatChange: (v: string) => void;
  onLngChange: (v: string) => void;
  onUpdatePin: () => void;
  onSave?: () => void;
}

export function LocationInputs({ lat, lng, onLatChange, onLngChange, onUpdatePin, onSave }: LocationInputsProps) {
  return (
    <div className="grid gap-2">
      <div className="grid grid-cols-2 gap-2">
        <Input value={lat} onChange={(e) => onLatChange(e.target.value)} placeholder="Latitude" aria-label="Latitude" />
        <Input value={lng} onChange={(e) => onLngChange(e.target.value)} placeholder="Longitude" aria-label="Longitude" />
      </div>
      <div className="flex gap-2">
        <Button type="button" onClick={onUpdatePin}>Update Pin</Button>
        <Button type="button" variant="secondary" onClick={onSave}>Save Location</Button>
      </div>
    </div>
  );
}
