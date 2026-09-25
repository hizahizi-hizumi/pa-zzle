type Difficulty = "easy" | "normal" | "hard";

type DifficultyPickerProps = {
  difficulties: readonly Difficulty[];
  selected: Difficulty;
  onButtonClick: (difficulty: Difficulty) => void;
};

export function DifficultyPicker({
  difficulties,
  selected,
  onButtonClick,
}: DifficultyPickerProps) {
  return (
    <div role="radiogroup" aria-label="難易度">
      {difficulties.map((difficulty) => (
        <button
          key={difficulty}
          type="button"
          aria-pressed={difficulty === selected}
          onClick={() => onButtonClick(difficulty)}
        >
          {difficulty}
        </button>
      ))}
    </div>
  );
}
