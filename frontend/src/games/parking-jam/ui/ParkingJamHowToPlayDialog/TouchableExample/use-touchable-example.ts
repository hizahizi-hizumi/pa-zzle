import { useRef, useState } from "react";

import { useReportHowToPlayExampleChange } from "@/components/HowToPlayExamplePanel";
import type { ParkingJamOperation } from "@/games/parking-jam/play/use-parking-jam-play";
import type {
  ParkingJamDirection,
  ParkingJamVehicleId,
} from "@/games/parking-jam/puzzle/board";
import {
  createParkingJamExampleBoard,
  isParkingJamExampleChanged,
  moveParkingJamExampleVehicle,
  type ParkingJamExampleBoard,
  selectParkingJamExampleVehicle,
} from "@/games/parking-jam/ui/ParkingJamHowToPlayDialog/example-board";
import type { ParkingJamHowToPlayExample } from "@/games/parking-jam/ui/ParkingJamHowToPlayDialog/figure-boards";
import { useParkingJamSoundEffects } from "@/games/parking-jam/ui/use-parking-jam-sound-effects";

type ParkingJamTouchableExample = {
  example: ParkingJamExampleBoard;
  /** 本番の盤面へ渡す、直前の手の知らせ。出ていく動きと、当たって揺れる動きに使う。 */
  operation: ParkingJamOperation | null;
  selectVehicle: (vehicleId: ParkingJamVehicleId) => void;
  move: (
    vehicleId: ParkingJamVehicleId,
    direction: ParkingJamDirection,
  ) => void;
};

/**
 * 触れる例の状態。本番のプレイと同じく、車を押すと両端に矢印を出し入れし、スワイプか矢印で車を出し、出られない向きでは車を当てて揺らす。
 * 音は本番と同じフックで鳴らす。例は解き終える盤面ではないので、最後の車が出てもクリア音は鳴らさない。
 * 手を試すたびに、盤面が最初と違うかを例を並べる面に知らせ、最初の姿に戻すときは、面が例を作り直す。
 * `definition` は最初の描画のときだけ読み、変わっても例を作り直さない。
 */
export function useTouchableExample(
  definition: ParkingJamHowToPlayExample,
): ParkingJamTouchableExample {
  const [example, setExample] = useState(() =>
    createParkingJamExampleBoard(definition),
  );
  const [operation, setOperation] = useState<ParkingJamOperation | null>(null);
  const operationIdRef = useRef(0);
  const reportChange = useReportHowToPlayExampleChange();

  useParkingJamSoundEffects(operation, "playing");

  function selectVehicle(vehicleId: ParkingJamVehicleId): void {
    const next = selectParkingJamExampleVehicle(example, vehicleId);
    if (next === example) {
      return;
    }
    // 本番のプレイと同じく、矢印を出し入れしたら直前の手の動きを下げる。
    setOperation(null);
    setExample(next);
  }

  function move(
    vehicleId: ParkingJamVehicleId,
    direction: ParkingJamDirection,
  ): void {
    const next = moveParkingJamExampleVehicle(example, {
      vehicleId,
      direction,
    });
    const attempt = next.lastAttempt;
    if (next === example || attempt === null) {
      return;
    }
    operationIdRef.current += 1;
    setOperation({
      id: operationIdRef.current,
      type: attempt.outcome,
      vehicleId,
      direction,
    });
    setExample(next);
    reportChange(isParkingJamExampleChanged(next, definition));
  }

  return { example, operation, selectVehicle, move };
}
