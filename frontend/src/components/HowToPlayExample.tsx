import { type ReactNode, useId } from "react";

type HowToPlayExampleProps = {
  figure: ReactNode;
  /** 図の真下に添える、今の姿の判定や図の凡例などの言葉。操作の例のように言葉の要らない例では渡さない。 */
  caption?: ReactNode;
};

/**
 * 触れる例1つ。図の真下に言葉を添える。図と言葉の間は、盤面の縁の外に出す印（違反や見比べる所の短い線）が言葉に触れない広さにする。
 * 言葉の置き場所は図の幅いっぱいにし、言葉を図の中央にそろえられるようにする。言葉の段（`text-supporting`）はこの部品が持つ。
 * 元に戻すボタンは、例を並べる面（`HowToPlayExamplePanel`）が角に置く。
 */
export function HowToPlayExample({ figure, caption }: HowToPlayExampleProps) {
  const captionId = useId();

  if (caption === undefined) {
    return (
      <figure className="flex flex-col items-center">
        <div className="flex">{figure}</div>
      </figure>
    );
  }

  return (
    // 読み上げで、図をその言葉（判定や凡例）で呼ぶ。
    <figure
      aria-labelledby={captionId}
      className="flex flex-col items-center gap-3"
    >
      <div className="flex">{figure}</div>
      <figcaption
        id={captionId}
        className="flex min-h-6 items-center justify-center self-stretch text-supporting"
      >
        {caption}
      </figcaption>
    </figure>
  );
}
