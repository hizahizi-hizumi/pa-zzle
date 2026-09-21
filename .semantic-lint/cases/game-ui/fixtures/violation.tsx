export function WaterSortBoard({ bottles, onMove }: Props) {
  function handlePour(from: number, to: number) {
    const source = bottles[from];
    const target = bottles[to];

    if (!source || !target || target.length >= 4) {
      return;
    }

    if (
      target.length > 0 &&
      target[target.length - 1] !== source[source.length - 1]
    ) {
      return;
    }

    onMove(from, to);
  }

  return <Board bottles={bottles} onPour={handlePour} />;
}
