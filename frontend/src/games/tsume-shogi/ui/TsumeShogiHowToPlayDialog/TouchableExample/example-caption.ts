import type { HowToPlayShownMarks } from "@/components/HowToPlayMarkLegend";
import type { HowToPlayVerdictLabels } from "@/components/HowToPlayVerdict";
import {
  getTsumeShogiSessionRemainingPlies,
  isTsumeShogiSessionOnWrongLine,
} from "@/games/tsume-shogi/session/session";
import { tsumeShogiHandPieceNames } from "@/games/tsume-shogi/ui/piece-label";
import {
  canPlayTsumeShogiExampleMove,
  findTsumeShogiExampleRejectionReason,
  listTsumeShogiCandidateMarks,
  type TsumeShogiExampleBoard,
  type TsumeShogiExampleRejectionReason,
} from "@/games/tsume-shogi/ui/TsumeShogiHowToPlayDialog/example-board";
import type {
  TsumeShogiExampleCaption,
  TsumeShogiHowToPlayExample,
} from "@/games/tsume-shogi/ui/TsumeShogiHowToPlayDialog/figure-boards";

/**
 * 判定の下に添えるわけ。
 * - `ruleReason`: 例が教えるルールそのもののわけ（二歩・打歩詰・行き所の無い駒）。盤面から読み取りにくいので押す前から添える。
 * - `reason`: 例が教えるルールとは別のルールで指せなかったわけ。
 */
export type TsumeShogiExampleCaptionReason = {
  reason: string | null;
  ruleReason: string | null;
};

/**
 * 例の下に添える1行。
 * - `legend`: 盤面の札の ✓ / ✕ の意味。盤面に出ている札の記号だけを並べる。
 * - `verdict`: 試した手か、手がかりで示す手の判定。`labels` は、同じ場所に出しうる ✓ と ✕ の言葉の組で、
 *   共通の判定の部品がいちばん長い言葉の幅で場所を取るのに使う。
 * - `text`: その例で起きること。
 */
export type TsumeShogiExampleCaptionLine =
  | {
      type: "legend";
      labels: HowToPlayVerdictLabels;
      shownMarks: HowToPlayShownMarks;
    }
  | ({
      type: "verdict";
      allowed: boolean;
      labels: HowToPlayVerdictLabels;
    } & TsumeShogiExampleCaptionReason)
  | { type: "text"; text: string };

const noReason: TsumeShogiExampleCaptionReason = {
  reason: null,
  ruleReason: null,
};

/** 指せなかったわけの言葉。例の盤面の下に収まる短い言葉にする。本番とチュートリアルの「王手にならない手」にそろえる。 */
const rejectionReasonLabels = {
  "not-check": "王手にならない",
  "double-pawn": "同じ列に歩がある",
  "pawn-drop-mate": "打つと詰む",
  "dead-piece": "行き所が無い",
  unreachable: "動けない升",
} as const satisfies Record<TsumeShogiExampleRejectionReason, string>;

/** 札の凡例の言葉。札は、その手を指せるか（`check`）と、指して詰むか（`mate`）。 */
const candidateLabels = {
  check: { allowed: "指せる", disallowed: "指せない" },
  mate: { allowed: "詰む", disallowed: "詰まない" },
} as const;

/** 持駒を打つ手は「打つ」、盤上の駒の手は「指す」と言う。試す前と、着手させなかった後の言葉。 */
const playableLabels = {
  drop: { allowed: "打てる", disallowed: "打てない" },
  board: { allowed: "指せる", disallowed: "指せない" },
} as const satisfies Record<"drop" | "board", HowToPlayVerdictLabels>;

/**
 * 指した後の言葉。指した後の盤面で同じ手が指せるとは限らないので、試した手の結果として言う。
 * ✕ の言葉は試す前と同じにし、言葉の組の幅を試す前とそろえる。
 */
const playedLabels = {
  drop: { allowed: "打てた", disallowed: "打てない" },
  board: { allowed: "指せた", disallowed: "指せない" },
} as const satisfies Record<"drop" | "board", HowToPlayVerdictLabels>;

/** 詰む札の例で、指した後の言葉。 */
const matedLabels: HowToPlayVerdictLabels = {
  allowed: "詰んだ",
  disallowed: "詰まなかった",
};

/**
 * 指せなかったわけ。王手だけを指せるルールの例は、王手にならないことを盤面の札で読ませるので、そのわけは添えない。
 * 打てない手を教える例（二歩・打歩詰・行き所の無い駒）は、教えるルールそのもののわけを添える。ほかのわけは別のルールのわけとして添える。
 */
function describeReason(
  reason: TsumeShogiExampleRejectionReason,
  caption: TsumeShogiExampleCaption,
): TsumeShogiExampleCaptionReason {
  if (
    caption.kind === "candidates" &&
    caption.judge === "check" &&
    reason === "not-check"
  ) {
    return noReason;
  }
  const text = rejectionReasonLabels[reason];
  return caption.kind === "drop" && caption.rule === reason
    ? { reason: null, ruleReason: text }
    : { reason: text, ruleReason: null };
}

/** 着手させなかった手の判定。試した手は、着手させなかった直前の局面（盤面は変わらない）で、わけを求める。 */
function describeRejection(
  board: TsumeShogiExampleBoard,
  caption: TsumeShogiExampleCaption,
): TsumeShogiExampleCaptionLine | null {
  const { attempt, session } = board;
  if (attempt?.result !== "rejected" || session.rejection === null) {
    return null;
  }
  return {
    type: "verdict",
    allowed: false,
    labels: playableLabels[attempt.move.kind],
    ...describeReason(
      findTsumeShogiExampleRejectionReason(session.puzzleState, attempt.move),
      caption,
    ),
  };
}

