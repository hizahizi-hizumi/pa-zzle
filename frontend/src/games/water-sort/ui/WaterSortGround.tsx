import { useWaterSortArt } from "@/games/water-sort/ui/art/art-registry";

/** プレイ画面・チュートリアル・ゲームのホームの地。 */
export function WaterSortGround() {
  const { Ground } = useWaterSortArt();
  return <Ground />;
}
