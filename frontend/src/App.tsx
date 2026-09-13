import { CheckCircle2, ChevronLeft, Droplets, Grid3X3 } from "lucide-react";
import { type ReactNode, useReducer } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  type DifficultyId,
  type GameId,
  type GameSessionResult,
  initialPlayFlowState,
  playFlowReducer,
} from "@/play-flow";
import "./index.css";

type GameDefinition = {
  id: GameId;
  name: string;
  description: string;
};

type DifficultyDefinition = {
  id: DifficultyId;
  name: string;
  description: string;
};

const games: GameDefinition[] = [
  {
    id: "water-sort",
    name: "カラーウォーターソート",
    description: "色水を同じ色ごとにまとめる状態遷移型のパズル",
  },
  {
    id: "sudoku",
    name: "ナンプレ",
    description: "1〜9の数字をルールに従って埋める論理推論型のパズル",
  },
];

const difficulties: DifficultyDefinition[] = [
  { id: "easy", name: "初級", description: "まずは気軽に遊べる難しさ" },
  { id: "normal", name: "中級", description: "少し考えながら遊ぶ難しさ" },
  { id: "hard", name: "上級", description: "じっくり考えて挑む難しさ" },
];

function findGame(gameId: GameId) {
  const game = games.find((candidate) => candidate.id === gameId);
  if (!game) {
    throw new Error(`Unknown game: ${gameId}`);
  }
  return game;
}

function findDifficulty(difficultyId: DifficultyId) {
  const difficulty = difficulties.find(
    (candidate) => candidate.id === difficultyId,
  );
  if (!difficulty) {
    throw new Error(`Unknown difficulty: ${difficultyId}`);
  }
  return difficulty;
}

function AppHeader({ step }: { step: string }) {
  return (
    <header className="space-y-2">
      <p className="text-sm font-medium text-muted-foreground">{step}</p>
      <h1 className="text-3xl font-bold tracking-tight">パズル pa-zzle</h1>
      <p className="max-w-xl text-sm leading-6 text-muted-foreground">
        遊びたいパズルと難易度を選んで、1プレイの結果まで進めます。
      </p>
    </header>
  );
}

function GameSelection({ onSelect }: { onSelect: (gameId: GameId) => void }) {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      {games.map((game) => (
        <Card key={game.id} className="h-full">
          <CardHeader>
            <div className="mb-2 flex size-10 items-center justify-center rounded-lg bg-muted">
              {game.id === "water-sort" ? (
                <Droplets aria-hidden="true" />
              ) : (
                <Grid3X3 aria-hidden="true" />
              )}
            </div>
            <CardTitle>{game.name}</CardTitle>
            <CardDescription>{game.description}</CardDescription>
          </CardHeader>
          <CardFooter className="mt-auto">
            <Button className="w-full" onClick={() => onSelect(game.id)}>
              このゲームを選ぶ
            </Button>
          </CardFooter>
        </Card>
      ))}
    </div>
  );
}

function DifficultySelection({
  gameId,
  onBack,
  onSelect,
}: {
  gameId: GameId;
  onBack: () => void;
  onSelect: (difficulty: DifficultyId) => void;
}) {
  const game = findGame(gameId);

  return (
    <div className="space-y-5">
      <Button variant="ghost" className="-ml-3" onClick={onBack}>
        <ChevronLeft aria-hidden="true" />
        ゲーム選択へ戻る
      </Button>
      <div>
        <p className="text-sm text-muted-foreground">{game.name}</p>
        <h2 className="text-2xl font-semibold">難易度を選ぶ</h2>
      </div>
      <div className="grid gap-3 md:grid-cols-3">
        {difficulties.map((difficulty) => (
          <Card key={difficulty.id}>
            <CardHeader>
              <CardTitle>{difficulty.name}</CardTitle>
              <CardDescription>{difficulty.description}</CardDescription>
            </CardHeader>
            <CardFooter>
              <Button
                variant="outline"
                className="w-full"
                onClick={() => onSelect(difficulty.id)}
              >
                {difficulty.name}で開始
              </Button>
            </CardFooter>
          </Card>
        ))}
      </div>
    </div>
  );
}

function WaterSortPlay({
  difficulty,
  onClear,
}: {
  difficulty: DifficultyId;
  onClear: (result: GameSessionResult) => void;
}) {
  return (
    <PlaceholderPlayCard
      title="カラーウォーターソート"
      difficulty={difficulty}
      onClear={onClear}
    >
      <div
        className="flex items-end justify-center gap-3 py-6"
        aria-hidden="true"
      >
        {["bg-sky-300", "bg-amber-300", "bg-violet-300", "bg-emerald-300"].map(
          (color) => (
            <div
              key={color}
              className="flex h-32 w-12 items-end rounded-b-xl border-2 border-t-0 p-1"
            >
              <div className={`h-3/4 w-full rounded-b-lg ${color}`} />
            </div>
          ),
        )}
      </div>
    </PlaceholderPlayCard>
  );
}

