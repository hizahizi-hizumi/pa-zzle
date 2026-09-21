export function WaterSortResultView() {
  const play = useWaterSortPlay();
  const score =
    Math.max(0, 1000 - play.moveCount * 25 - play.mistakeCount * 100);

  return <Result score={score} />;
}
