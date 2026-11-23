import { labSceneColorClassName } from "@/games/water-sort/ui/lab-scene-colors";
import { cn } from "@/lib/utils";

/**
 * プレイ画面・チュートリアル・ゲームのホームの地。理科室の壁の1色で塗る。
 * 窓・試験管立て・実験台・流しの戸棚は、盤面の位置に合わせて盤面の後ろに描く。戸棚の戸も壁の色なので、上端と下端が同じ色になる。
 */
export function WaterSortGround() {
  return (
    <div className={cn("size-full bg-(--lab-wall)", labSceneColorClassName)} />
  );
}
