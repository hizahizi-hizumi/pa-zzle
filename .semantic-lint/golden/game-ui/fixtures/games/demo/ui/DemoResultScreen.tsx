import type { DemoPlayResult } from "@/games/demo/session/session";

type DemoResultScreenProps = {
  result: DemoPlayResult;
  onReplay: () => void;
};

export function DemoResultScreen({ result, onReplay }: DemoResultScreenProps) {
  const praise =
    result.score.total === 100
      ? "パーフェクト！"
      : result.score.total >= 80
        ? "すばらしい！"
        : "クリア";

  return (
    <section>
      <h2>{praise}</h2>
      <p>{result.score.total}点</p>
      <button type="button" onClick={onReplay}>
        もう一度
      </button>
    </section>
  );
}
