"use client";
import { Button } from "@/components/ui/button";

export interface ResultsListProps {
  results: any[];
  loading: boolean;
  hasNextPage: boolean;
  onOpen: (result: any) => void;
  onLoadMore: () => void;
}

export function ResultsList({ results, loading, hasNextPage, onOpen, onLoadMore }: ResultsListProps) {
  if (!results?.length) return null;
  return (
    <div className="mt-2 max-h-56 overflow-auto rounded border">
      {results.map((r: any, idx: number) => (
        <div key={idx} className="flex items-center justify-between gap-2 border-b p-2 last:border-b-0">
          <div className="min-w-0">
            <div className="truncate text-sm font-medium">{r.name}</div>
            <div className="truncate text-xs text-muted-foreground">{r.formatted_address || r.vicinity || ""}</div>
            {typeof r.rating === "number" && (
              <div className="text-xs text-muted-foreground">
                Rating {r.rating.toFixed(1)}{typeof r.user_ratings_total === "number" ? ` (${r.user_ratings_total})` : ""}
              </div>
            )}
          </div>
          <Button type="button" size="sm" onClick={() => onOpen(r)}>
            Open
          </Button>
        </div>
      ))}
      {hasNextPage && (
        <div className="flex items-center justify-center p-2">
          <Button type="button" variant="outline" disabled={!hasNextPage || loading} onClick={onLoadMore}>
            Load more
          </Button>
        </div>
      )}
    </div>
  );
}
