import type { ReactNode, Ref } from "react";

import { GamePictogram } from "@/components/GamePictogram";
import { HomeBackLink } from "@/components/HomeBackLink";
import { SettingsButton } from "@/components/SettingsButton";

type GameHomeHeadingProps = {
  gameId: string;
  gameTitle: string;
  pictogramSvg: string;
  /** 色と動きのあるピクトグラム。無ければ `pictogramSvg` を見せる。 */
  pictogramShowcaseSvg: string | undefined;
  /** 今示す解いた問題の数。各レベルのカードに示す数の合計。 */
  solvedCount: number;
  problemCount: number;
  /** ゲーム名の見出し。ほかの画面から移ってきたときにフォーカスを置くのに使う。 */
  titleRef: Ref<HTMLHeadingElement>;
  /** 層を開くメニューと設定のボタンの範囲。変化を見せている間に押されたときに、そのまま開くのに使う。 */
  actionsRef: Ref<HTMLDivElement>;
  /** 台紙を見る助けになる層を開くメニュー。 */
  children: ReactNode;
};

/**
 * ゲームのホームの見出し。ホームへ戻るアイコンを頭に置いたピクトグラムとゲーム名に、解いた問題の数を全問の数と並べた静かな計数と、遊び方などの層を開くメニューと、アプリの設定を開くボタンを添える。
 * ピクトグラムは、ホームで選んでいたときと同じ、ゲーム固有色でそのゲームの遊びを見せる姿にする。持たないゲームは濃淡2色の姿を見せる。
 * 台紙を広く見せるよう、どの画面幅でも1行に収める。計数はゲーム名の下に小さく添える。ごく狭い画面では、ゲーム名を折り返さずに収めるよう、ピクトグラムを省く。
 */
export function GameHomeHeading({
  gameId,
  gameTitle,
  pictogramSvg,
  pictogramShowcaseSvg,
  solvedCount,
  problemCount,
  titleRef,
  actionsRef,
  children,
}: GameHomeHeadingProps) {
  return (
    <header className="grid grid-cols-[auto_auto_minmax(0,1fr)_auto] items-center gap-x-1.5 min-[390px]:gap-x-2 lg:gap-x-3">
      {/* アイコンの線を台紙の左端にそろえるよう、ボタンの内側の余白の分だけ外へ出す。 */}
      <span className="-ms-2 flex">
        <HomeBackLink iconOnly />
      </span>
      <span className="size-10 max-[359px]:hidden min-[390px]:size-14 lg:size-20">
        {pictogramShowcaseSvg === undefined ? (
          <GamePictogram svg={pictogramSvg} />
        ) : (
          <GamePictogram svg={pictogramShowcaseSvg} motion="play" />
        )}
      </span>
      <div className="min-w-0">
        <h1
          ref={titleRef}
          tabIndex={-1}
          className="text-heading outline-none sm:text-screen-title"
        >
          {gameTitle}
        </h1>
        <p className="text-meta whitespace-nowrap tabular-nums">
          <span aria-hidden="true">
            解いた問題 {solvedCount} / {problemCount}
          </span>
          <span className="sr-only">
            {problemCount}問中{solvedCount}問を解いた
          </span>
        </p>
      </div>
      {/* 設定のアイコンの線を台紙の右端にそろえるよう、ボタンの内側の余白の分だけ外へ出す。 */}
      <div ref={actionsRef} className="-me-2.25 flex items-center">
        {children}
        <SettingsButton initialGameId={gameId} />
      </div>
    </header>
  );
}