function SudokuPlay({
  difficulty,
  onClear,
}: {
  difficulty: DifficultyId;
  onClear: (result: GameSessionResult) => void;
}) {
  const cells = [
    { id: "r1c1", value: "5" },
    { id: "r1c2", value: "" },
    { id: "r1c3", value: "8" },
    { id: "r2c1", value: "" },
    { id: "r2c2", value: "7" },
    { id: "r2c3", value: "" },
    { id: "r3c1", value: "4" },
    { id: "r3c2", value: "" },
    { id: "r3c3", value: "2" },
  ];

  return (
    <PlaceholderPlayCard
      title="ナンプレ"
      difficulty={difficulty}
      onClear={onClear}
    >
      <div
        className="mx-auto grid w-48 grid-cols-3 border-2"
        aria-hidden="true"
      >
        {cells.map((cell) => (
          <div
            key={cell.id}
            className="flex aspect-square items-center justify-center border text-lg font-semibold"
          >
            {cell.value}
          </div>
        ))}
      </div>
    </PlaceholderPlayCard>
  );
}

function PlaceholderPlayCard({
  title,
  difficulty,
  onClear,
  children,
}: {
  title: string;
  difficulty: DifficultyId;
  onClear: (result: GameSessionResult) => void;
  children: ReactNode;
}) {
  const difficultyDefinition = findDifficulty(difficulty);

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>
          {difficultyDefinition.name}
          ・共通プレイ導線を確認するための仮プレイ画面
        </CardDescription>
      </CardHeader>
      <CardContent>{children}</CardContent>
      <CardFooter>
        <Button
          className="w-full"
          onClick={() => onClear({ status: "cleared" })}
        >
          この問題をクリア
        </Button>
      </CardFooter>
    </Card>
  );
}

function Playing({
  gameId,
  difficulty,
  onBack,
  onClear,
}: {
  gameId: GameId;
  difficulty: DifficultyId;
  onBack: () => void;
  onClear: (result: GameSessionResult) => void;
}) {
  return (
    <div className="space-y-5">
      <Button variant="ghost" className="-ml-3" onClick={onBack}>
        <ChevronLeft aria-hidden="true" />
        難易度選択へ戻る
      </Button>
      {gameId === "water-sort" ? (
        <WaterSortPlay difficulty={difficulty} onClear={onClear} />
      ) : (
        <SudokuPlay difficulty={difficulty} onClear={onClear} />
      )}
    </div>
  );
}

function Result({
  gameId,
  difficulty,
  onPlayAgain,
  onChooseGame,
}: {
  gameId: GameId;
  difficulty: DifficultyId;
  onPlayAgain: () => void;
  onChooseGame: () => void;
}) {
  const game = findGame(gameId);
  const difficultyDefinition = findDifficulty(difficulty);

  return (
    <Card>
      <CardHeader className="text-center">
        <CheckCircle2
          aria-hidden="true"
          className="mx-auto mb-2 size-12 text-emerald-600"
        />
        <CardTitle className="text-2xl">クリア</CardTitle>
        <CardDescription>1プレイの成績を表示しています。</CardDescription>
      </CardHeader>
      <CardContent>
        <dl className="mx-auto grid max-w-md gap-3 rounded-lg bg-muted/60 p-4 text-sm">
          <div className="flex justify-between gap-4">
            <dt className="text-muted-foreground">ゲーム</dt>
            <dd className="font-medium">{game.name}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-muted-foreground">難易度</dt>
            <dd className="font-medium">{difficultyDefinition.name}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-muted-foreground">クリア状況</dt>
            <dd className="font-medium">クリア</dd>
          </div>
        </dl>
      </CardContent>
      <CardFooter className="grid gap-2 sm:grid-cols-2">
        <Button variant="outline" onClick={onChooseGame}>
          別のゲームを選ぶ
        </Button>
        <Button onClick={onPlayAgain}>同じ条件でもう一度</Button>
      </CardFooter>
    </Card>
  );
}

export function App() {
  const [state, dispatch] = useReducer(playFlowReducer, initialPlayFlowState);

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-4xl flex-col gap-8 px-4 py-10 sm:px-6">
      <AppHeader
        step={
          state.screen === "game-selection"
            ? "ゲーム選択"
            : state.screen === "difficulty-selection"
              ? "難易度選択"
              : state.screen === "playing"
                ? "プレイ"
                : "成績"
        }
      />

      {state.screen === "game-selection" && (
        <GameSelection
          onSelect={(gameId) => dispatch({ type: "select-game", gameId })}
        />
      )}
      {state.screen === "difficulty-selection" && (
        <DifficultySelection
          gameId={state.gameId}
          onBack={() => dispatch({ type: "back-to-games" })}
          onSelect={(difficulty) =>
            dispatch({ type: "select-difficulty", difficulty })
          }
        />
      )}
      {state.screen === "playing" && (
        <Playing
          gameId={state.gameId}
          difficulty={state.difficulty}
          onBack={() => dispatch({ type: "back-to-difficulties" })}
          onClear={(result) => dispatch({ type: "clear-game", result })}
        />
      )}
      {state.screen === "result" && (
        <Result
          gameId={state.gameId}
          difficulty={state.difficulty}
          onPlayAgain={() => dispatch({ type: "play-again" })}
          onChooseGame={() => dispatch({ type: "back-to-games" })}
        />
      )}
    </main>
  );
}

export default App;
