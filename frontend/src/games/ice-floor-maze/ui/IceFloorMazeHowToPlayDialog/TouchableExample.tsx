import { useMemo } from "react";

import { HowToPlayCaptionLayers } from "@/components/HowToPlayCaptionLayers";
import { HowToPlayExample } from "@/components/HowToPlayExample";
import { HowToPlayVerdictLine } from "@/components/HowToPlayVerdictLine";
import { HowToPlayVerdictMark } from "@/components/HowToPlayVerdictMark";
import {
  describeIceFloorMazeExample,
  findIceFloorMazeExampleHint,
  type IceFloorMazeExampleCaption,
  isIceFloorMazeExampleBlocked,
  listIceFloorMazeExampleCaptions,
} from "@/games/ice-floor-maze/ui/IceFloorMazeHowToPlayDialog/example-board";
import type { IceFloorMazeHowToPlayExample } from "@/games/ice-floor-maze/ui/IceFloorMazeHowToPlayDialog/figure-boards";
import { HowToPlayBoard } from "@/games/ice-floor-maze/ui/IceFloorMazeHowToPlayDialog/TouchableExample/HowToPlayBoard";
import { useTouchableExample } from "@/games/ice-floor-maze/ui/IceFloorMazeHowToPlayDialog/use-touchable-example";

function getCaptionId({ mark, text }: IceFloorMazeExampleCaption): string {
  return `${mark}:${text}`;
}

type TouchableExampleProps = {
  example: IceFloorMazeHowToPlayExample;
};

/**
 * 触れる例。本番の盤面部品で、本番と同じスワイプ（Tab で選んだときは矢印キー）で滑らせ、本番の `puzzle/` の関数で動かす。
 * 図の下の言葉は、手を打つ前は手がかりの最初の手で起きることを、打った後は最後の手で起きたことを、本番のルールから求めて言う。
 * 言葉は出しうるものをすべて共通の言葉の層に重ね、今の言葉だけを見せる。✓ / ✕ は判定と同じ記号で言葉の前に置く。
 * 次に滑らせる向きの手がかりは、手がかりの手を順に打っていく途中の姿でだけ付け、動けなかった手の後は盤面が変わるまで消す。
 */
export function TouchableExample({ example }: TouchableExampleProps) {
  const touchable = useTouchableExample(example);
  const { board } = touchable;
  const captions = useMemo(
    () => listIceFloorMazeExampleCaptions(example),
    [example],
  );
  const caption = describeIceFloorMazeExample(board);
  const hint = findIceFloorMazeExampleHint(board);
  return (
    <HowToPlayExample
      figure={
        <HowToPlayBoard
          board={board.example.board}
          state={board.state}
          goal={board.example.goal}
          lastSlide={touchable.lastSlide}
          blockedInput={touchable.blockedInput}
          clearing={touchable.clearing}
          playing={touchable.playing}
          hint={
            hint === null
              ? null
              : {
                  direction: hint,
                  blocked: isIceFloorMazeExampleBlocked(board, hint),
                }
          }
          onSlide={touchable.slide}
          onClearAnimationComplete={touchable.completeClearAnimation}
        />
      }
      caption={
        caption === null ? undefined : (
          <HowToPlayCaptionLayers
            layers={captions.map((listed) => ({
              id: getCaptionId(listed),
              shown: getCaptionId(listed) === getCaptionId(caption),
              content: (
                <HowToPlayVerdictLine
                  mark={
                    listed.mark === null ? undefined : (
                      <HowToPlayVerdictMark verdict={listed.mark} />
                    )
                  }
                >
                  {listed.text}
                </HowToPlayVerdictLine>
              ),
            }))}
          />
        )
      }
    />
  );
}
