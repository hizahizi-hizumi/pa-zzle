import type {
  ReflectionCue,
  ReflectionCueKind,
} from "@/games/reflection/ui/board/cue";
import { cn } from "@/lib/utils";

/** 合図を重ねる所。マスは格子いっぱい、外周ヒントとストックは押せる範囲いっぱいに重ねる。 */
type ReflectionCuePlace = "cell" | "clue" | "stock";

/** 光の合図は透明度だけで消し、動きを減らす設定でも見て分かるようにする。 */
const cueClassNames = {
  hint: "border-[3px] border-sky-600 border-dashed dark:border-sky-400",
  reason:
    "ring-2 ring-sky-500/70 ring-inset animate-in fade-in-0 duration-(--duration-normal) ease-(--ease-enter) motion-reduce:animate-none dark:ring-sky-300/70",
  fitted:
    "bg-sky-100/70 ring-2 ring-sky-500/50 ring-inset fill-mode-forwards animate-out fade-out-0 duration-900 ease-in dark:bg-sky-900/50 dark:ring-sky-300/50",
} as const satisfies Record<ReflectionCueKind, string>;

const placeClassNames = {
  cell: "inset-1 rounded-sm",
  clue: "-inset-0.5 rounded-md",
  stock: "inset-0.5 rounded-md",
} as const satisfies Record<ReflectionCuePlace, string>;

/**
 * 1か所に重ねる合図。中身を隠さないよう、押せる所の中身より先に描く。
 * 次に押す所の印は、付け直すたびに中を一瞬光らせ、受け付けなかった手にも印を光らせ直して応える。
 */
export function ReflectionCueMarks({
  cues,
  place,
}: {
  cues: readonly ReflectionCue[];
  place: ReflectionCuePlace;
}) {
  return cues.map((cue) => (
    <span
      key={`${cue.kind}:${cue.id}`}
      aria-hidden="true"
      data-cue={cue.kind}
      className={cn(
        "pointer-events-none absolute",
        placeClassNames[place],
        cueClassNames[cue.kind],
      )}
    >
      {cue.kind === "hint" && (
        <span className="absolute inset-0 bg-sky-200/80 fill-mode-forwards animate-out fade-out-0 duration-700 ease-in dark:bg-sky-800/70" />
      )}
    </span>
  ));
}
