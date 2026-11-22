import { HowToPlayExample } from "@/components/HowToPlayExample";
import {
  type HowToPlayMenuOperation,
  HowToPlayMenuOperations,
} from "@/components/HowToPlayMenuOperations";
import { HowToPlayOperationRow } from "@/components/HowToPlayOperationRow";
import { HowToPlayOverlay } from "@/components/HowToPlayOverlay";
import { HowToPlayRule } from "@/components/HowToPlayRule";
import { HowToPlayScoreRow } from "@/components/HowToPlayScoreRow";
import { HowToPlaySection } from "@/components/HowToPlaySection";
import { playMenuOperationItems } from "@/components/play-menu-operations";
import { UndoButton } from "@/components/UndoButton";
import {
  PLAY_OPERATION_LABELS,
  SCORE_ITEM_LABELS,
} from "@/games/play-vocabulary";
import pictogramSvg from "@/games/shuttle-parking/assets/pictogram.svg?raw";
import { SHUTTLE_PARKING_DISPLAY_NAME } from "@/games/shuttle-parking/display-name";
import {
  SHUTTLE_PARKING_SCORE_MAXIMUMS,
  SHUTTLE_PARKING_SPEED_ZERO_SCORE_RATIO,
  SHUTTLE_PARKING_TRAP_PENALTY,
} from "@/games/shuttle-parking/score";
import { ExampleFigure } from "@/games/shuttle-parking/ui/ShuttleParkingHowToPlayDialog/ExampleFigure";
import {
  type ShuttleParkingExampleFigure,
  shuttleParkingExampleFigures,
} from "@/games/shuttle-parking/ui/ShuttleParkingHowToPlayDialog/example-board";

type ShuttleParkingHowToPlayDialogProps = {
  open: boolean;
  onClose: () => void;
};

const game = { name: SHUTTLE_PARKING_DISPLAY_NAME, pictogramSvg };

const { undo } = PLAY_OPERATION_LABELS;

function renderExample(figure: ShuttleParkingExampleFigure) {
  return <HowToPlayExample figure={<ExampleFigure {...figure} />} />;
}

function ignoreFigurePress() {}

const menuOperations: readonly HowToPlayMenuOperation[] = [
  {
    item: playMenuOperationItems.restart,
    text: "時間と回数は/そのままで/最初の盤面に/戻します。",
  },
  {
    item: playMenuOperationItems.replay,
    text: "時間と回数も/0に戻して/同じ問題を/最初から/やり直します。",
  },
  {
    item: playMenuOperationItems.startNewProblem,
    text: "同じレベルの/別の問題に/変えます。",
  },
];

const scoreItems = Object.entries(SHUTTLE_PARKING_SCORE_MAXIMUMS) as [
  keyof typeof SHUTTLE_PARKING_SCORE_MAXIMUMS,
  number,
][];

const scoreLeads = {
  accuracy: `全員を/送り出せなくなる車を/出すたびに/${SHUTTLE_PARKING_TRAP_PENALTY}点/下がります。`,
  speed: `問題ごとの/基準時間以内なら/満点です。/超えると/下がります。/基準時間の/${SHUTTLE_PARKING_SPEED_ZERO_SCORE_RATIO}倍で/0点です。`,
} as const satisfies Record<
  keyof typeof SHUTTLE_PARKING_SCORE_MAXIMUMS,
  string
>;

function renderScoreRows(item: keyof typeof SHUTTLE_PARKING_SCORE_MAXIMUMS) {
  switch (item) {
    case "accuracy":
      return (
        <HowToPlayScoreRow
          measure="罠"
          text="まだ全員を/送り出せる盤面から/もう送り出せない盤面に/変えた出庫を/数えます。/戻した手数は/数えません。"
        />
      );
    case "speed":
      return (
        <HowToPlayScoreRow
          measure="基準時間"
          text="車と乗客が/多い問題ほど/長くなります。"
        />
      );
  }
}

export function ShuttleParkingHowToPlayDialog({
  open,
  onClose,
}: ShuttleParkingHowToPlayDialogProps) {
  return (
    <HowToPlayOverlay
      open={open}
      game={game}
      description="駐車場の車を/待機枠へ出して/列の乗客を/同じ色の車に/乗せて/全員を/送り出す/パズルです。"
      goal={<ExampleFigure {...shuttleParkingExampleFigures.cleared} />}
      onClose={onClose}
      rules={
        <>
          <HowToPlayRule
            text="車は/向いている方向に/まっすぐ進み/出口のある辺から/出て/待機枠に/入ります。/前に車があると/出られません。"
            arrangement="stacked"
            examples={renderExample(shuttleParkingExampleFigures.waiting)}
          />
          <HowToPlayRule
            text="列の先頭から/順に/同じ色の/待っている車に/1人ずつ/乗ります。/席が埋まった車は/出発して/枠が/空きます。"
            arrangement="stacked"
            examples={renderExample(shuttleParkingExampleFigures.departed)}
          />
          <HowToPlayRule
            text="待機枠が/埋まっていると/次の車を/出せません。"
            arrangement="stacked"
            examples={renderExample(shuttleParkingExampleFigures.baysFull)}
          />
        </>
      }
      operations={
        <>
          <HowToPlaySection title="出し方">
            <li>
              <HowToPlayRule
                headingLevel={4}
                text="車を/押すと/出せる車は/待機枠へ/出ます。"
                arrangement="stacked"
                examples={renderExample(shuttleParkingExampleFigures.start)}
              />
            </li>
          </HowToPlaySection>
          <HowToPlaySection title="やり直し">
            <HowToPlayOperationRow
              visual={
                <span aria-hidden="true" inert className="flex">
                  <UndoButton disabled={false} onUndo={ignoreFigurePress} />
                </span>
              }
              text={`「${undo}」で/最後に出した/1台を/駐車場に/戻します。`}
              note="時間は/そのままで/押した回数が/増えます。"
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
          {renderScoreRows(item)}
        </HowToPlaySection>
      ))}
    />
  );
}
