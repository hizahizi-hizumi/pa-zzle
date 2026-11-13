import { X } from "lucide-react";
import { type ReactNode, useRef, useState } from "react";

import { GamePictogram } from "@/components/GamePictogram";
import { HowToPlayPhrases } from "@/components/HowToPlayPhrases";
import { HowToPlayTutorialButton } from "@/components/HowToPlayTutorialButton";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

/** 遊び方の見出しにする、ゲームの名前とピクトグラム。 */
export type HowToPlayGame = {
  name: string;
  pictogramSvg: string;
};

type HowToPlayOverlayProps = {
  open: boolean;
  game: HowToPlayGame;
  /** 何をするパズルかの一文。`/` で区切った文節の間でだけ折り返す。 */
  description: string;
  /**
   * 一文と組にして見せる、解き終えた盤面。置き場所をコンテナにし、広い画面では高さも渡す。
   * 盤面は、置き場所の幅と、高さから `--how-to-play-goal-below`（盤面の下にこの層が置くボタンの段の高さ）を除いた高さの、小さい方に合わせる。
   */
  goal: ReactNode;
  /** ルールのタブの中身。ルールを1つずつ `HowToPlayRule` で並べる。 */
  rules: ReactNode;
  /** 操作のタブの中身。`HowToPlaySection` のまとまりで並べる。 */
  operations: ReactNode;
  /** 採点のタブの中身。効く点ごとの `HowToPlaySection` に `HowToPlayScoreRow` を並べる。 */
  scoring: ReactNode;
  onClose: () => void;
  /** 渡すと、ゴールの盤面の下に、盤面と同じ幅でチュートリアルを始めるボタンを置く。 */
  onOpenTutorial?: () => void;
};

const tabs = [
  { value: "rules", label: "ルール" },
  { value: "operations", label: "操作" },
  { value: "scoring", label: "採点" },
] as const;

type HowToPlayTab = (typeof tabs)[number]["value"];

function isHowToPlayTab(value: string): value is HowToPlayTab {
  return tabs.some((candidate) => candidate.value === value);
}

const tabContentClassName =
  "@container isolate data-[state=inactive]:hidden px-4 pt-6 pb-12 lg:col-start-2 lg:row-start-2 lg:min-h-0 lg:overflow-y-auto lg:px-0 lg:pt-8";

/**
 * 遊び方の全画面の層。チュートリアルと同じく、上の帯にピクトグラムと名前、閉じるを置く。
 * 帯の下に「ルール」「操作」「採点」のタブを置き、タブを切り替えても帯とタブは動かさず、中身だけを送る。
 * タブの中身は開いている間ずっと保ち、触った例やゴールの盤面の移り変わりを、タブを行き来してもやり直さない。
 * 広い画面では、何をするパズルかとゴールの盤面を左の列に留め、右の列（読みやすい幅に絞る）でタブを読む。
 * 狭い画面では1列にし、それらをルールのタブの先頭に置く。どちらの画面でも1つだけ描き、置き場所を格子で替える。
 * 狭い画面では、タブの列を上に留めたまま中身全体を1つの領域で送り、タブを替えたら先頭から見せる。
 * チュートリアルのあるゲームでは、帯ではなくゴールの盤面の下に、チュートリアルを始めるボタンを置く。
 * 広い画面では、左の列を送らずに、一文・ゴールの盤面・ボタンを列の高さに収める。
 * 開くたびにルールのタブから始める。触った例は、開いている間だけ保つ。
 * 図が置き場所の幅に合わせて大きさを決められるよう、中身の領域をコンテナにする。
 */
