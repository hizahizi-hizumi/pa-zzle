import type { ReactNode, Ref } from "react";

import { GamePictogram } from "@/components/GamePictogram";
import { HomeBackLink } from "@/components/HomeBackLink";

type GameHomeHeadingProps = {
  gameTitle: string;
  pictogramSvg: string;
  /** 今示す解いた問題の数。各レベルのカードに示す数の合計。 */
  solvedCount: number;
  problemCount: number;
  /** ゲーム名の見出し。ほかの画面から移ってきたときにフォーカスを置くのに使う。 */
  titleRef: Ref<HTMLHeadingElement>;
  /** 見出しの並び（解いた数と、層を開くメニュー）の範囲。変化を見せている間に押されたときに、そのまま開くのに使う。 */
  actionsRef: Ref<HTMLDivElement>;
  /** 解いた数に並べる、台紙を見る助けになる層を開くメニュー。 */
  children: ReactNode;
};

/**
 * ゲームのホームの見出し。ホームへ戻るアイコンを頭に置いたピクトグラムとゲーム名に、解いた問題の数を全問の数と並べた静かな計数と、遊び方などの層を開くメニューを添える。
 * 台紙を広く見せるよう、PC では1行に並べ、それより狭い画面では計数とメニューをゲーム名の下の1行に並べる。
 */
export function GameHomeHeading({
  gameTitle,
  pictogramSvg,
  solvedCount,
  problemCount,
  titleRef,
  actionsRef,
  children,
}: GameHomeHeadingProps) {
  return (
    <header className="grid grid-cols-[auto_auto_minmax(0,1fr)] items-center gap-x-2 gap-y-1 lg:grid-cols-[auto_auto_minmax(0,1fr)_auto] lg:gap-x-3">
      {/* アイコンの線をゲーム名の下の計数と同じ左端にそろえるよう、ボタンの内側の余白の分だけ外へ出す。 */}
      <span className="-ms-2 flex">
        <HomeBackLink iconOnly />
      </span>
      <span className="size-8 lg:size-10">
        <GamePictogram svg={pictogramSvg} />
      </span>
      <h1
        ref={titleRef}
        tabIndex={-1}
        className="text-screen-title outline-none"
      >
        {gameTitle}
      </h1>
      <div
        ref={actionsRef}
        className="col-span-3 flex flex-wrap items-center justify-between gap-x-1 lg:col-span-1 lg:gap-x-4"
      >
        {/* 狭い画面でも計数とメニューを1行に収めるよう、計数を小さくする。 */}
        <p className="text-meta whitespace-nowrap text-muted-foreground tabular-nums sm:text-supporting">
          <span aria-hidden="true">
            解いた問題 {solvedCount} / {problemCount}
          </span>
          <span className="sr-only">
            {problemCount}問中{solvedCount}問を解いた
          </span>
        </p>
        {/* メニューのアイコンの線を台紙の右端にそろえるよう、ボタンの内側の余白の分だけ外へ出す。 */}
        <span className="-me-2.5 flex">{children}</span>
      </div>
    </header>
  );
}
