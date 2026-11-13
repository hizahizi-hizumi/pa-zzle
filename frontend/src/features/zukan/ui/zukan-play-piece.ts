import { getZukanPiecePath } from "@/features/zukan/ui/zukan-piece-shape";

/** 台紙のピースから入らずに始めた問題（結果から続けて始めた問題、URL を直接開いたプレイ）に使う、ピースの形。 */
const DEFAULT_ZUKAN_PIECE_SHAPE = "1,-1,1,-1";

let playPiece: { problemId: string; path: string } | null = null;

/** プレイへ入るときに、その問題のピースの輪郭を覚える。解き終えたときに、同じ形のピースへ色を付けて見せる。 */
export function rememberZukanPlayPiece(
  problemId: string,
  piecePath: string,
): void {
  playPiece = { problemId, path: piecePath };
}

/** 解き終えた問題のピースの輪郭。プレイへ入るときに覚えた輪郭か、覚えていなければ決まった形の輪郭。 */
export function getZukanSolvedPiecePath(problemId: string | undefined): string {
  return playPiece !== null && playPiece.problemId === problemId
    ? playPiece.path
    : getZukanPiecePath(DEFAULT_ZUKAN_PIECE_SHAPE);
}
