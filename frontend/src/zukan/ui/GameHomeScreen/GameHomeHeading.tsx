import type { ReactNode, Ref } from "react";

import { GamePictogram } from "@/components/GamePictogram";
import { HomeBackLink } from "@/components/HomeBackLink";
import { SettingsButton } from "@/components/SettingsButton";

type GameHomeHeadingProps = {
  gameId: string;
  gameTitle: string;
  pictogramSvg: string;
  pictogramShowcaseSvg: string | undefined;
  /** 各レベルのカードに示す数の合計。 */
  shownSolvedCount: number;
  problemCount: number;
  titleRef: Ref<HTMLHeadingElement>;
  /** 層を開くメニューと設定のボタンの範囲。変化を見せている間に押されたときに、そのまま開くのに使う。 */
  actionsRef: Ref<HTMLDivElement>;
  children: ReactNode;
};

export function GameHomeHeading({
  gameId,
  gameTitle,
  pictogramSvg,
  pictogramShowcaseSvg,
  shownSolvedCount,
  problemCount,
  titleRef,
  actionsRef,
  children,
}: GameHomeHeadingProps) {
  return (
    // 台紙を広く見せるよう、どの画面幅でも1行に収める。
    <header className="grid grid-cols-[auto_auto_minmax(0,1fr)_auto] items-center gap-x-1.5 min-[390px]:gap-x-2 lg:gap-x-3">
      {/* アイコンの線を台紙の左端にそろえるよう、ボタンの内側の余白の分だけ外へ出す。 */}
      <span className="-ms-2 flex">
        <HomeBackLink iconOnly />
      </span>
      {/* ごく狭い画面では、ゲーム名を折り返さずに収めるよう、ピクトグラムを省く。 */}
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
            解いた問題 {shownSolvedCount} / {problemCount}
          </span>
          <span className="sr-only">
            {problemCount}問中{shownSolvedCount}問を解いた
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
