import { X } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  getReflectionLaserPathPolicy,
  type ReflectionLaserPathMode,
} from "@/games/reflection/laser-path-mode";
import type { ReflectionPiece } from "@/games/reflection/puzzle/board";
import type { ReflectionClue } from "@/games/reflection/puzzle/laser";
import { ReflectionOutcomeMark } from "@/games/reflection/ui/board/ReflectionOutcomeMark";
import { ReflectionPieceIcon } from "@/games/reflection/ui/board/ReflectionPieceIcon";
import { writeReflectionHowToPlaySeen } from "@/games/reflection/ui/how-to-play-seen";
import { reflectionOutcomeLabels } from "@/games/reflection/ui/outcome-label";
import { HowToPlayFigure } from "@/games/reflection/ui/ReflectionHowToPlayDialog/HowToPlayFigure";
import {
  reflectionOutcomeToneClassNames,
  reflectionToneClassNames,
} from "@/games/reflection/ui/reflection-tone";
import { cn } from "@/lib/utils";

type ReflectionHowToPlayDialogProps = {
  open: boolean;
  laserPathMode: ReflectionLaserPathMode;
  onClose: () => void;
};

const outcomeFigures = [
  { outcome: "exit", rows: ["...", "./.", "..."] },
  { outcome: "reflect", rows: ["...", ".o.", "..."] },
  { outcome: "absorb", rows: ["...", ".@.", "..."] },
] as const;

const pieceGroups: readonly {
  pieces: readonly ReflectionPiece[];
  name: string;
  effect: string;
}[] = [
  {
    pieces: ["slash", "backslash"],
    name: "斜め鏡",
    effect: "光を直角に曲げる",
  },
  {
    pieces: ["vertical-double", "horizontal-double"],
    name: "両面鏡",
    effect: "鏡に沿う光は通し、当たる光ははね返す",
  },
  { pieces: ["reflector"], name: "反射体", effect: "どの向きの光もはね返す" },
  { pieces: ["black-hole"], name: "ブラックホール", effect: "光を吸い込む" },
];

const leftMiddle = { side: "left", index: 1 } as const;

const matchExampleClue: ReflectionClue = { outcome: "exit", distance: 3 };

/** 盤面の外周ヒントと同じ並び（数字の下に結果の形）で、一致しているときの地と数字の色を見せる見本。 */
function ClueMatchExample({ matched }: { matched: boolean }) {
  return (
    <span
      className={cn(
        "flex size-10 flex-col items-center justify-center gap-0.5 leading-none text-foreground",
        matched && reflectionToneClassNames.clueMatchSurface,
      )}
    >
      <span
        className={cn(
          "font-semibold tabular-nums",
          matched && reflectionToneClassNames.clueMatchLabel,
        )}
      >
        {matchExampleClue.distance}
      </span>
      <span
        className={cn(
          "flex",
          reflectionOutcomeToneClassNames[matchExampleClue.outcome],
        )}
      >
        <ReflectionOutcomeMark
          outcome={matchExampleClue.outcome}
          size="inline"
        />
      </span>
    </span>
  );
}

/**
 * ルールと操作を、盤面と同じ形・色の小さな図と短い一文で示す。
 * 光路表示の説明は光路表示の扱いに合わせる。一度閉じたら、初めて遊ぶときの自動表示をしないよう記録する。
 */
export function ReflectionHowToPlayDialog({
  open,
  laserPathMode,
  onClose,
}: ReflectionHowToPlayDialogProps) {
  const { describedAsAssist } = getReflectionLaserPathPolicy(laserPathMode);

  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen) {
      writeReflectionHowToPlaySeen();
      onClose();
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="max-h-[calc(100svh-2rem)] overflow-y-auto"
      >
        <DialogHeader className="text-left">
          <div className="flex items-center justify-between gap-4">
            <DialogTitle>遊び方</DialogTitle>
            <DialogClose asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label="閉じる"
              >
                <X />
              </Button>
            </DialogClose>
          </div>
          <DialogDescription>
            外周の数字どおりに光が進むよう、手持ちのピースをすべて盤面に置く。
          </DialogDescription>
        </DialogHeader>

        <ol className="space-y-5 text-supporting">
          <li className="space-y-2">
            <p>
              数字は、そこから入れた光が通るマスの数。記号と色は光の行き先。
            </p>
            <div className="flex justify-between gap-2">
              {outcomeFigures.map(({ outcome, rows }) => (
                <figure
                  key={outcome}
                  className="flex flex-col items-center gap-1"
                >
                  <HowToPlayFigure rows={rows} entry={leftMiddle} />
                  <figcaption className="text-meta text-muted-foreground">
                    {reflectionOutcomeLabels[outcome]}
                  </figcaption>
                </figure>
              ))}
            </div>
          </li>
          <li className="space-y-2">
            <p>ピースの働き。</p>
            <dl className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-x-3 gap-y-2">
              {pieceGroups.map(({ pieces, name, effect }) => (
                <div key={name} className="contents">
                  <dt className="flex gap-1">
                    {pieces.map((piece) => (
                      <ReflectionPieceIcon
                        key={piece}
                        piece={piece}
                        size="figure"
                      />
                    ))}
                  </dt>
                  <dd>
                    <span className="font-medium">{name}</span>
                    <span className="text-muted-foreground">　{effect}</span>
                  </dd>
                </div>
              ))}
            </dl>
          </li>
          <li>
            <p>
              ストックでピースを選び、マスを押して置く。置いたピースを押して選ぶと、別のマスへ移す・入れ替える・ストックへ戻すができる。
            </p>
          </li>
          <li className="space-y-2">
            <p>
              置くたびに、今の配置で光が数字と記号のとおりに進む外周ヒントは、地が緑になる。すべて緑になれば完成。
            </p>
            <div className="flex items-center gap-4">
              <figure className="flex items-center gap-2">
                <ClueMatchExample matched={false} />
                <figcaption className="text-meta text-muted-foreground">
                  まだ合っていない
                </figcaption>
              </figure>
              <figure className="flex items-center gap-2">
                <ClueMatchExample matched />
                <figcaption className="text-meta text-muted-foreground">
                  合っている
                </figcaption>
              </figure>
            </div>
          </li>
          <li>
            <p>
              外周の数字を押すと、今の配置での光の道筋を線で表示し、今の光が通るマスの数を、合っていないときだけ数字のそばに示す。合わない理由を探すときに使う。
              {describedAsAssist ? "（補助。使った回数は記録に残る）" : null}
            </p>
          </li>
          <li className="hidden pointer-fine:list-item">
            <p className="text-muted-foreground">
              キーボード: 矢印キーで移動、Enter
              で押す、数字キーでストックを選ぶ、Delete でストックへ戻す、Esc
              で選択を解除。
            </p>
          </li>
        </ol>
      </DialogContent>
    </Dialog>
  );
}
