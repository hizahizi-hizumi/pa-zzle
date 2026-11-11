/** 同一の問題と手数で「滑走の手触り」と「地形の反応」を切り分ける比較試作。 */
export type IceFloorMazeLook = "current" | "kinetic" | "terrain" | "unified";

export function hasKineticMotion(look: IceFloorMazeLook): boolean {
  return look === "kinetic" || look === "unified";
}

export function hasTerrainResponse(look: IceFloorMazeLook): boolean {
  return look === "terrain" || look === "unified";
}

export function getIceFloorMazeSlideTempo(
  look: IceFloorMazeLook,
): "standard" | "flow" {
  return hasKineticMotion(look) ? "flow" : "standard";
}
