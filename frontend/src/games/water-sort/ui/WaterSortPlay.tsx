import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { Seed } from "@/games/core/seed";
import {
  getWaterSortDifficultyLabel,
  type WaterSortDifficulty,
  type WaterSortDifficultyAssessment,
} from "@/games/water-sort/game/difficulty";
import type { WaterSortState } from "@/games/water-sort/game/state";
import type { WaterSortResult } from "@/games/water-sort/hooks/use-water-sort-game";
import { WaterSortBoard } from "@/games/water-sort/ui/WaterSortBoard";

type WaterSortPlayProps = {
  difficulty: WaterSortDifficulty;
  seed: Seed;
  status: "playing" | "cleared";
  state: WaterSortState;
  elapsedMs: number;
  moveCount: number;
  undoCount: number;
  restartCount: number;
  optimalMoveCount: number;
  problemDifficulty: WaterSortDifficultyAssessment;
  canUndo: boolean;
  sourceBottleIndex: number | null;
  selectableBottleIndexes: ReadonlySet<number>;
  result: WaterSortResult | null;
  selectBottle: (bottleIndex: number) => void;
  undo: () => void;
  restart: () => void;
  newGame: () => void;
  onChangeDifficulty: () => void;
};

export function WaterSortPlay({
  difficulty,
  seed,
  status,
  state,
  elapsedMs,
  moveCount,
  undoCount,
  restartCount,
  optimalMoveCount,
  problemDifficulty,
  canUndo,
  sourceBottleIndex,
  selectableBottleIndexes,
  result,
  selectBottle,
  undo,
  restart,
  newGame,
  onChangeDifficulty,
}: WaterSortPlayProps) {
  if (status === "cleared" && result) {
    return (
      <Card className="mx-auto max-w-2xl">
        <CardHeader>
          <CardTitle className="text-2xl">クリア</CardTitle>
          <CardDescription>
            {getWaterSortDifficultyLabel(difficulty)}
            のカラーウォーターソートをクリアしました。
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-md border bg-muted/30 p-4 text-center">
            <p className="text-xs text-muted-foreground">プレイ評価（仮）</p>
            <p className="mt-1 font-mono text-3xl font-semibold">
              {result.score} / 100
            </p>
            <p className="mt-2 text-xs text-muted-foreground">
              最短手数に対する手数効率から算出しています。
            </p>
          </div>
          <PlayMetrics
            elapsedMs={result.elapsedMs}
            moveCount={result.moveCount}
            undoCount={result.undoCount}
            restartCount={result.restartCount}
          />
          <dl className="grid grid-cols-3 gap-2 text-center">
            <Metric
              label="問題難易度"
              value={getWaterSortDifficultyLabel(problemDifficulty.difficulty)}
            />
            <Metric label="最短手数" value={String(result.optimalMoveCount)} />
            <Metric
              label="最短との差"
              value={formatMoveDelta(result.moveDelta)}
            />
          </dl>
          <ProblemSeed seed={seed} />
        </CardContent>
        <CardFooter className="flex flex-wrap gap-3">
          <Button onClick={restart}>同じ問題をもう一度</Button>
          <Button variant="outline" onClick={newGame}>
            新しい問題
          </Button>
          <Button variant="outline" onClick={onChangeDifficulty}>
            難易度を変える
          </Button>
        </CardFooter>
      </Card>
    );
  }

  return (
    <Card className="mx-auto max-w-2xl">
      <CardHeader>
        <CardTitle>カラーウォーターソート</CardTitle>
        <CardDescription>
          難易度: {getWaterSortDifficultyLabel(difficulty)} / 最短{" "}
          {optimalMoveCount}手
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <PlayMetrics
          elapsedMs={elapsedMs}
          moveCount={moveCount}
          undoCount={undoCount}
          restartCount={restartCount}
        />
        <WaterSortBoard
          state={state}
          sourceBottleIndex={sourceBottleIndex}
          selectableBottleIndexes={selectableBottleIndexes}
          onSelectBottle={selectBottle}
        />
        <p className="text-center text-xs text-muted-foreground">
          注ぎ元を選んだあと、注げるボトルを選んでください。
        </p>
        <ProblemSeed seed={seed} />
      </CardContent>
      <CardFooter className="flex flex-wrap gap-3">
        <Button variant="outline" onClick={undo} disabled={!canUndo}>
          元に戻す
        </Button>
        <Button variant="outline" onClick={restart}>
          やり直す
        </Button>
        <Button variant="outline" onClick={newGame}>
          新しい問題
        </Button>
        <Button variant="outline" onClick={onChangeDifficulty}>
          難易度を変える
        </Button>
      </CardFooter>
    </Card>
  );
}

function PlayMetrics({
  elapsedMs,
  moveCount,
  undoCount,
  restartCount,
}: Pick<
  WaterSortResult,
  "elapsedMs" | "moveCount" | "undoCount" | "restartCount"
>) {
  return (
    <dl className="grid grid-cols-2 gap-2 text-center sm:grid-cols-4">
      <Metric label="経過時間" value={formatElapsedTime(elapsedMs)} />
      <Metric label="手数" value={String(moveCount)} />
      <Metric label="元に戻した回数" value={String(undoCount)} />
      <Metric label="やり直した回数" value={String(restartCount)} />
    </dl>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border bg-muted/30 px-2 py-3">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-1 font-mono text-lg font-semibold">{value}</dd>
    </div>
  );
}

function ProblemSeed({ seed }: { seed: Seed }) {
  return (
    <p className="break-all font-mono text-xs text-muted-foreground">
      問題シード: {seed}
    </p>
  );
}

function formatMoveDelta(moveDelta: number): string {
  return moveDelta === 0 ? "±0" : `+${moveDelta}`;
}

function formatElapsedTime(elapsedMs: number): string {
  const totalSeconds = Math.floor(elapsedMs / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  }

  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}
