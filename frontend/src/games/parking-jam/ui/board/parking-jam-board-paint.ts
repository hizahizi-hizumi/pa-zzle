import { useId } from "react";

export type ParkingJamBoardPaint = {
  lotGradientId: string;
  glassGradientId: string;
  asphaltPatternId: string;
  vehicleSpaceClipId: string;
  lotFill: string;
  glassFill: string;
  asphaltFill: string;
  vehicleSpaceClipPath: string;
};

function createPaintReference(id: string): string {
  return `url(#${id})`;
}

// 同じ文書に複数の盤面を描くため、SVG参照先IDを盤面ごとに分ける。
export function useParkingJamBoardPaint(): ParkingJamBoardPaint {
  const boardId = `parking-jam-${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;
  const lotGradientId = `${boardId}-lot`;
  const glassGradientId = `${boardId}-glass`;
  const asphaltPatternId = `${boardId}-asphalt`;
  const vehicleSpaceClipId = `${boardId}-vehicle-space`;

  return {
    lotGradientId,
    glassGradientId,
    asphaltPatternId,
    vehicleSpaceClipId,
    lotFill: createPaintReference(lotGradientId),
    glassFill: createPaintReference(glassGradientId),
    asphaltFill: createPaintReference(asphaltPatternId),
    vehicleSpaceClipPath: createPaintReference(vehicleSpaceClipId),
  };
}
