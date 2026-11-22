import { ShuttleParkingLot } from "@/games/shuttle-parking/ui/board/ShuttleParkingLot";
import { ShuttleParkingBays } from "@/games/shuttle-parking/ui/ShuttleParkingBays";
import type { ShuttleParkingExampleFigure } from "@/games/shuttle-parking/ui/ShuttleParkingHowToPlayDialog/example-board";
import { ShuttleParkingQueue } from "@/games/shuttle-parking/ui/ShuttleParkingQueue";

function ignoreExit() {}

/** 本番と同じ部品で、列・待機枠・駐車場を縦に並べた静止の図。 */
export function ExampleFigure({ puzzle, state }: ShuttleParkingExampleFigure) {
  return (
    <div inert className="flex w-48 flex-col gap-2">
      <ShuttleParkingQueue
        passengers={puzzle.passengers}
        boardedCount={state.boardedCount}
      />
      <ShuttleParkingBays
        cars={puzzle.lot.cars}
        bayCount={puzzle.bayCount}
        waitingCars={state.waitingCars}
      />
      <ShuttleParkingLot
        lot={puzzle.lot}
        parkedCarIds={state.parkedCarIds}
        operation={null}
        interactionDisabled
        onExitCar={ignoreExit}
      />
    </div>
  );
}
