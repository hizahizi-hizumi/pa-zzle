import type { ReactNode, Ref } from "react";

import { GamePictogram } from "@/components/GamePictogram";
import { HomeBackLink } from "@/components/HomeBackLink";
import { SettingsButton } from "@/components/SettingsButton";

type GameHomeHeadingProps = {
  gameId: string;
  gameTitle: string;
  pictogramSvg: string;
  /** 今示す解いた問題の数。各レベルのカードに示す数の合計。 */
  solvedCount: number;
  problemCount: number;
  /** ゲーム名の見出し。ほかの画面から移ってきたときにフォーカスを置くのに使う。 */
  titleRef: Ref<HTMLHeadingElement>;
  /** 見出しの並び（解いた数と、層を開くメニューと、設定のボタン）の範囲。変化を見せている間に押されたときに、そのまま開くのに使う。 */
  actionsRef: Ref<HTMLDivElement>;
  /** 解いた数に並べる、台紙を見る助けになる層を開くメニュー。 */
  children: ReactNode;
};

/**
 * ゲームのホームの見出し。ホームへ戻るアイコンを頭に置いたピクトグラムとゲーム名に、解いた問題の数を全問の数と並べた静かな計数と、遊び方などの層を開くメニューと、アプリの設定を開くボタンを添える。
 * 台紙を広く見せるよう、PC では1行に並べ、それより狭い画面では計数とメニューと設定をゲーム名の下の1行に並べる。
 */
export function GameHomeHeading({
  gameId,
  gameTitle,
  pictogramSvg,
  solvedCount,
  problemCount,
  titleRef,
  actionsRef,
  children,
}: GameHomeHeadingProps) {
  return (
    <header
      data-settle-chrome=""
      className="flex items-center gap-x-2 lg:gap-x-3"
    >
      {/* アイコンの線を台紙の左端にそろえるよう、ボタンの内側の余白の分だけ外へ出す。 */}
      <span className="-ms-2 flex">
        <HomeBackLink iconOnly />
      </span>
      <span className="size-8 shrink-0 lg:size-9">
        <GamePictogram svg={pictogramSvg} />
      </span>
      <h1
        ref={titleRef}
        tabIndex={-1}
        className="min-w-0 flex-1 truncate text-heading outline-none lg:text-screen-title"
      >
        {gameTitle}
      </h1>
      <div ref={actionsRef} className="flex items-center gap-x-4">
        {/* スマートフォンでは、各レベルのカードの数で足りるので、合計は読み上げにだけ残す。 */}
        <p className="text-supporting whitespace-nowrap text-foreground/65 tabular-nums max-lg:sr-only">
          <span aria-hidden="true">
            解いた問題 {solvedCount} / {problemCount}
          </span>
          <span className="sr-only">
            {problemCount}問中{solvedCount}問を解いた
          </span>
        </p>
        {/* 設定のアイコンの線を台紙の右端にそろえるよう、ボタンの内側の余白の分だけ外へ出す。 */}
        <div className="-me-2.25 flex items-center">
          {children}
          <SettingsButton initialGameId={gameId} />
        </div>
      </div>
    </header>
  );
}
