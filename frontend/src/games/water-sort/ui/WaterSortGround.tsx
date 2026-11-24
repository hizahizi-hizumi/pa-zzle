import { labSceneColorClassName } from "@/games/water-sort/ui/lab-scene-colors";
import { cn } from "@/lib/utils";

type WaterSortGroundProps = {
  /**
   * 画面の下の端に来る面。
   * - `wall`: 壁。ゲームのホームのように、盤面を置かない画面。
   * - `cabinet`: 流しの戸棚の前の面。盤面の後ろに実験台と戸棚を描くプレイ画面とチュートリアル。
   */
  bottom?: "wall" | "cabinet";
};

/**
 * プレイ画面・チュートリアル・ゲームのホームの地。理科室の壁の1色で塗る。
 * 窓・試験管立て・実験台・流しの戸棚は、盤面の位置に合わせて盤面の後ろに描く。
 * ブラウザの下の端の色は、画面の下の端に来る面の色にそろえる。
 */
export function WaterSortGround({ bottom = "wall" }: WaterSortGroundProps) {
  return (
    <div
      className={cn(
        "size-full bg-(--lab-wall)",
        bottom === "cabinet" && "[--browser-bottom-paint:var(--lab-cabinet)]",
        labSceneColorClassName,
      )}
    />
  );
}
