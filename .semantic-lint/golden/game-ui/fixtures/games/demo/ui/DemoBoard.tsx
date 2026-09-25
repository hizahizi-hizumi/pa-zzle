import type { DemoSession } from "@/games/demo/session/session";

type DemoBoardProps = {
  session: DemoSession;
  onSessionChange: (session: DemoSession) => void;
};

export function DemoBoard({ session, onSessionChange }: DemoBoardProps) {
  function handleSelect(index: number) {
    const cells = session.cells.map((cell, cellIndex) =>
      cellIndex === index ? (cell + 1) % 3 : cell,
    );
    const cleared = cells.every((cell) => cell === 0);

    onSessionChange({
      ...session,
      cells,
      moveCount: session.moveCount + 1,
      status: cleared ? "cleared" : "playing",
    });
  }

  return (
    <div role="grid" aria-label="盤面">
      {session.cells.map((cell, index) => (
        <button
          key={index}
          type="button"
          aria-label={`${index + 1}番目、${cell}`}
          onClick={() => handleSelect(index)}
        >
          {cell}
        </button>
      ))}
    </div>
  );
}
