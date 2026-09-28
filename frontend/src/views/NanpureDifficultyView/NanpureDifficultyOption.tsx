import { StartConditionOption } from "@/components/StartConditionOption";
import type { NanpureDifficulty } from "@/games/nanpure/difficulty";
import { NanpureDifficultyPreview } from "@/games/nanpure/ui/NanpureDifficultyPreview";
import { Link } from "@/router";

// 各レベルで初めて要る読み。図の読む範囲だけでは、候補を消す読みの違いまでは伝わらないため添える。
const difficultyDescriptions = {
  "1": "ブロックの中で置き場所を探す",
  "2": "行・列や1マスの候補まで読む",
  "3": "重なりで候補を絞る",
  "4": "数字の組を見つけて候補を絞る",
  "5": "離れたマスのつながりを読む",
} satisfies Record<NanpureDifficulty, string>;

type NanpureDifficultyOptionProps = {
  difficulty: NanpureDifficulty;
  label: string;
};

export function NanpureDifficultyOption({
  difficulty,
  label,
}: NanpureDifficultyOptionProps) {
  return (
    <Link
      to="/puzzles/nanpure/play/:difficulty"
      params={{ difficulty }}
      className="group block rounded-xl focus-visible:outline-none"
    >
      <StartConditionOption
        label={label}
        description={difficultyDescriptions[difficulty]}
        density="compact"
      >
        <NanpureDifficultyPreview difficulty={difficulty} />
      </StartConditionOption>
    </Link>
  );
}
