import { useWaterSortArt } from "@/games/water-sort/ui/art/art-registry";

/** 遊び方の図の試験管の後ろに敷く地。図の箱の最初の子に置き、試験管の幅は `--water-sort-figure-bottle` から読む。 */
export function LabFigureGround() {
  const { FigureGround } = useWaterSortArt();
  return <FigureGround />;
}
