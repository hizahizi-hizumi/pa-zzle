import type { ReactNode } from "react";

import { HowToPlayPhrases } from "@/components/HowToPlayPhrases";
import { howToPlayOperationColumnsClassName } from "@/components/how-to-play-layout";
import { cn } from "@/lib/utils";

type HowToPlayOperationRowProps = {
  /** プレイ画面のボタンと同じ見た目の静止の図。プレイ画面の丸いボタン（48px）の幅までにする。 */
  visual: ReactNode;
  /** 何をする操作かの一文。`/` で区切った所の間でだけ折り返す。 */
  text: string;
  /** 一文に添える注記。`/` で区切った所の間でだけ折り返す。 */
  note?: string;
};

/**
 * 操作1つの行。本番と同じ見た目の図をアイコンの列に、文を文の列に置き、文のかたまりを図の縦の中央にそろえる。
 * 行の間は余白で分け、囲まない。操作の一文は普通の太さの本文にし、添える注記は次の行に一段小さく淡く置く。
 */
export function HowToPlayOperationRow({
  visual,
  text,
  note,
}: HowToPlayOperationRowProps) {
  return (
    <li className={cn("items-center", howToPlayOperationColumnsClassName)}>
      <span className="flex">{visual}</span>
      <p>
        <span className="block text-body">
          <HowToPlayPhrases text={text} />
        </span>
        {note ? (
          <span className="mt-1 block text-muted-foreground text-supporting">
            <HowToPlayPhrases text={note} />
          </span>
        ) : null}
      </p>
    </li>
  );
}