export function HowToPlayOverlay({
  open,
  game,
  description,
  goal,
  rules,
  operations,
  scoring,
  onClose,
  onOpenTutorial,
}: HowToPlayOverlayProps) {
  const titleRef = useRef<HTMLHeadingElement>(null);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const [tab, setTab] = useState<HowToPlayTab>("rules");
  const [shownOpen, setShownOpen] = useState(open);

  // 閉じる間は消えていく中身を替えないよう、ルールのタブへは閉じるときではなく開くときに戻す。
  if (open !== shownOpen) {
    setShownOpen(open);
    if (open) {
      setTab("rules");
    }
  }

  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen) {
      onClose();
    }
  }

  // 開いた直後に閉じるボタンへフォーカスを入れると、その枠が帯の右上に大きく出るので、見出しへ置く。
  // 見出しは押す所ではないので枠を出さず、Tab で閉じるボタンへ進める。
  function handleOpenAutoFocus(event: Event) {
    event.preventDefault();
    titleRef.current?.focus();
  }

  function handleTabChange(value: string) {
    if (!isHowToPlayTab(value)) {
      return;
    }
    setTab(value);
    if (scrollerRef.current !== null) {
      scrollerRef.current.scrollTop = 0;
    }
  }

  const purpose = (
    // 一文は、帯の名前とルールの一文より退かせ、どの幅でも普通の太さの本文にする。
    // 広い画面では、一文と盤面の間を右のルールの一文と面の間と同じにし、ゴールの盤面の上端を右の最初の面の上端にそろえる。
    <div className="flex flex-col gap-6 lg:h-full lg:gap-3">
      <p className="text-balance text-body">
        <HowToPlayPhrases text={description} />
      </p>
      {/* 盤面の縁を本文と面の端にそろえるよう、盤面の置き場所を盤面に渡す。広い画面では残りの高さも渡す。 */}
      {/* チュートリアルのボタンは盤面と同じ幅にする。 */}
      <div
        className={cn(
          "@container lg:min-h-0 lg:flex-1 lg:[container-type:size]",
          onOpenTutorial && "[--how-to-play-goal-below:--spacing(14)]",
        )}
      >
        <div className="flex w-fit max-w-full flex-col gap-3">
          {goal}
          {onOpenTutorial ? (
            <HowToPlayTutorialButton onOpenTutorial={onOpenTutorial} />
          ) : null}
        </div>
      </div>
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        variant="fullscreen"
        showCloseButton={false}
        onOpenAutoFocus={handleOpenAutoFocus}
      >
        <div className="flex min-h-0 flex-1 flex-col [text-spacing-trim:trim-start]">
          {/* 帯の左右の端を、中身の格子の左右の端にそろえる。 */}
          <header className="mx-auto flex min-h-14 w-full max-w-7xl shrink-0 items-center gap-2 px-4 pt-2 lg:px-8">
            <span className="size-8 shrink-0">
              <GamePictogram svg={game.pictogramSvg} />
            </span>
            <DialogTitle ref={titleRef} tabIndex={-1} size="banner">
              {game.name}
              <span className="sr-only">の遊び方</span>
            </DialogTitle>
            <DialogDescription className="sr-only">
              {description.replaceAll("/", "")}
            </DialogDescription>
            {/* 閉じるの×の字面の右端を、タブの列の右端にそろえる。 */}
            <div className="ml-auto -me-4 flex shrink-0">
              <DialogClose asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-lg"
                  aria-label="閉じる"
                >
                  <X />
                </Button>
              </DialogClose>
            </div>
          </header>

          <Tabs
            value={tab}
            onValueChange={handleTabChange}
            className="min-h-0 w-full flex-1 gap-0"
          >
            <div
              ref={scrollerRef}
              className="mx-auto grid min-h-0 w-full max-w-7xl flex-1 grid-cols-1 content-start overflow-y-auto lg:grid-cols-[minmax(0,1fr)_--spacing(160)] lg:grid-rows-[auto_minmax(0,1fr)] lg:content-stretch lg:gap-x-12 lg:overflow-hidden lg:px-8"
            >
              {/* 左の列の一文の上端を、右の最初のルールの一文の上端にそろえるため、タブの列の高さを決めておく。 */}
              {/* タブを列の下端に寄せ、選んだタブの下線（2px）の下端を区切り線（1px）の下端にそろえて、区切り線に重ねる。 */}
              {/* 下線はタブの枠（1px）の内側の下端から 5px 下、つまりタブの下端から 4px 下に引かれるので、タブの下に区切り線を除いて 3px を空ける。 */}
              <div className="sticky top-0 z-10 flex h-11 items-end border-b-(length:--border-width-normal) bg-background px-4 pb-[3px] lg:static lg:col-start-2 lg:row-start-1 lg:px-0">
                <TabsList variant="line" layout="section">
                  {tabs.map(({ value, label }) => (
                    <TabsTrigger key={value} value={value}>
                      {label}
                    </TabsTrigger>
                  ))}
                </TabsList>
              </div>
              {/* 広い画面では、左の列をタブの列の高さから始めずに盤面へ高さを残し、一文の上端だけを、タブの列（h-11）と中身の上の余白（pt-8）の分下げて、右の最初のルールの一文の上端にそろえる。 */}
              <div
                className={cn(
                  "isolate px-4 pt-6 pb-6 lg:col-start-1 lg:row-span-2 lg:row-start-1 lg:min-h-0 lg:px-0 lg:pt-[calc(--spacing(11)+--spacing(8))] lg:pb-8",
                  tab !== "rules" && "max-lg:hidden",
                )}
              >
                {purpose}
              </div>
              <TabsContent
                value="rules"
                forceMount
                className={tabContentClassName}
              >
                <div className="space-y-12">{rules}</div>
              </TabsContent>
              {/* 操作と採点は見出しを付けたまとまりで並べるので、まとまりどうしの間を、まとまりの中の項目の間より大きく空ける。 */}
              <TabsContent
                value="operations"
                forceMount
                className={tabContentClassName}
              >
                <div className="space-y-16">{operations}</div>
              </TabsContent>
              <TabsContent
                value="scoring"
                forceMount
                className={tabContentClassName}
              >
                <div className="space-y-16">{scoring}</div>
              </TabsContent>
            </div>
          </Tabs>
        </div>
      </DialogContent>
    </Dialog>
  );
}
