import { HowToPlayExample } from "@/components/HowToPlayExample";
import {
  describeParkingJamExampleCaption,
  findParkingJamExampleHint,
  listParkingJamExampleMoveMarks,
} from "@/games/parking-jam/ui/ParkingJamHowToPlayDialog/example-board";
import type { ParkingJamHowToPlayExample } from "@/games/parking-jam/ui/ParkingJamHowToPlayDialog/figure-boards";
import { parkingJamExampleCellClassName } from "@/games/parking-jam/ui/ParkingJamHowToPlayDialog/figure-size";
import { HowToPlayBoard } from "@/games/parking-jam/ui/ParkingJamHowToPlayDialog/HowToPlayBoard";
import { ExampleCaption } from "@/games/parking-jam/ui/ParkingJamHowToPlayDialog/TouchableExample/ExampleCaption";
import { useTouchableExample } from "@/games/parking-jam/ui/ParkingJamHowToPlayDialog/TouchableExample/use-touchable-example";

type TouchableExampleProps = {
  example: ParkingJamHowToPlayExample;
  /**
   * ルールの例か。ルールの例は、残っている車の両端に出られるかの印を付け、例の下に印の凡例か試した手の結果を添える。
   * 操作の例は、印と言葉を添えず、押す所の手がかりだけを付ける。
   */
  judged?: boolean;
};

/**
 * 触れる例。本番の盤面部品と session で、本番のプレイと同じに、スワイプか矢印で車を出し、出られない向きでは車を当てて揺らす。
 * 印と言葉は、触った後も今の盤面から本番の判定で出し直す。
 * 押す所の手がかりは、例が見せる手を順に打っていく途中の姿でだけ次の手に付け、当たったら盤面が変わるか車を押し直すまで消す。
 */
export function TouchableExample({
  example,
  judged = false,
}: TouchableExampleProps) {
  const {
    example: exampleBoard,
    operation,
    selectVehicle,
    move,
  } = useTouchableExample(example);
  return (
    <HowToPlayExample
      figure={
        <div className={parkingJamExampleCellClassName}>
          <HowToPlayBoard
            board={example.board}
            state={exampleBoard.session.puzzleState}
            selectedVehicleId={exampleBoard.selectedVehicleId}
            operation={operation}
            onSelectVehicle={selectVehicle}
            onMove={move}
            marks={
              judged
                ? listParkingJamExampleMoveMarks(exampleBoard, example)
                : undefined
            }
            hint={findParkingJamExampleHint(exampleBoard, example)}
            gesture={example.gesture}
          />
        </div>
      }
      caption={
        judged ? (
          <ExampleCaption
            caption={describeParkingJamExampleCaption(exampleBoard, example)}
            taughtBlocker={example.taughtBlocker}
          />
        ) : undefined
      }
    />
  );
}
