import { CircleHelp, Pointer } from "lucide-react";
import { type ReactNode, type Ref, useEffect, useRef, useState } from "react";

import { GamePictogram } from "@/components/GamePictogram";
import { HomeBackLink } from "@/components/HomeBackLink";
import type { HowToPlayDialogControl } from "@/components/HowToPlayDialog";
import { SettingsButton } from "@/components/SettingsButton";
import { ZukanHeaderButton } from "@/zukan/ui/GameHomeScreen/ZukanHeaderButton";

type GameHomeHeadingProps = {
  gameId: string;
  gameTitle: string;
  pictogramSvg: string;
  /** 今示す解いた問題の数。各レベルのカードに示す数の合計。 */
  solvedCount: number;
  problemCount: number;
  /** ゲーム名の見出し。ほかの画面から移ってきたときにフォーカスを置くのに使う。 */
  titleRef: Ref<HTMLHeadingElement>;
  /** 見出しの並び（解いた数と、開いて補う層のボタン）の範囲。変化を見せている間に押されたときに、そのまま開くのに使う。 */
  actionsRef: Ref<HTMLDivElement>;
  /** ゲーム固有の遊び方ダイアログを描く。開閉の状態は見出しが持ち、引数で渡す。 */
  renderHowToPlayDialog: (control: HowToPlayDialogControl) => ReactNode;
  /**
   * ゲーム固有のチュートリアルを描く。開閉の状態は見出しが持ち、引数で渡す。
   * 省略すると、チュートリアルを開くボタンを出さない。
   */
  renderTutorial?: (control: HowToPlayDialogControl) => ReactNode;
  /** 遊び方・チュートリアルに続けて並べる、台紙を見る助けになる層のボタン。 */
  children: ReactNode;
};

/**
 * ゲームのホームの見出し。ホームへ戻るアイコンを頭に置いたピクトグラムとゲーム名に、解いた問題の数を全問の数と並べた静かな計数と、遊び方・チュートリアルなどの層を開くボタンを添える。
 * 台紙を広く見せるよう、PC では1行に並べ、それより狭い画面では計数とボタンをゲーム名の下の1行に並べる。狭い画面ではボタンをアイコンで示す。
 */
export function GameHomeHeading({
  gameId,
  gameTitle,
  pictogramSvg,
  solvedCount,
  problemCount,
  titleRef,
  actionsRef,
  renderHowToPlayDialog,
  renderTutorial,
  children,
}: GameHomeHeadingProps) {
  const howToPlay = useLayerOpenedByButton();
  const tutorial = useLayerOpenedByButton();

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
        {/* 狭い画面でもボタンを増やせる幅を残して計数とボタンを1行に収めるよう、計数を小さくする。 */}
        <p className="text-meta whitespace-nowrap text-muted-foreground tabular-nums sm:text-supporting">
          <span aria-hidden="true">
            解いた問題 {solvedCount} / {problemCount}
          </span>
          <span className="sr-only">
            {problemCount}問中{solvedCount}問を解いた
          </span>
        </p>
        <div className="flex items-center">
          <ZukanHeaderButton
            ref={howToPlay.buttonRef}
            type="button"
            icon={<CircleHelp aria-hidden="true" />}
            label="遊び方"
            onClick={howToPlay.open}
          />
          {renderTutorial && (
            <ZukanHeaderButton
              ref={tutorial.buttonRef}
              type="button"
              icon={<Pointer aria-hidden="true" />}
              label="チュートリアル"
              onClick={tutorial.open}
            />
          )}
          {children}
          <SettingsButton initialGameId={gameId} />
        </div>
      </div>
      {renderHowToPlayDialog(howToPlay.control)}
      {renderTutorial?.(tutorial.control)}
    </header>
  );
}

/**
 * 見出しのボタンで開く層（遊び方・チュートリアル）の開閉の状態。
 * 層は開いたボタンを知らないので、閉じたらフォーカスを開いたボタンへ戻す。
 * 層がフォーカスを閉じ込めるのをやめてから戻すよう、閉じた姿を描いたあとに戻す。
 */
function useLayerOpenedByButton() {
  const [layerOpen, setLayerOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const returnsFocusRef = useRef(false);

  useEffect(() => {
    if (!layerOpen && returnsFocusRef.current) {
      returnsFocusRef.current = false;
      buttonRef.current?.focus();
    }
  }, [layerOpen]);

  const control: HowToPlayDialogControl = {
    open: layerOpen,
    onClose() {
      returnsFocusRef.current = true;
      setLayerOpen(false);
    },
  };

  return {
    buttonRef,
    open: () => setLayerOpen(true),
    control,
  };
}
