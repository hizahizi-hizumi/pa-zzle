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

// 0 1 2 3 4
// 5 6 o 8 9
// 10 11 12 13 14
// 5 から右へ滑らせると、床 7 に入ってそこで止まる。床の先 8・9 へは進まない。
const floorRows = [".....", "..o..", "....."];

// 0 1 2 3
// 4 5 6 b
// 8 9 10 11
// 4 から右へ滑らせると、もろい岩の手前の 6 で止まり、もろい岩が崩れて石くずの跡が残る氷になる。
const brittleBeforeRows = ["....", "...b", "...."];
const brittleAfterRows = ["....", "...r", "...."];

// 0 1 2 3
// 4 c c 7
// 8 9 10 11
// 4 から右へ滑らせると、薄い氷の上を滑り抜けて 7 で止まり、通った薄い氷が割れて水面になる。
const thinBeforeRows = ["....", ".cc.", "...."];
const thinAfterRows = ["....", ".ww.", "...."];

// 0 1 2 3
// 4 5 s 7
// 8 9 10 11
// 4 から右へ滑らせると、雪 6 に入って雪を 7 へ押し出し、6 で止まる。押し出した雪は 7 で雪山になる。
// ゴールを 7 に置くと、雪山がゴールをふさぐ。
const snowBeforeRows = ["....", "..s.", "...."];
const snowAfterRows = ["....", "...h", "...."];
const snowCoveredGoal = 7;

// 0 1 2 3
// 4 5 6 s
// 8 9 10 11
// 雪 7 の先は外壁なので押し出せない。4 から右へ滑らせると、雪は動かず、駒は雪の手前の 6 で止まる。
const snowStuckRows = ["....", "...s", "...."];

// 0 1 2  3 4
// 5 6 m  8 9
// 10 11 12 13 14
// 5 から右へ滑らせると、6 から滑る氷の塊 7 を押し、塊が外壁の手前の 9 まで滑って、駒はその手前の 8 で止まる。
const blockBeforeRows = [".....", "..m..", "....."];
const blockAfterRows = [".....", "....m", "....."];

// 0 1 2 3
// 4 5 m G
// 8 9 10 11
// 4 から右へ滑らせると、塊 6 がゴール 7 へ押されて載り、駒は 6 で止まる。塊が載っている間はゴールに入れない。
const blockGoalBeforeRows = ["....", "..m.", "...."];
const blockGoalAfterRows = ["....", "...m", "...."];
const blockGoal = 7;

// 0 1 2 3
// 4 w G 7
// 8 9 10 11
// 割れてできた水面 5 は止め役になる。7 から左へ滑らせると、水面の手前のゴール 6 で止まる。
const waterStopRows = ["....", ".w..", "...."];
const waterStopGoal = 6;

// 0 1 2 3
// 4 r 6 G
// 8 9 10 11
// もろい岩の崩れた跡 5 は氷と同じく通り抜けられる。4 から右へ滑らせると、跡を抜けてゴール 7 で止まる。
const rubblePassRows = ["....", ".r..", "...."];
const rubblePassGoal = 7;

