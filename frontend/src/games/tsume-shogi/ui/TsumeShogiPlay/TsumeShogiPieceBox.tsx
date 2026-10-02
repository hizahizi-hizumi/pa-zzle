/**
 * 玉方の持駒（駒箱）。盤上と攻方の持駒に無い駒はすべて玉方が使えるので、枚数を並べずに「残り全部」とだけ示す。
 */
export function TsumeShogiPieceBox() {
  return (
    <p className="flex items-center gap-2 text-play-meta text-muted-foreground">
      <span>玉方の持駒</span>
      <span className="text-foreground">残り全部</span>
    </p>
  );
}
