import { ChevronDown } from "lucide-react";

import {
  type BgmAuditionArrangement,
  type BgmAuditionCandidate,
  bgmAuditionArrangementLabels,
  bgmAuditionCandidates,
} from "@/components/BgmAuditionSwitcher/bgm-audition-candidates";

type BgmAuditionSwitcherProps = {
  candidate: BgmAuditionCandidate;
  onSelect: (candidate: BgmAuditionCandidate) => void;
  /**
   * 重ねるブランドの帯の高さ。プレイ画面と結果画面は画面全体を覆い、低い帯（`compact`）を持つ。
   * - `regular`: ページの頭の帯に置き、ページと一緒にスクロールする。
   * - `compact`: 画面を覆う画面の帯に置き、盤面に掛からないよう帯の高さに収める。
   */
  band: "regular" | "compact";
};

const bandClassNames = {
  regular: "absolute top-[calc(0.625rem+env(safe-area-inset-top))]",
  compact: "fixed top-[env(safe-area-inset-top)]",
} satisfies Record<BgmAuditionSwitcherProps["band"], string>;

const arrangements = Object.keys(
  bgmAuditionArrangementLabels,
) as BgmAuditionArrangement[];

/**
 * BGM の候補を試聴するために、流す候補をその場で切り替える小さな切り替え。画面の左上、ブランドの帯の上に置く。
 * 候補を決めたら消す。
 */
export function BgmAuditionSwitcher({
  candidate,
  onSelect,
  band,
}: BgmAuditionSwitcherProps) {
  function selectByNumber(value: string) {
    const selected = bgmAuditionCandidates.find(
      ({ number }) => String(number) === value,
    );
    if (selected) {
      onSelect(selected);
    }
  }

  return (
    <label
      className={`${bandClassNames[band]} left-[max(0.5rem,env(safe-area-inset-left))] z-(--layer-overlay) flex h-7 items-center rounded-full border border-brand-inverse-foreground/30 bg-brand-inverse text-brand-inverse-foreground focus-within:ring-2 focus-within:ring-ring`}
    >
      <select
        aria-label="BGM の候補（試聴用）"
        title="BGM の候補（試聴用）"
        value={candidate.number}
        onChange={(event) => selectByNumber(event.target.value)}
        className="h-full max-w-[calc(50vw-4.25rem)] cursor-pointer appearance-none truncate rounded-full bg-transparent pr-6 pl-2.5 text-[0.6875rem] focus-visible:outline-none"
      >
        {arrangements.map((arrangement) => (
          <optgroup
            key={arrangement}
            label={bgmAuditionArrangementLabels[arrangement]}
            className="text-foreground"
          >
            {bgmAuditionCandidates
              .filter((entry) => entry.arrangement === arrangement)
              .map(({ number, name }) => (
                <option key={number} value={number} className="text-foreground">
                  {number} {name}
                </option>
              ))}
          </optgroup>
        ))}
      </select>
      <ChevronDown
        className="pointer-events-none absolute right-2 size-3.5"
        aria-hidden="true"
      />
    </label>
  );
}
