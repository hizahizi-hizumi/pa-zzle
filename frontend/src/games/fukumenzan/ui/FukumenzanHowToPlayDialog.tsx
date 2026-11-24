import { HowToPlayExample } from "@/components/HowToPlayExample";
import {
  type HowToPlayMenuOperation,
  HowToPlayMenuOperations,
} from "@/components/HowToPlayMenuOperations";
import { HowToPlayOperationRow } from "@/components/HowToPlayOperationRow";
import { HowToPlayOverlay } from "@/components/HowToPlayOverlay";
import { HowToPlayPhrases } from "@/components/HowToPlayPhrases";
import { HowToPlayRule } from "@/components/HowToPlayRule";
import { HowToPlayScoreRow } from "@/components/HowToPlayScoreRow";
import { HowToPlaySection } from "@/components/HowToPlaySection";
import { playMenuOperationItems } from "@/components/play-menu-operations";
import { UndoButton } from "@/components/UndoButton";
import pictogramSvg from "@/games/fukumenzan/assets/pictogram.svg?raw";
import { FUKUMENZAN_DISPLAY_NAME } from "@/games/fukumenzan/display-name";
import type { FukumenzanProblem } from "@/games/fukumenzan/problem/problem";
import {
  FUKUMENZAN_SCORE_MAXIMUMS,
  FUKUMENZAN_SPEED_ZERO_SCORE_RATIO,
} from "@/games/fukumenzan/score";
import { EquationFigure } from "@/games/fukumenzan/ui/FukumenzanHowToPlayDialog/EquationFigure";
import {
  PLAY_OPERATION_LABELS,
  SCORE_ITEM_LABELS,
} from "@/games/play-vocabulary";

type FukumenzanHowToPlayDialogProps = {
  open: boolean;
  onClose: () => void;
  /** 遊び方を閉じてチュートリアルを開く。開いた画面が渡す。 */
  onOpenTutorial?: () => void;
};

const game = { name: FUKUMENZAN_DISPLAY_NAME, pictogramSvg };

const { undo, restart } = PLAY_OPERATION_LABELS;

/** レベル1の問題集の1問。985 + 515 = 1500 で解ける。 */
const exampleProblem: FukumenzanProblem = {
  addends: ["BYK", "KTK"],
  result: "TKHH",
};
const solution = { B: 9, Y: 8, K: 5, T: 1, H: 0 } as const;
const figureTileRem = 2.25;

function ignoreFigurePress() {}

// 何が残り何が0に戻るかは、本番の session に合わせる。盤面を戻すは経過時間と回数を引き継ぎ、別の問題は新しいプレイを始める。
const menuOperations: readonly HowToPlayMenuOperation[] = [
  {
    item: playMenuOperationItems.restart,
    text: `時間と/「${undo}」の回数は/そのままで/札と/×を/全部/外した/最初の式に/戻します。`,
  },
  {
    item: playMenuOperationItems.startNewProblem,
    text: "同じレベルの/別の問題に/変えます。",
  },
];

const operationTexts = [
  "札を/文字へ/運ぶと、/その文字の/全部の/場所に/入ります。",
  "札を/押してから/文字を/押しても/入ります。",
  "札の入った/文字へ/別の札を/入れると、/前の札は/列へ/戻ります。",
  "文字を/押してから/札を/押すと、/その文字の/候補から/外す/×が/札に/付きます。/もう一度/押すと/外れます。",
  "札の入った/文字を/押してから/列の/空いた所を/押すと、/札が/列へ/戻ります。/列へ/運んでも/戻ります。",
] as const;

/** 結果画面と同じ順に、評価の項目を満点と並べる。 */
const scoreItems = Object.entries(FUKUMENZAN_SCORE_MAXIMUMS) as [
  keyof typeof FUKUMENZAN_SCORE_MAXIMUMS,
  number,
][];

const scoreLeads = {
  speed: "問題ごとの/基準時間以内なら/満点です。/超えると/点が/下がります。",
} as const satisfies Record<keyof typeof FUKUMENZAN_SCORE_MAXIMUMS, string>;