/**
 * 例の下の1行。どれも今の盤面と、最後に試した手から求め直す。
 * 盤面に何も添えない姿（操作の例と、詰まない筋で手数が尽きたあとなど）は `null` にし、行の高さだけを取る。
 */
export function describeTsumeShogiExampleCaption(
  board: TsumeShogiExampleBoard,
  example: TsumeShogiHowToPlayExample,
): TsumeShogiExampleCaptionLine | null {
  const { caption } = example;
  if (caption.kind === "none") {
    return null;
  }
  const rejection = describeRejection(board, caption);
  if (rejection !== null) {
    return rejection;
  }
  const { session, attempt } = board;
  const played = attempt?.result === "played" ? attempt.move : null;
  switch (caption.kind) {
    case "candidates": {
      const marks = listTsumeShogiCandidateMarks(
        board,
        caption.judge,
        example.crop,
      );
      const labels = candidateLabels[caption.judge];
      if (marks.length > 0) {
        return {
          type: "legend",
          labels,
          shownMarks: {
            allowed: marks.some(({ allowed }) => allowed),
            disallowed: marks.some(({ allowed }) => !allowed),
          },
        };
      }
      if (played === null) {
        return null;
      }
      if (caption.judge === "check") {
        return {
          type: "verdict",
          allowed: true,
          labels: playedLabels[played.kind],
          ...noReason,
        };
      }
      return {
        type: "verdict",
        allowed: session.status === "cleared",
        labels: matedLabels,
        ...noReason,
      };
    }
    case "remaining": {
      if (session.status === "cleared") {
        return { type: "text", text: `${session.problem.plies}手で詰んだ` };
      }
      if (isTsumeShogiSessionOnWrongLine(session)) {
        return null;
      }
      return {
        type: "text",
        text: `あと${getTsumeShogiSessionRemainingPlies(session)}手`,
      };
    }
    case "interposition": {
      const lastTurn = session.turns.at(-1);
      const reply = session.defenderReplyPending
        ? null
        : (lastTurn?.defenderMove ?? null);
      return reply?.kind === "drop"
        ? {
            type: "text",
            text: `${tsumeShogiHandPieceNames[reply.pieceType]}を間に打って防いだ`,
          }
        : { type: "text", text: "間に打って防ぐ" };
    }
    case "drop": {
      if (played !== null) {
        return {
          type: "verdict",
          allowed: true,
          labels: playedLabels[played.kind],
          ...noReason,
        };
      }
      const [move] = example.shownAttacks;
      if (move === undefined) {
        return null;
      }
      const position = session.puzzleState;
      const allowed = canPlayTsumeShogiExampleMove(position, move);
      return {
        type: "verdict",
        allowed,
        labels: playableLabels[move.kind],
        ...(allowed
          ? noReason
          : describeReason(
              findTsumeShogiExampleRejectionReason(position, move),
              caption,
            )),
      };
    }
    case "forced-promotion":
      return {
        type: "text",
        text: played === null ? "成って指す" : "成って指した",
      };
  }
}

/** 言葉の層で、同じ層に入れる行の名前。判定は言葉の組ごとに1つの層にし、✓ と ✕ は判定の部品が中で重ねる。 */
export function getTsumeShogiExampleCaptionLineId(
  line: TsumeShogiExampleCaptionLine,
): string {
  switch (line.type) {
    case "legend":
      return "legend";
    case "verdict":
      return `verdict:${line.labels.allowed}:${line.labels.disallowed}`;
    case "text":
      return `text:${line.text}`;
  }
}

function toVerdictLine(
  labels: HowToPlayVerdictLabels,
): TsumeShogiExampleCaptionLine {
  return { type: "verdict", allowed: true, labels, ...noReason };
}

/**
 * 例の下に出しうる行。どの行に替えても周りを動かさないよう、言葉の層に重ねて、いちばん大きい行の場所を取るのに使う。
 * 着手させなかった手と指した手の判定は、どの例でも出しうる。
 */
export function listTsumeShogiExampleCaptionLines(
  example: TsumeShogiHowToPlayExample,
): TsumeShogiExampleCaptionLine[] {
  const { caption } = example;
  const verdicts = [
    playableLabels.drop,
    playableLabels.board,
    playedLabels.drop,
    playedLabels.board,
  ].map(toVerdictLine);
  switch (caption.kind) {
    case "none":
      return [];
    case "candidates":
      return [
        {
          type: "legend",
          labels: candidateLabels[caption.judge],
          shownMarks: { allowed: true, disallowed: true },
        },
        ...(caption.judge === "mate" ? [toVerdictLine(matedLabels)] : []),
        ...verdicts,
      ];
    case "remaining":
      return [
        { type: "text", text: `あと${example.problem.plies}手` },
        { type: "text", text: `${example.problem.plies}手で詰んだ` },
        ...verdicts,
      ];
    case "interposition":
      return [
        { type: "text", text: "間に打って防ぐ" },
        // 持駒の名前はどれも2文字までなので、2文字の名前でいちばん長い言葉の場所を取る。
        { type: "text", text: "飛車を間に打って防いだ" },
        ...verdicts,
      ];
    case "drop":
      return verdicts;
    case "forced-promotion":
      return [
        { type: "text", text: "成って指す" },
        { type: "text", text: "成って指した" },
        ...verdicts,
      ];
  }
}
