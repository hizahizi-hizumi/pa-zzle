export function WaterSortResultView() {
  const play = useWaterSortPlay();
  const result = evaluateWaterSortPlay(play.result);

  return <Result score={result.score} />;
}
