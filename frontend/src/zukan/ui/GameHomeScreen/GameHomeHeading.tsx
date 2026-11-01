import { CircleHelp } from "lucide-react";
import { type ReactNode, type Ref, useEffect, useRef, useState } from "react";

import { GamePictogram } from "@/components/GamePictogram";
import type { HowToPlayDialogControl } from "@/components/HowToPlayDialog";
import { ZukanHeaderButton } from "@/zukan/ui/GameHomeScreen/ZukanHeaderButton";

type GameHomeHeadingProps = {
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
  /** 遊び方に続けて並べる、台紙を見る助けになる層のボタン。 */
  children: ReactNode;
};

/**
 * ゲームのホームの見出し。ピクトグラムとゲーム名に、解いた問題の数を全問の数と並べた静かな計数と、遊び方などの層を開くボタンを添える。
 * 狭い画面では計数とボタンをピクトグラムの下から1行に並べ、ボタンはアイコンで示す。
 */
export function GameHomeHeading({
  gameTitle,
  pictogramSvg,
  solvedCount,
  problemCount,
  titleRef,
  actionsRef,
  renderHowToPlayDialog,
  children,
}: GameHomeHeadingProps) {
  const [howToPlayOpen, setHowToPlayOpen] = useState(false);
  const howToPlayButtonRef = useRef<HTMLButtonElement>(null);
  const returnsFocusRef = useRef(false);

  // 遊び方のダイアログは開いたボタンを知らないので、閉じたらフォーカスを遊び方のボタンへ戻す。
  // ダイアログがフォーカスを閉じ込めるのをやめてから戻すよう、閉じた姿を描いたあとに戻す。
  useEffect(() => {
    if (!howToPlayOpen && returnsFocusRef.current) {
      returnsFocusRef.current = false;
      howToPlayButtonRef.current?.focus();
    }
  }, [howToPlayOpen]);

  return (
    <header className="mt-2 grid grid-cols-[auto_minmax(0,1fr)] items-center gap-x-3 gap-y-1 border-b-(length:--border-width-normal) pb-3">
      <span className="size-8 sm:row-span-2 sm:size-12">
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
        className="col-span-2 flex flex-wrap items-center justify-between gap-x-1 sm:col-span-1"
      >
        <p className="text-supporting whitespace-nowrap text-muted-foreground tabular-nums">
          <span aria-hidden="true">
            解いた問題 {solvedCount} / {problemCount}
          </span>
          <span className="sr-only">
            {problemCount}問中{solvedCount}問を解いた
          </span>
        </p>
        <div className="flex items-center">
          <ZukanHeaderButton
            ref={howToPlayButtonRef}
            type="button"
            icon={<CircleHelp aria-hidden="true" />}
            label="遊び方"
            onClick={() => setHowToPlayOpen(true)}
          />
          {children}
        </div>
      </div>
      {renderHowToPlayDialog({
        open: howToPlayOpen,
        onClose() {
          returnsFocusRef.current = true;
          setHowToPlayOpen(false);
        },
      })}
    </header>
  );
}
