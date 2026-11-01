import { HowToPlayDialog } from "@/components/HowToPlayDialog";
import { HowToPlayRuleMark } from "@/components/HowToPlayRuleMark";
import { HowToPlayTransition } from "@/components/HowToPlayTransition";
import { HowToPlayFigure } from "@/games/ice-floor-maze/ui/IceFloorMazeHowToPlayDialog/HowToPlayFigure";

type IceFloorMazeHowToPlayDialogProps = {
  open: boolean;
  onClose: () => void;
};

// x  x  2  3  4
// 5  6  7  8  9
// 10 11 12 #  14
// 15 16 17 18 19
// 20 21 22 23 G
// 10 から右へ滑らせると、岩の手前の 12 で止まる。左上の2マスは盤面の外で、外壁が盤面の形に沿う。
const slideRows = ["xx...", ".....", "...#.", ".....", "....."];
const slideGoal = 24;

// 左の列から右へ滑らせる。岩の手前のゴールでは止まり、岩の無い行ではゴールを通り過ぎて外壁の手前で止まる。
const stopRows = ["....", "...#", "....", "...."];
const passRows = ["....", "....", "....", "...."];
const stopAndPassGoal = 6;

// 0 1 2 3
// 4 5 6 b
// 8 9 10 11
// 4 から右へ滑らせると、もろい岩の手前の 6 で止まり、もろい岩が崩れて氷になる。
const brittleBeforeRows = ["....", "...b", "...."];
const brittleAfterRows = ["....", "....", "...."];

// 0 1 2 3
// 4 c c 7
// 8 9 10 11
// 4 から右へ滑らせると、薄い氷の上を滑り抜けて 7 で止まり、通った薄い氷が割れて水面になる。
const thinBeforeRows = ["....", ".cc.", "...."];
const thinAfterRows = ["....", ".ww.", "...."];

/**
 * ルールと操作を、盤面と同じ見た目の小さな図と短い一文で示す。
 * もろい岩と薄い氷はどのレベルにも出るわけではないが、レベルによって出し分けずに同じ遊び方を示す
 * （リフレクションも、レベルによって出ないピースを含めて同じ遊び方を示す）。
 */
export function IceFloorMazeHowToPlayDialog({
  open,
  onClose,
}: IceFloorMazeHowToPlayDialogProps) {
  return (
    <HowToPlayDialog
      open={open}
      description="駒を氷の上で滑らせて、ゴールでぴたりと止める。"
      onClose={onClose}
    >
      <li className="space-y-2">
        <p>
          上下左右のどれかを選ぶと、駒は岩か外壁にぶつかるまで止まらずに滑る。途中で止めることはできない。
        </p>
        <HowToPlayTransition>
          <HowToPlayFigure rows={slideRows} goal={slideGoal} piece={10} />
          <HowToPlayFigure
            rows={slideRows}
            goal={slideGoal}
            piece={12}
            trail={{ direction: "right", from: 10 }}
          />
        </HowToPlayTransition>
      </li>
      <li className="space-y-2">
        <p>
          ゴールの上で止まればクリア。ゴールを通り過ぎただけではクリアにならない。
        </p>
        <div className="flex flex-wrap gap-x-5 gap-y-2">
          <div className="flex items-center gap-2">
            <HowToPlayFigure
              rows={stopRows}
              goal={stopAndPassGoal}
              piece={6}
              trail={{ direction: "right", from: 4 }}
            />
            <HowToPlayRuleMark allowed />
          </div>
          <div className="flex items-center gap-2">
            <HowToPlayFigure
              rows={passRows}
              goal={stopAndPassGoal}
              piece={7}
              trail={{ direction: "right", from: 4 }}
            />
            <HowToPlayRuleMark allowed={false} />
          </div>
        </div>
      </li>
      <li className="space-y-2">
        <p>
          割れ目の入った岩はもろい岩。岩と同じく駒を止め、滑ってきてぶつかると、止まった後に崩れて氷になる。すぐ隣から押しても崩れない。
        </p>
        <HowToPlayTransition>
          <HowToPlayFigure rows={brittleBeforeRows} piece={4} />
          <HowToPlayFigure
            rows={brittleAfterRows}
            piece={6}
            trail={{ direction: "right", from: 4 }}
          />
        </HowToPlayTransition>
      </li>
      <li className="space-y-2">
        <p>
          ひびの入った濃い氷は薄い氷。上を滑れるが、駒が離れると割れて水面になる。水面は岩と同じく駒を止める。
        </p>
        <HowToPlayTransition>
          <HowToPlayFigure rows={thinBeforeRows} piece={4} />
          <HowToPlayFigure
            rows={thinAfterRows}
            piece={7}
            trail={{ direction: "right", from: 4 }}
          />
        </HowToPlayTransition>
      </li>
      <li>
        <p>盤面をスワイプして、滑らせる向きを選ぶ。</p>
      </li>
      <li>
        <p>
          待ったで1手ずつ戻せる。崩れた岩や割れた氷も元に戻る。ゴールへ行けず、崩す・割るほかは同じところを回るだけになったら知らせるので、待ったか盤面を戻すで続ける。
        </p>
      </li>
      <li className="hidden pointer-fine:list-item">
        <p className="text-muted-foreground">
          キーボード: 矢印キーで、その向きへ滑らせる。
        </p>
      </li>
    </HowToPlayDialog>
  );
}