/**
 * ルールと操作を、盤面と同じ見た目の小さな図と短い一文で示す。
 * 床・もろい岩・薄い氷・雪・滑る氷の塊はどのレベルにも出るわけではないが、レベルによって出し分けずに同じ遊び方を示す
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
          上下左右のどれかを選ぶと、駒は岩か外壁にぶつかるか、床に入るまで止まらずに滑る。途中で止めることはできない。
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
          擦り傷の入った緑の板は床。滑ってきた駒は床に入るとそこで止まる。ゴールと違い、通り過ぎずに止まる。床の上からは氷と同じく滑り出せる。
        </p>
        <HowToPlayTransition>
          <HowToPlayFigure rows={floorRows} piece={5} />
          <HowToPlayFigure
            rows={floorRows}
            piece={7}
            trail={{ direction: "right", from: 5 }}
          />
        </HowToPlayTransition>
      </li>
      <li className="space-y-2">
        <p>
          割れ目の入った明るい岩はもろい岩。岩と同じく駒を止め、滑ってきてぶつかると、止まった後に崩れて氷になる。崩れた跡の石くずは通り抜けられる。すぐ隣から押しても崩れない。
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
      <li className="space-y-2">
        <p>
          白く積もった平らな面は雪。滑ってきた駒が雪に入ると、雪を1マス先へ押し出して、雪のあったマスで止まる。押し出した雪は雪山になり、岩と同じく駒を止める。
        </p>
        <HowToPlayTransition>
          <HowToPlayFigure rows={snowBeforeRows} piece={4} />
          <HowToPlayFigure
            rows={snowAfterRows}
            piece={6}
            trail={{ direction: "right", from: 4 }}
          />
        </HowToPlayTransition>
      </li>
      <li className="space-y-2">
        <p>
          押し出す先が氷か薄い氷でなければ、雪は動かず、駒は雪の手前で止まる。雪山をゴールに押し出すと、そのゴールには止まれなくなる。
        </p>
        <HowToPlayTransition>
          <HowToPlayFigure rows={snowStuckRows} piece={4} />
          <HowToPlayFigure
            rows={snowStuckRows}
            piece={6}
            trail={{ direction: "right", from: 4 }}
          />
        </HowToPlayTransition>
        <HowToPlayTransition>
          <HowToPlayFigure
            rows={snowBeforeRows}
            goal={snowCoveredGoal}
            piece={4}
          />
          <HowToPlayFigure
            rows={snowAfterRows}
            goal={snowCoveredGoal}
            piece={6}
            trail={{ direction: "right", from: 4 }}
          />
        </HowToPlayTransition>
      </li>
      <li className="space-y-2">
        <p>
          水色の四角い塊は滑る氷の塊。岩と同じく駒を止めるが、滑ってきた駒がぶつかると、塊を押しながら一緒に滑り、塊が止まるとその手前で止まる。すぐ隣から押しても動かない。
        </p>
        <HowToPlayTransition>
          <HowToPlayFigure rows={blockBeforeRows} piece={5} />
          <HowToPlayFigure
            rows={blockAfterRows}
            piece={8}
            trail={{ direction: "right", from: 5 }}
          />
        </HowToPlayTransition>
      </li>
      <li className="space-y-2">
        <p>
          塊がゴールに載っている間は、ゴールに入れない。押してどかせば、またゴールに止まれる。
        </p>
        <HowToPlayTransition>
          <HowToPlayFigure
            rows={blockGoalBeforeRows}
            goal={blockGoal}
            piece={4}
          />
          <HowToPlayFigure
            rows={blockGoalAfterRows}
            goal={blockGoal}
            piece={6}
            trail={{ direction: "right", from: 4 }}
          />
        </HowToPlayTransition>
      </li>
      <li className="space-y-2">
        <p>
          変わった後の盤面も使える。割れてできた水面は駒を止める足場になり、もろい岩を崩すと通り道が開く。
        </p>
        <HowToPlayTransition>
          <HowToPlayFigure
            rows={waterStopRows}
            goal={waterStopGoal}
            piece={7}
          />
          <HowToPlayFigure
            rows={waterStopRows}
            goal={waterStopGoal}
            piece={6}
            trail={{ direction: "left", from: 7 }}
          />
        </HowToPlayTransition>
        <HowToPlayTransition>
          <HowToPlayFigure
            rows={rubblePassRows}
            goal={rubblePassGoal}
            piece={4}
          />
          <HowToPlayFigure
            rows={rubblePassRows}
            goal={rubblePassGoal}
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
          待ったで1手ずつ戻せる。崩れた岩や割れた氷、押した雪や塊も元に戻る。どう滑ってもゴールに止まれなくなったまま滑り続けたり、数か所を行き来するしかなくなったりすると、そのことを知らせる。待ったか盤面を戻すで、止まれるところまで戻る。
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
