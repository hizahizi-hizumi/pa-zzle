import { ChevronDown } from "lucide-react";
import { matchPath, useLocation } from "react-router";

import {
  playMusicAuditionCandidates,
  selectPlayMusicAuditionCandidate,
  usePlayMusicAuditionCandidate,
} from "@/components/play-music-audition";

type Band = "regular" | "compact";

/**
 * 重ねるブランドの帯ごとの置き方。
 * - `regular`: ページの頭の帯に置き、ページと一緒にスクロールする。
 * - `compact`: プレイ画面と結果画面は画面全体を覆って低い帯を持つので、その帯に置き、盤面に掛からないよう帯の高さに収める。
 */
const bandClassNames = {
  regular: "absolute top-[calc(0.625rem+env(safe-area-inset-top))]",
  compact: "fixed top-[env(safe-area-inset-top)]",
} satisfies Record<Band, string>;

const FULL_SCREEN_PATH_PATTERNS = [
  "/puzzles/:game/play/:difficulty",
  "/puzzles/:game/result/:recordId",
];

/**
 * プレイ中の曲の候補を試聴するために、流す候補をその場で切り替える小さな切り替え。画面の左上、ブランドの帯の上に置く。
 * 曲を決めたら消す。
 */
export function PlayMusicAuditionSwitcher() {
  const { pathname } = useLocation();
  const candidate = usePlayMusicAuditionCandidate();
  const band: Band = FULL_SCREEN_PATH_PATTERNS.some((pattern) =>
    matchPath(pattern, pathname),
  )
    ? "compact"
    : "regular";

  function selectById(value: string) {
    const selected = playMusicAuditionCandidates.find(({ id }) => id === value);
    if (selected) {
      selectPlayMusicAuditionCandidate(selected);
    }
  }

  return (
    <label
      className={`${bandClassNames[band]} left-[max(0.5rem,env(safe-area-inset-left))] z-(--layer-overlay) flex h-7 items-center rounded-full border border-brand-inverse-foreground/30 bg-brand-inverse text-brand-inverse-foreground focus-within:ring-2 focus-within:ring-ring`}
    >
      <select
        aria-label="プレイ中の曲の候補（試聴用）"
        title="プレイ中の曲の候補（試聴用）"
        value={candidate.id}
        onChange={(event) => selectById(event.target.value)}
        className="h-full max-w-[calc(50vw-4.25rem)] cursor-pointer appearance-none truncate rounded-full bg-transparent pr-6 pl-2.5 text-[0.6875rem] focus-visible:outline-none"
      >
        {playMusicAuditionCandidates.map(({ id, name }) => (
          <option key={id} value={id} className="text-foreground">
            {id} {name}
          </option>
        ))}
      </select>
      <ChevronDown
        className="pointer-events-none absolute right-2 size-3.5"
        aria-hidden="true"
      />
    </label>
  );
}
