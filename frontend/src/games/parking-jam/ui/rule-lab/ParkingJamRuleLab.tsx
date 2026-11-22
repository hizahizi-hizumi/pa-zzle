import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  dispatchLevelProblems,
  pairProblems,
  passengerProblems,
} from "@/games/parking-jam/rule-lab/dispatch-levels";
import {
  analyzeRuleLab,
  applyRuleLabExit,
  createRuleLabState,
  getRuleLabScenario,
  isRuleLabStuck,
  isRuleLabWon,
  legalRuleLabExits,
  type RuleLabBayCount,
  type RuleLabMode,
  type RuleLabSize,
  type RuleLabState,
  vehicleColor,
} from "@/games/parking-jam/rule-lab/rule-lab";
import { ParkingJamRuleLabBoard } from "@/games/parking-jam/ui/rule-lab/ParkingJamRuleLab/ParkingJamRuleLabBoard";
import { ruleLabColorStyle } from "@/games/parking-jam/ui/rule-lab/rule-lab-colors";

const modes = [
  { id: "standard", title: "現行ルール" },
  { id: "passengers", title: "乗客列＋待機枠" },
  { id: "pairs", title: "同色ペア＋待機枠" },
  { id: "dispatch", title: "色別出庫指令＋待機枠" },
] as const satisfies readonly { id: RuleLabMode; title: string }[];

const QUEUE_SLOT_IDS = Array.from(
  { length: 32 },
  (_, index) => `queue-slot-${index}`,
);
const BAY_SLOT_IDS = Array.from(
  { length: 5 },
  (_, index) => `bay-slot-${index}`,
);

const descriptions: Record<RuleLabMode, string> = {
  standard:
    "車をタップして出庫させ、すべての車を出せばクリアです。出せる車を選ぶ限り、間違った順序はありません。",
  passengers:
    "車を出庫させると乗り場の空き枠に入ります。左から順に並ぶ乗客は、色が合う車に1人ずつ乗り込みます。車体の長さ（2または3人分）だけ乗ると出発し、枠が空きます。すべての乗客と車を送り出せばクリア。",
  pairs:
    "車を出庫させると待機枠に入ります。同色2台がそろった瞬間に出発して枠が空きます。2枠ではペアを連続して完成させます。3枠では1台を一時待機させ、別のペアを先に完成させることもできます。",
  dispatch:
    "出庫指令は左から順に処理します。車を出庫させると待機枠に入り、先頭の指令と色が一致すれば即座に出発して枠が空きます。待機中の車も次の指令に一致すると出発します。待機枠が埋まると、指令と色が合う車も出庫できません。指令は全部公開しています。",
};

function labelOfVehicle(vehicleId: string): string {
  return `車${Number(vehicleId.slice(1)) + 1}`;
}

