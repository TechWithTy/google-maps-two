"use client";

import { memo } from "react";

export type DrawingControlsProps = {
  drawingMode: google.maps.drawing.OverlayType | null;
  setDrawingMode: (m: google.maps.drawing.OverlayType | null) => void;
  shapeDrawn: boolean;
  boundaryApplied: boolean;
  onCancelDrawing: () => void;
  onApplyDrawing: () => void;
  onRemoveBoundaries: () => void;
};

function ControlsImpl({
  drawingMode,
  setDrawingMode,
  shapeDrawn,
  boundaryApplied,
  onCancelDrawing,
  onApplyDrawing,
  onRemoveBoundaries,
}: DrawingControlsProps) {
  return (
    <>
      {!boundaryApplied && (
        <div
          className="-translate-x-1/2 absolute top-10 left-1/2 z-10 transform rounded-lg bg-white p-2 text-center opacity-80 shadow-lg transition-opacity duration-300 hover:opacity-100 lg:top-2"
          style={{ pointerEvents: "auto" }}
        >
          {!drawingMode ? (
            <p className="mb-2 font-semibold text-gray-800 text-sm">Draw a shape to search in that area</p>
          ) : (
            <p className="mb-2 font-semibold text-gray-800 text-sm">Start Drawing!</p>
          )}
          {!shapeDrawn && (
            <div className="mb-2 flex flex-col items-center space-y-2">
              <div className="flex justify-center space-x-2">
                <button
                  type="button"
                  className="rounded bg-blue-600 px-4 py-2 text-white text-xs hover:bg-blue-700"
                  onClick={() => setDrawingMode(google.maps.drawing.OverlayType.POLYGON)}
                >
                  Polygon
                </button>
                <button
                  type="button"
                  className="rounded bg-blue-600 px-4 py-2 text-white text-xs hover:bg-blue-700"
                  onClick={() => setDrawingMode(google.maps.drawing.OverlayType.RECTANGLE)}
                >
                  Rectangle
                </button>
                <button
                  type="button"
                  className="rounded bg-blue-600 px-4 py-2 text-white text-xs hover:bg-blue-700"
                  onClick={() => setDrawingMode(google.maps.drawing.OverlayType.CIRCLE)}
                >
                  Circle
                </button>
              </div>
              {drawingMode && (
                <button
                  type="button"
                  className="mt-2 rounded bg-red-600 px-4 py-2 text-white text-xs hover:bg-red-700"
                  onClick={onCancelDrawing}
                >
                  Cancel Drawing
                </button>
              )}
            </div>
          )}
          {shapeDrawn && (
            <div className="flex justify-center space-x-4">
              <button
                type="button"
                onClick={onCancelDrawing}
                className="rounded bg-gray-300 px-4 py-1 text-black shadow hover:bg-gray-400"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={onApplyDrawing}
                className="rounded bg-blue-600 px-4 py-1 text-white shadow hover:bg-blue-700"
              >
                Apply
              </button>
            </div>
          )}
        </div>
      )}
      {boundaryApplied && (
        <button
          onClick={onRemoveBoundaries}
          type="button"
          className="absolute top-4 right-4 z-10 flex cursor-pointer items-center rounded-lg bg-red-500 px-4 py-2 text-white shadow-lg hover:bg-red-600"
        >
          <span className="mr-2">Remove Boundaries</span>
          <span aria-hidden="true">&#x2715;</span>
        </button>
      )}
    </>
  );
}

export const DrawingControls = memo(ControlsImpl);
