import { MoreHorizontal } from "lucide-react";

import { HowToPlayPhrases } from "@/components/HowToPlayPhrases";
import { howToPlayOperationColumnsClassName } from "@/components/how-to-play-layout";
import {
  PLAY_MENU_TRIGGER_LABEL,
  type PlayMenuOperationItem,
} from "@/components/play-menu-operations";
import { Button } from "@/components/ui/button";
import { DropdownMenuStaticSurface } from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

/** プレイ中の「…」メニューの項目1つと、その操作の文。 */
export type HowToPlayMenuOperation = {
  /** 本番のメニューと同じ項目の定義。 */
  item: PlayMenuOperationItem;
  /** 何をする操作かの一文。ほかの操作との違いが分かるように言う。`/` で区切った所の間でだけ折り返す。 */
  text: string;
  /** 一文に添える注記。`/` で区切った所の間でだけ折り返す。 */
  note?: string;
};

type HowToPlayMenuOperationsProps = {
  operations: readonly HowToPlayMenuOperation[];
};

/**
 * メニューの面の中の、項目のアイコンと文の2列。面の内側の左右の余白（`p-1`）の分だけアイコンの列を狭め、間を広げて、
 * アイコンの中央と文の書き出しを、面の外の操作の行（`howToPlayOperationColumnsClassName`）にそろえる。
 */
const menuItemColumnsClassName =
  "grid grid-cols-[--spacing(10)_minmax(0,1fr)] gap-x-5";

/**
 * プレイ中の「…」メニューから使う操作の一覧。本番の「…」ボタンと、その下に開くメニューの面1枚を、
 * 押しても何も起きない静止の図で描き、面の中に項目ごとの名前と説明を並べる。
 * 「…」ボタンの右には、本番のボタンの名前で、そこから選ぶことを一文で言う。
 * 項目の名前は本番と同じアイコンと色（取り消しの色を含む）で示し、遊び方の文字の段に合わせて太字の本文にする。
 * 説明は普通の太さの本文にする。「…」ボタン・項目のアイコン・名前と説明の書き出しは、待ったの行と同じ2列にそろえる。
 */
export function HowToPlayMenuOperations({
  operations,
}: HowToPlayMenuOperationsProps) {
  return (
    <li className="flex flex-col gap-2">
      <div className={cn("items-center", howToPlayOperationColumnsClassName)}>
        {/* ボタンの上下の余白を行に数えず、文の1行の高さを行の高さにして、前の行と面の中の項目との間を項目どうしの間とそろえる。 */}
        <span aria-hidden="true" inert className="-my-2 flex">
          <Button type="button" variant="ghost" size="icon-lg" tabIndex={-1}>
            <MoreHorizontal />
          </Button>
        </span>
        <p className="text-body">
          <HowToPlayPhrases
            text={`「${PLAY_MENU_TRIGGER_LABEL}」から/選びます。`}
          />
        </p>
      </div>
      <DropdownMenuStaticSurface>
        {operations.map(({ item, text, note }) => (
          <div
            key={item.label}
            data-variant={item.destructive ? "destructive" : "default"}
            className={cn("py-2", menuItemColumnsClassName)}
          >
            {/* アイコンの中央を、名前の1行目の中央にそろえる。 */}
            <span
              aria-hidden="true"
              className={cn(
                "flex h-6 items-center justify-center [&_svg]:size-4",
                item.destructive ? "text-destructive" : "text-muted-foreground",
              )}
            >
              <item.icon />
            </span>
            <p>
              <span
                className={cn(
                  "block font-semibold text-body",
                  item.destructive && "text-destructive",
                )}
              >
                {item.label}
              </span>
              <span className="sr-only">：</span>
              <span className="block text-supporting">
                <HowToPlayPhrases text={text} />
              </span>
              {note ? (
                <span className="mt-1 block text-muted-foreground text-supporting">
                  <HowToPlayPhrases text={note} />
                </span>
              ) : null}
            </p>
          </div>
        ))}
      </DropdownMenuStaticSurface>
    </li>
  );
}