export function ParkingJamRuleLab() {
  const [mode, setMode] = useState<RuleLabMode>("standard");
  const [size, setSize] = useState<RuleLabSize>("small");
  const [bayCount, setBayCount] = useState<RuleLabBayCount>(2);
  const [history, setHistory] = useState<RuleLabState[]>([]);
  const [state, setState] = useState<RuleLabState>(() =>
    createRuleLabState(getRuleLabScenario("standard", "small")),
  );
  const [showAnalysis, setShowAnalysis] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [problemId, setProblemId] = useState<string | null>(null);
  const problems =
    mode === "dispatch"
      ? dispatchLevelProblems
      : mode === "passengers"
        ? passengerProblems
        : mode === "pairs"
          ? pairProblems
          : [];
  const problem = problems.find((item) => item.id === problemId);
  const scenario =
    problem?.scenario ?? getRuleLabScenario(mode, size, bayCount);
  const legal = legalRuleLabExits(scenario, state);
  const won = isRuleLabWon(scenario, state);
  const stuck = isRuleLabStuck(scenario, state);
  const result = showAnalysis ? analyzeRuleLab(scenario, state) : null;
  const outcomeByVehicle = new Map(
    result?.exits.map(({ vehicleId, canWin }) => [vehicleId, canWin]) ?? [],
  );

  const playAreaRef = useRef<HTMLDivElement>(null);

  function changeProblem(nextId: string | null) {
    const next = problems.find((item) => item.id === nextId);
    setProblemId(next ? next.id : null);
    setState(
      createRuleLabState(
        next?.scenario ?? getRuleLabScenario(mode, size, bayCount),
      ),
    );
    setHistory([]);
    setNotice(null);
    setShowAnalysis(false);
    if (next) playAreaRef.current?.scrollIntoView({ block: "start" });
  }

  function changeMode(nextMode: RuleLabMode) {
    setMode(nextMode);
    setProblemId(null);
    setState(createRuleLabState(getRuleLabScenario(nextMode, size, bayCount)));
    setHistory([]);
    setNotice(null);
    setShowAnalysis(false);
  }

  function changeSize(nextSize: RuleLabSize) {
    setSize(nextSize);
    setState(createRuleLabState(getRuleLabScenario(mode, nextSize, bayCount)));
    setHistory([]);
    setNotice(null);
    setShowAnalysis(false);
  }

  function changeBays(nextBays: RuleLabBayCount) {
    setBayCount(nextBays);
    setState(createRuleLabState(getRuleLabScenario(mode, size, nextBays)));
    setHistory([]);
    setNotice(null);
    setShowAnalysis(false);
  }

  function exitVehicle(vehicleId: string) {
    const next = applyRuleLabExit(scenario, state, vehicleId);
    if (!next) {
      setNotice(
        scenario.mode !== "standard" &&
          state.waiting.length >= scenario.bayCount
          ? "待機枠が満杯です。戻して別の順序を試してください。"
          : `${labelOfVehicle(vehicleId)}は出口までの進路が塞がれています。`,
      );
      return;
    }
    setHistory((past) => [...past, state]);
    setState(next);
    setNotice(null);
  }

  function undo() {
    const previous = history[history.length - 1];
    if (!previous) return;
    setState(previous);
    setHistory((past) => past.slice(0, -1));
    setNotice(null);
  }

  function reset() {
    setState(createRuleLabState(scenario));
    setHistory([]);
    setNotice(null);
  }

  const queueNoun = scenario.mode === "passengers" ? "乗客の列" : "出庫指令";
  const exitedCount =
    scenario.board.vehicles.length - state.remainingVehicleIds.length;

  return (
    <main className="min-h-dvh bg-[#f5f6f4] px-1 py-3 text-[#243139] sm:px-8 sm:py-7">
      <div className="mx-auto max-w-[1050px]">
        <div className="mb-3">
          <p className="text-xs font-semibold tracking-wider text-slate-500">
            ISSUE #727 / 比較試作
          </p>
          <h1 className="mt-1 text-xl font-bold tracking-tight sm:text-3xl">
            パーキングジャムのルール比較
          </h1>
        </div>
        <div
          className="mb-3 grid grid-cols-2 gap-2 sm:flex sm:flex-wrap"
          role="group"
          aria-label="試すルール"
        >
          {modes.map(({ id, title }) => (
            <Button
              key={id}
              size="sm"
              variant={mode === id ? "default" : "outline"}
              onClick={() => changeMode(id)}
              aria-pressed={mode === id}
              className="h-11 whitespace-normal text-xs sm:h-9 sm:text-sm"
            >
              {title}
            </Button>
          ))}
        </div>
        {problems.length > 0 && (
          <label className="mb-3 flex items-center gap-2 text-sm font-medium text-slate-700">
            問題
            <select
              className="h-11 min-w-0 flex-1 rounded-md border border-slate-300 bg-white px-3 text-base sm:max-w-sm"
              value={problem?.id ?? ""}
              onChange={(event) => changeProblem(event.target.value || null)}
            >
              <option value="">共通盤面</option>
              {problems.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.title}
                </option>
              ))}
            </select>
          </label>
        )}
        {!problem && (
          <div
            className="mb-3 flex items-center gap-2"
            role="group"
            aria-label="比較盤面の規模"
          >
            <span className="mr-1 text-xs font-medium text-slate-600">
              盤面規模
            </span>
            <Button
              size="sm"
              variant={size === "small" ? "default" : "outline"}
              aria-pressed={size === "small"}
              onClick={() => changeSize("small")}
            >
              8台 / 7×7
            </Button>
            <Button
              size="sm"
              variant={size === "large" ? "default" : "outline"}
              aria-pressed={size === "large"}
              onClick={() => changeSize("large")}
            >
              12台 / 8×8
            </Button>
          </div>
        )}
        {!problem && (mode === "pairs" || mode === "dispatch") && (
          <div
            className="mb-3 flex items-center gap-2"
            role="group"
            aria-label="比較方式の待機枠数"
          >
            <span className="mr-1 text-xs font-medium text-slate-600">
              待機枠
            </span>
            {([2, 3, 4, 5] as const).map((count) => (
              <Button
                key={count}
                size="sm"
                variant={bayCount === count ? "default" : "outline"}
                aria-pressed={bayCount === count}
                onClick={() => changeBays(count)}
              >
                {count}枠
              </Button>
            ))}
          </div>
        )}
        <details className="mb-3 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm leading-relaxed text-slate-700">
          <summary className="cursor-pointer font-medium">ルール</summary>
          <p className="mt-2">{descriptions[mode]}</p>
          <p className="mt-2 text-xs text-slate-500">
            車は向きに沿って盤外へ出ます。濃い線の辺は壁で、そこからは出られません。ゲーム本体には影響しない検証画面です。
          </p>
        </details>
        <div
          ref={playAreaRef}
          className="grid scroll-mt-2 items-start gap-2 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.85fr)] lg:gap-6"
        >
          <section
            aria-label="出庫先とプレイ状況"
            className="space-y-2 rounded-xl bg-white p-2 shadow-sm lg:order-2 lg:p-4"
          >
            {(scenario.mode === "passengers" ||
              scenario.mode === "dispatch") && (
              <div>
                <h2 className="mb-1 flex items-baseline justify-between text-xs font-semibold text-slate-600">
                  <span>{queueNoun}（左から順）</span>
                  <span className="tabular-nums font-normal">
                    {state.nextPassengerIndex} / {scenario.queue.length}
                  </span>
                </h2>
                <div className="flex flex-wrap gap-1">
                  {scenario.queue.map((color, index) => {
                    const done = index < state.nextPassengerIndex;
                    const head = index === state.nextPassengerIndex;
                    return (
                      <span
                        key={QUEUE_SLOT_IDS[index]}
                        className={`flex size-6 items-center justify-center rounded border text-xs font-bold text-slate-900 ${done ? "border-slate-600/30 opacity-20" : head ? "border-slate-900 ring-2 ring-slate-900" : "border-slate-600/30"}`}
                        style={{ backgroundColor: ruleLabColorStyle(color) }}
                        aria-label={`${index + 1}${scenario.mode === "dispatch" ? "番目の指令" : "人目"}・色${color}${done ? "（処理済）" : head ? "（先頭）" : ""}`}
                      >
                        {color}
                      </span>
                    );
                  })}
                </div>
              </div>
            )}
            {scenario.mode !== "standard" && (
              <div>
                <h2 className="mb-1 flex items-baseline justify-between text-xs font-semibold text-slate-600">
                  <span>待機枠</span>
                  <span className="tabular-nums font-normal">
                    {state.waiting.length} / {scenario.bayCount} 枠使用中
                  </span>
                </h2>
                <div
                  className="grid gap-1.5"
                  style={{
                    gridTemplateColumns: `repeat(${scenario.bayCount}, minmax(0, 1fr))`,
                  }}
                >
                  {Array.from({ length: scenario.bayCount }, (_, index) => {
                    const waiting = state.waiting[index];
                    const vehicle =
                      waiting &&
                      scenario.board.vehicles.find(
                        (item) => item.id === waiting.vehicleId,
                      );
                    const color = waiting
                      ? vehicleColor(scenario, waiting.vehicleId)
                      : null;
                    return (
                      <div
                        key={BAY_SLOT_IDS[index]}
                        className="flex h-10 items-center justify-center rounded-lg border-2 border-dashed border-slate-300 bg-[#f1f3f3] text-center text-xs lg:h-16 lg:text-sm"
                      >
                        {waiting && color ? (
                          <span
                            className="flex size-full items-center justify-center gap-1 rounded-md border border-slate-600/30 font-bold"
                            style={{
                              backgroundColor: ruleLabColorStyle(color),
                            }}
                          >
                            {labelOfVehicle(waiting.vehicleId)}・{color}
                            {scenario.mode === "passengers" && (
                              <span className="tabular-nums font-normal">
                                {waiting.boarded}/{vehicle?.length ?? 0}人
                              </span>
                            )}
                          </span>
                        ) : (
                          <span className="text-slate-400">空き</span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
            <p
              aria-live="polite"
              className={`rounded-md px-2 py-1 text-sm font-semibold ${won ? "bg-emerald-50 text-emerald-800" : stuck ? "bg-rose-50 text-rose-800" : "text-slate-700"}`}
            >
              {won
                ? "クリア：すべて出発しました"
                : stuck
                  ? "詰み：もう出庫できません。原因は何手か前にあることがあります。戻して考え直してください。"
                  : `出庫 ${exitedCount} / ${scenario.board.vehicles.length}　今出せる車 ${legal.length} 台`}
            </p>
            {notice && (
              <p role="status" className="px-2 text-sm text-rose-700">
                {notice}
              </p>
            )}
            {result && (
              <div className="border-t border-slate-200 px-2 pt-2 text-xs">
                <p>
                  ここからクリアできる出庫順：
                  <strong className="tabular-nums">
                    {result.totalWinningSequences.toLocaleString()}
                  </strong>{" "}
                  通り
                </p>
                <p className="mt-1">
                  ○：この車からでも解ける / ×：この車を出すと詰む
                </p>
              </div>
            )}
          </section>
          <section
            aria-label="試作盤面"
            className="min-w-0 lg:order-1 lg:rounded-2xl lg:bg-white lg:p-5 lg:shadow-sm"
          >
            <div className="flex justify-center">
              <ParkingJamRuleLabBoard
                scenario={scenario}
                state={state}
                onExit={exitVehicle}
                showAnalysis={showAnalysis}
                outcomeByVehicle={outcomeByVehicle}
              />
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <Button
                variant="outline"
                disabled={history.length === 0}
                onClick={undo}
                className="h-11"
              >
                1手戻す
              </Button>
              <Button variant="outline" onClick={reset} className="h-11">
                最初から
              </Button>
              <label className="ml-auto flex h-11 cursor-pointer items-center gap-2 text-xs text-slate-600">
                <input
                  type="checkbox"
                  checked={showAnalysis}
                  onChange={(event) => setShowAnalysis(event.target.checked)}
                  className="size-5 accent-slate-800"
                />
                分岐の答えを表示
              </label>
            </div>
          </section>
        </div>
        <p className="mt-3 text-xs leading-relaxed text-slate-500">
          {problem
            ? "この問題はこの方式だけの盤面です。レベルや分類は機械的な基準による仮のもので、人間の体感で確かめたものではありません。"
            : "4方式は各盤面規模で同一の車両配置・色を使います。数値は試作の全探索結果で、人間の面白さの評価ではありません。"}
        </p>
      </div>
    </main>
  );
}
