import {
  type HowToPlayKey,
  HowToPlayKeyTable,
} from "@/components/HowToPlayKeyTable";
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
import pictogramSvg from "@/games/tsume-shogi/assets/pictogram.svg?raw";
import { TSUME_SHOGI_DISPLAY_NAME } from "@/games/tsume-shogi/display-name";
import {
  countTsumeShogiWrongChecksToZeroAccuracy,
  TSUME_SHOGI_SCORE_MAXIMUMS,
  TSUME_SHOGI_SPEED_ZERO_SCORE_RATIO,
  TSUME_SHOGI_WRONG_CHECK_PENALTY,
} from "@/games/tsume-shogi/score";
import { TsumeShogiPieceDefs } from "@/games/tsume-shogi/ui/board/TsumeShogiPieceDefs";
import {
  checkRuleExample,
  doublePawnRuleExamples,
  dropOperationExample,
  forcedPromotionRuleExamples,
  interpositionExample,
  mateCountExample,
  mateRuleExample,
  moveOperationExample,
  pawnDropMateRuleExamples,
  promotionOperationExample,
  type TsumeShogiHowToPlayExample,
} from "@/games/tsume-shogi/ui/TsumeShogiHowToPlayDialog/figure-boards";
import { GoalPlayback } from "@/games/tsume-shogi/ui/TsumeShogiHowToPlayDialog/GoalPlayback";
import { PieceMovementChart } from "@/games/tsume-shogi/ui/TsumeShogiHowToPlayDialog/PieceMovementChart";
import { PromotionFigure } from "@/games/tsume-shogi/ui/TsumeShogiHowToPlayDialog/PromotionFigure";
import { TouchableExample } from "@/games/tsume-shogi/ui/TsumeShogiHowToPlayDialog/TouchableExample";
import { WrongCheckFlows } from "@/games/tsume-shogi/ui/TsumeShogiHowToPlayDialog/WrongCheckFlows";

type TsumeShogiHowToPlayDialogProps = {
  open: boolean;
  onClose: () => void;
  /** 遊び方を閉じてチュートリアルを開く。開いた画面が渡す。 */
  onOpenTutorial?: () => void;
};

const game = { name: TSUME_SHOGI_DISPLAY_NAME, pictogramSvg };

const { undo, restart } = PLAY_OPERATION_LABELS;

/** 1つの盤面の例を、一文の下に置くルールか操作。 */
function renderSingleExample(
  text: string,
  example: TsumeShogiHowToPlayExample,
  headingLevel?: 4,
) {
  return (
    <HowToPlayRule
      text={text}
      headingLevel={headingLevel}
      arrangement="stacked"
      examples={<TouchableExample example={example} />}
    />
  );
}

/** 2つの例の対を、一文の下に並べるルール。できる形とできない形の対は、できる形を左に置く。 */
function renderPairRule(
  text: string,
  [allowed, disallowed]: readonly [
    TsumeShogiHowToPlayExample,
    TsumeShogiHowToPlayExample,
  ],
) {
  return (
    <HowToPlayRule
      text={text}
      examples={
        <>
          <TouchableExample example={allowed} />
          <TouchableExample example={disallowed} />
        </>
      }
    />
  );
}

function ignoreFigurePress() {}

/**
 * 本番の session に合わせて、時間が戻るかを言う。盤面を戻すは経過時間を引き継ぎ、リセットと別の問題は新しいプレイを始める。
 * 見出しの手数は盤面に指した手の数なので、盤面を戻すと0に戻ることは言わない。
 */
const menuOperations: readonly HowToPlayMenuOperation[] = [
  {
    item: playMenuOperationItems.restart,
    text: "時間は/戻さずに/最初の盤面から/指し直します。",
  },
  {
    item: playMenuOperationItems.replay,
    text: "時間も/0に戻して/同じ問題を/最初から/やり直します。",
  },
  {
    item: playMenuOperationItems.startNewProblem,
    text: "同じレベルの/ほかの詰将棋に/変えます。",
  },
];

/** Esc はプレイ画面のどこにフォーカスがあっても受け、選んだ駒か成・不成の選択肢を閉じる。升と持駒はボタンなので Tab で選べる。 */
const keyboardKeys: readonly HowToPlayKey[] = [
  {
    keys: ["Esc"],
    description: "駒や/「成」「不成」を/選ぶのをやめます。",
  },
];

/** 結果画面と同じ順に、評価の項目を満点と並べる。 */
const scoreItems = Object.entries(TSUME_SHOGI_SCORE_MAXIMUMS) as [
  keyof typeof TSUME_SHOGI_SCORE_MAXIMUMS,
  number,
][];

// 一文は、すぐ下の数えるものの行（1回ごとの減点）と同じことを言わず、どこで0点になるかを言う。
const scoreLeads = {
  accuracy: `誤王手/${countTsumeShogiWrongChecksToZeroAccuracy()}回で/0点です。`,
  speed: `問題ごとの/基準時間以内なら/満点です。/超えると/少しずつ/下がって/基準時間の/${TSUME_SHOGI_SPEED_ZERO_SCORE_RATIO}倍で/0点です。`,
} as const satisfies Record<keyof typeof TSUME_SHOGI_SCORE_MAXIMUMS, string>;

