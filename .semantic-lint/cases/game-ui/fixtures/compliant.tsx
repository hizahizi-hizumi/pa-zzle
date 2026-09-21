export function WaterSortBoard({ state, onPour }: Props) {
  return (
    <Board
      bottles={state.bottles}
      onPour={(from, to) => onPour({ from, to })}
    />
  );
}