/**
 * 遊び方。ルール・操作・採点のタブで、本番と同じ盤面部品で描いた式の図と話し言葉の一文を並べる。
 */
export function FukumenzanHowToPlayDialog({
  open,
  onClose,
  onOpenTutorial,
}: FukumenzanHowToPlayDialogProps) {
  return (
    <HowToPlayOverlay
      open={open}
      game={game}
      description="文字ごとに/0〜9の/数字を/1つ/当てて、/足し算を/成り立たせる/パズルです。"
      goal={
        <EquationFigure
          problem={exampleProblem}
          placed={solution}
          tileRem={3}
          label="985 + 515 = 1500 と、全部の文字に札が入った式"
        />
      }
      onClose={onClose}
      onOpenTutorial={onOpenTutorial}
      rules={
        <>
          <HowToPlayRule
            text="同じ文字には/同じ数字、/違う文字には/違う数字を/当てます。"
            examples={
              <HowToPlayExample
                figure={
                  <EquationFigure
                    problem={exampleProblem}
                    placed={{ K: 5, B: 9 }}
                    tileRem={figureTileRem}
                    label="K の全部の場所に 5、B に 9 が入った式"
                  />
                }
              />
            }
          />
          <HowToPlayRule
            text="2桁以上の/数の/先頭は/0に/しません。"
            examples={
              <HowToPlayExample
                figure={
                  <EquationFigure
                    problem={exampleProblem}
                    placed={{ T: 0 }}
                    tileRem={figureTileRem}
                    label="答えの先頭の T に 0 が入り、赤くなった式"
                  />
                }
                caption="先頭の0は札が赤くなります。"
              />
            }
          />
          <HowToPlayRule
            text="足し算が/成り立てば/クリアです。"
            examples={
              <HowToPlayExample
                figure={
                  <EquationFigure
                    problem={exampleProblem}
                    placed={{ Y: 8, K: 5, T: 2, H: 0 }}
                    tileRem={figureTileRem}
                    label="十の位の足し算が合わず、答えの十の位の下に赤い線が出た式"
                  />
                }
                caption="一の位から埋まった桁で、合わない桁には赤い線が出ます。"
              />
            }
          />
        </>
      }
      operations={
        <>
          <HowToPlaySection title="札の入れ方">
            {operationTexts.map((text) => (
              <li key={text}>
                <p className="text-body">
                  <HowToPlayPhrases text={text} />
                </p>
              </li>
            ))}
          </HowToPlaySection>
          <HowToPlaySection title="やり直し">
            <HowToPlayOperationRow
              visual={
                // 本番の待ったのボタンそのままの、押しても何も起きない静止の図。
                <span aria-hidden="true" inert className="flex">
                  <UndoButton disabled={false} onUndo={ignoreFigurePress} />
                </span>
              }
              text={`「${undo}」を/押すと/最後の/札か/×の/操作が/元に戻ります。`}
              note={`時間は/そのままで/「${undo}」の回数が/増えます。`}
            />
            <HowToPlayMenuOperations operations={menuOperations} />
          </HowToPlaySection>
        </>
      }
      scoring={scoreItems.map(([item, maximum]) => (
        <HowToPlaySection
          key={item}
          title={SCORE_ITEM_LABELS[item]}
          value={`${maximum}点`}
          lead={scoreLeads[item]}
        >
          <HowToPlayScoreRow
            measure="基準時間"
            text="文字の/種類と、/式に/書かれた/文字が/多い問題ほど/長くなります。"
          />
          <HowToPlayScoreRow
            measure="0点になる時間"
            text={`基準時間の/${FUKUMENZAN_SPEED_ZERO_SCORE_RATIO}倍です。`}
          />
          <HowToPlayScoreRow
            measure={`「${undo}」・/「${restart}」・/札の入れ直し・/×`}
            text="何回/しても/点は/下がりません。"
          />
        </HowToPlaySection>
      ))}
    />
  );
}
