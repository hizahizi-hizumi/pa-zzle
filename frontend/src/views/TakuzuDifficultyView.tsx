import { DifficultySelectionHeading } from "@/components/DifficultySelectionHeading";
import { HomeBackLink } from "@/components/HomeBackLink";
import { takuzuDifficulties } from "@/games/takuzu/difficulty";
import { TakuzuHowToPlayDialog } from "@/games/takuzu/ui/TakuzuHowToPlayDialog";
import { TakuzuTutorial } from "@/games/takuzu/ui/TakuzuTutorial";
import { useNavigate } from "@/router";
import { TakuzuDifficultyOption } from "@/views/TakuzuDifficultyView/TakuzuDifficultyOption";

export function TakuzuDifficultyView() {
  const navigate = useNavigate();

  function startLevelOne(): void {
    navigate("/puzzles/takuzu/play/:difficulty", {
      params: { difficulty: "1" },
    });
  }

  return (
    <section className="space-y-6 sm:space-y-8">
      <div className="space-y-2">
        <HomeBackLink />
        <DifficultySelectionHeading
          title="バイナリパズル"
          renderHowToPlayDialog={({ open, onClose }) => (
            <TakuzuHowToPlayDialog open={open} onClose={onClose} />
          )}
          renderTutorial={({ open, onClose }) => (
            <TakuzuTutorial
              open={open}
              onStartPlay={startLevelOne}
              onClose={onClose}
            />
          )}
        />
      </div>

      <div className="grid gap-2 sm:gap-4 lg:grid-cols-5">
        {takuzuDifficulties.map((difficulty) => (
          <TakuzuDifficultyOption
            key={difficulty.id}
            difficulty={difficulty.id}
            label={difficulty.label}
          />
        ))}
      </div>
    </section>
  );
}
