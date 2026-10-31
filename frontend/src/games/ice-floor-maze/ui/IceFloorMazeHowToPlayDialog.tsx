import { HowToPlayDialog } from "@/components/HowToPlayDialog";
import { HowToPlayRuleMark } from "@/components/HowToPlayRuleMark";
import { HowToPlayTransition } from "@/components/HowToPlayTransition";
import { HowToPlayFigure } from "@/games/ice-floor-maze/ui/IceFloorMazeHowToPlayDialog/HowToPlayFigure";

type IceFloorMazeHowToPlayDialogProps = {
  open: boolean;
  onClose: () => void;
};

// 0  1  2  3  4
// 5  6  7  8  9
// 10 11 12 #  14
// 15 16 17 18 19
// 20 21 22 23 G
// 10 から右へ滑らせると、岩の手前の 12 で止まる。
const slideRows = [".....", ".....", "...#.", ".....", "....."];
const slideGoal = 24;

// 左の列から右へ滑らせる。岩の手前のゴールでは止まり、岩の無い行ではゴールを通り過ぎて外壁の手前で止まる。
const stopRows = ["....", "...#", "....", "...."];
const passRows = ["....", "....", "....", "...."];
const stopAndPassGoal = 6;

/** ルールと操作を、盤面と同じ見た目の小さな図と短い一文で示す。 */
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
      <li>
        <p>盤面をスワイプするか、下の矢印ボタンで滑らせる向きを選ぶ。</p>
      </li>
      <li>
        <p>
          待ったで1手ずつ戻せる。どこへ滑ってもゴールへ行けない場所に閉じ込められたら知らせるので、待ったか盤面を戻すで続ける。
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
