import { useState } from "react";
import { Button } from "@/components/ui/button";
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
    "車を出庫させると3つの乗り場の空き枠に入ります。左から順に並ぶ乗客は、色が合う車に1人ずつ乗り込みます。車体の長さ（2または3人分）だけ乗ると出発し、枠が空きます。すべての乗客と車を送り出せばクリア。",
  pairs:
    "車を出庫させると待機枠に入ります。同色2台がそろった瞬間に出発して枠が空きます。2枠ではペアを連続して完成させます。3枠では1台を一時待機させ、別のペアを先に完成させることもできます。",
  dispatch:
    "出庫指令は左から順に処理します。車を出庫させると待機枠に入り、先頭の指令と色が一致すれば即座に出発して枠が空きます。待機中の車も次の指令に一致すると出発します。指令は全部公開しています。",
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
  const scenario = getRuleLabScenario(mode, size, bayCount);
  const legal = legalRuleLabExits(scenario, state);
  const won = isRuleLabWon(scenario, state);
  const stuck = isRuleLabStuck(scenario, state);
  const result = showAnalysis ? analyzeRuleLab(scenario, state) : null;
  const outcomeByVehicle = new Map(
    result?.exits.map(({ vehicleId, canWin }) => [vehicleId, canWin]) ?? [],
  );

  function changeMode(nextMode: RuleLabMode) {
    setMode(nextMode);
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
          ? "待機枠が満杯です。1手戻して別の順序を試してください。"
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

  return (
    <main className="min-h-dvh bg-[#f5f6f4] px-4 py-7 text-[#243139] sm:px-8">
      <div className="mx-auto max-w-[1050px]">
        <div className="mb-5">
          <p className="text-xs font-semibold tracking-wider text-slate-500">
            ISSUE #727 / 比較試作
          </p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">
            パーキングジャムのルール比較
          </h1>
          <p className="mt-2 max-w-3xl text-sm leading-relaxed text-slate-600">
            ゲーム本体には影響しない検証画面です。車を選び、出庫順を考えてください。同一の車両配置で、出庫後の規則による選択の違いを比較できます。
          </p>
        </div>
        <div
          className="mb-5 flex flex-wrap gap-2"
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
            >
              {title}
            </Button>
          ))}
        </div>
        <div
          className="mb-5 flex items-center gap-2"
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
        {(mode === "pairs" || mode === "dispatch") && (
          <div
            className="mb-5 flex items-center gap-2"
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
        <div className="mb-5 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm leading-relaxed text-slate-700">
          {descriptions[mode]}
        </div>
        <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.85fr)]">
          <section
            aria-label="試作盤面"
            className="min-w-0 rounded-2xl bg-white p-3 shadow-sm sm:p-5"
          >
            <div className="mb-3 flex items-center justify-between gap-3 text-sm">
              <span className="font-semibold">
                駐車場 · {scenario.board.width}×{scenario.board.height} /{" "}
                {scenario.board.vehicles.length}台
              </span>
              <span className="tabular-nums text-slate-500">
                出庫{" "}
                {scenario.board.vehicles.length -
                  state.remainingVehicleIds.length}{" "}
                / {scenario.board.vehicles.length}
              </span>
            </div>
            <div className="flex justify-center">
              <ParkingJamRuleLabBoard
                scenario={scenario}
                state={state}
                onExit={exitVehicle}
                showAnalysis={showAnalysis}
                outcomeByVehicle={outcomeByVehicle}
              />
            </div>
            <p className="mt-3 text-xs text-slate-500">
              車は向きに沿って盤外へ出ます。出庫できない車を選んでも盤面は変わりません。
            </p>
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={history.length === 0}
                onClick={undo}
              >
                1手戻す
              </Button>
              <Button variant="outline" size="sm" onClick={reset}>
                最初から
              </Button>
              <label className="ml-auto flex cursor-pointer items-center gap-2 text-xs text-slate-600">
                <input
                  type="checkbox"
                  checked={showAnalysis}
                  onChange={(event) => setShowAnalysis(event.target.checked)}
                  className="size-4 accent-slate-800"
                />
                分岐の答えを表示
              </label>
            </div>
          </section>
          <section aria-label="出庫先と検証結果" className="space-y-4">
            {(scenario.mode === "passengers" ||
              scenario.mode === "dispatch") && (
              <div className="rounded-2xl bg-white p-4 shadow-sm">
                <h2 className="mb-3 font-semibold">
                  {scenario.mode === "passengers" ? "乗客の列" : "出庫指令"}{" "}
                  <span className="text-xs font-normal text-slate-500">
                    {scenario.mode === "passengers"
                      ? "左から順に乗車"
                      : "左から順に配車"}
                  </span>
                </h2>
                <div className="flex flex-wrap gap-1.5">
                  {scenario.queue.map((color, index) => (
                    <span
                      key={QUEUE_SLOT_IDS[index]}
                      className={`flex size-8 items-center justify-center rounded-md border border-slate-600/30 text-sm font-bold text-slate-900 ${index < state.nextPassengerIndex ? "opacity-20" : ""}`}
                      style={{ backgroundColor: ruleLabColorStyle(color) }}
                      aria-label={`${index + 1}${scenario.mode === "dispatch" ? "番目の指令" : "人目"}・色${color}${index < state.nextPassengerIndex ? "（処理済）" : ""}`}
                    >
                      {color}
                    </span>
                  ))}
                </div>
                <p className="mt-2 text-sm tabular-nums text-slate-500">
                  {scenario.mode === "passengers" ? "乗車済" : "指令完了"}{" "}
                  {state.nextPassengerIndex} / {scenario.queue.length}{" "}
                  {scenario.mode === "passengers" ? "人" : "件"}
                </p>
              </div>
            )}
            {scenario.mode !== "standard" && (
              <div className="rounded-2xl bg-white p-4 shadow-sm">
                <h2 className="mb-3 font-semibold">
                  出庫先の待機枠{" "}
                  <span className="text-xs font-normal text-slate-500">
                    {state.waiting.length}/{scenario.bayCount} 枠使用中
                  </span>
                </h2>
                <div
                  className="grid gap-2"
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
                        className="flex min-h-24 flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-300 bg-[#f1f3f3] px-1 text-center text-sm"
                      >
                        {waiting && color ? (
                          <>
                            <span
                              className="w-full rounded-lg border border-slate-600/30 px-2 py-2 font-bold"
                              style={{
                                backgroundColor: ruleLabColorStyle(color),
                              }}
                            >
                              {labelOfVehicle(waiting.vehicleId)} · {color}
                            </span>
                            {scenario.mode === "passengers" && (
                              <span className="mt-1 text-xs tabular-nums">
                                {waiting.boarded} / {vehicle?.length ?? 0} 人
                              </span>
                            )}
                          </>
                        ) : (
                          <span className="text-slate-400">空き</span>
                        )}
                      </div>
                    );
                  })}
                </div>
                <p className="mt-2 text-xs text-slate-500">
                  出発条件を満たした車は自動で消え、枠が解放されます。
                </p>
              </div>
            )}
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <h2 className="font-semibold">プレイ状況</h2>
              <p
                aria-live="polite"
                className={`mt-2 text-sm font-semibold ${won ? "text-emerald-700" : stuck ? "text-rose-700" : "text-slate-700"}`}
              >
                {won
                  ? "クリア：すべて出発しました"
                  : stuck
                    ? "詰み：これ以上出庫できません。1手戻して再検討してください。"
                    : `進行中：現在出庫できる車は ${legal.length} 台です。`}
              </p>
              {notice && (
                <p role="status" className="mt-2 text-sm text-rose-700">
                  {notice}
                </p>
              )}
              {result && (
                <div className="mt-3 border-t border-slate-200 pt-3 text-sm">
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
                  <p className="mt-1 text-slate-500">
                    分岐は試作ルールの全探索結果です。
                  </p>
                </div>
              )}
            </div>
            <p className="text-xs leading-relaxed text-slate-500">
              4方式は各盤面規模で同一の車両配置・色を使います。数値は試作の全探索結果で、人間の面白さの評価ではありません。
            </p>
          </section>
        </div>
      </div>
    </main>
  );
}