/** 点ごとに、数えるものを結果画面の採点基準と同じ呼び名で並べる。 */
function renderScoreRows(item: keyof typeof TSUME_SHOGI_SCORE_MAXIMUMS) {
  if (item === "speed") {
    // score.ts の基準時間は、盤面を見渡す時間に、攻方の手・初手の王手・効いていそうな誤王手・数手先まで続く紛れの数に応じた時間を足す。
    return (
      <HowToPlayScoreRow
        measure="基準時間"
        text="手数・/最初に/かけられる/王手・/詰みそうで/詰まない/王手が/多い問題ほど/長くなります。"
      />
    );
  }
  return (
    <>
      <HowToPlayScoreRow
        measure="誤王手"
        deduction={`1回 −${TSUME_SHOGI_WRONG_CHECK_PENALTY}点`}
        // 本番の session は、作意の筋から指した、残りの手数のうちに詰まない王手だけを数え、
        // 同じ局面からの同じ誤王手は待った・盤面を戻すで指し直しても1回にする。
        text="まだ/詰ませられる/盤面から/残りの手数では/詰まない/王手を/かけると/1回です。"
        figure={<WrongCheckFlows />}
      />
      <HowToPlayScoreRow
        measure={`「${undo}」・/「${restart}」`}
        // 正確さは誤王手の回数だけで決まり、待った・盤面を戻す・指せない手を押した回数・反証を見た回数では点を引かない（score.ts）。
        text="使っても/指せない手を/試しても/点は/下がりません。"
      />
    </>
  );
}

/**
 * 遊び方。ルール・操作・採点のタブで、本番と同じ盤・駒・駒台の触れる例と話し言葉の一文を並べる。
 * 例は盤の右上の隅を切り出した本番の盤面で、本番の session で動き、駒を選び・指し・成るかを選ばせ・指せない手で駒を揺らし、
 * 間を置いて玉方が応じ、詰めば本番の詰みの演出を見せる。
 */
export function TsumeShogiHowToPlayDialog({
  open,
  onClose,
  onOpenTutorial,
}: TsumeShogiHowToPlayDialogProps) {
  return (
    <TsumeShogiPieceDefs>
      <HowToPlayOverlay
        open={open}
        game={game}
        description="手前向きの/攻方の駒で/逆向きの/玉方の玉に/王手を/かけ続けて/詰ませる/パズルです。"
        goal={<GoalPlayback />}
        onClose={onClose}
        onOpenTutorial={onOpenTutorial}
        rules={
          <>
            {renderSingleExample(
              "次に/玉を取れる手（王手）/だけを/指せます。",
              checkRuleExample,
            )}
            {renderSingleExample(
              "「3手詰」なら/玉方の手も/入れて/3手で/詰ませます。",
              mateCountExample,
            )}
            {renderSingleExample(
              "玉の/逃げ道を/ふさぐ/王手で/詰ませます。",
              mateRuleExample,
            )}
            {renderSingleExample(
              "玉方は/盤の上にも/攻方の持駒にも/無い駒を/全部/持っています。",
              interpositionExample,
            )}
            <HowToPlayRule
              text="駒は/図の/向きへ/動けます。/成った銀・桂馬・香車・歩は/金と/同じように/動きます。"
              arrangement="stacked"
              examples={<PieceMovementChart />}
            />
            <HowToPlayRule
              text="上の3段から/動くか/上の3段へ/動くと/成れます。"
              arrangement="stacked"
              examples={<PromotionFigure />}
            />
            {renderPairRule(
              "歩は/攻方の歩が/無い/縦の列にだけ/打てます。",
              doublePawnRuleExamples,
            )}
            {renderPairRule(
              "歩を打って/王手を/かけられるのは/その手で/詰まない/ときだけです。",
              pawnDropMateRuleExamples,
            )}
            {renderPairRule(
              "上の2段へ/動く桂馬と/いちばん上の段へ/動く香車・歩は/必ず成ります。/打つときは/それより下の段に/打ちます。",
              forcedPromotionRuleExamples,
            )}
          </>
        }
        operations={
          <>
            <HowToPlaySection title="指し方">
              <li>
                {renderSingleExample(
                  "動かす駒を/押して選んでから/行き先の升を/押します。/選んだ駒を/もう一度押すと/選ぶのをやめます。",
                  moveOperationExample,
                  4,
                )}
              </li>
              <li>
                {renderSingleExample(
                  "持駒を/押して選んでから/打つ升を/押します。/取った駒も/持駒に/なります。",
                  dropOperationExample,
                  4,
                )}
              </li>
              <li>
                {renderSingleExample(
                  "成っても/成らなくても/王手になるときは/「成」か/「不成」を/選びます。",
                  promotionOperationExample,
                  4,
                )}
              </li>
            </HowToPlaySection>
            <HowToPlaySection title="やり直し">
              <HowToPlayOperationRow
                visual={
                  // 本番の待ったのボタンそのままの、押しても何も起きない静止の図。
                  <span aria-hidden="true" inert className="flex">
                    <UndoButton disabled={false} onUndo={ignoreFigurePress} />
                  </span>
                }
                text={`「${undo}」で/最後の/王手と/玉方の手を/取り消します。/詰まない王手の/後では/その王手の/前まで/一度に戻ります。`}
                note="時間は/戻りません。"
              />
              <HowToPlayMenuOperations operations={menuOperations} />
            </HowToPlaySection>
            <HowToPlaySection title="キーボード" availability="fine-pointer">
              <li>
                <HowToPlayKeyTable keys={keyboardKeys} />
              </li>
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
    </TsumeShogiPieceDefs>
  );
}
