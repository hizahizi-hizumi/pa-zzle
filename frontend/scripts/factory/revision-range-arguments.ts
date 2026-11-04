import { parseArgs } from "node:util";

import type { RevisionRange } from "./git-changes";

type StringOptions = Record<string, { type: "string" }>;

/**
 * `--base <rev>` と `--head <rev>` を読む。`--head` を省くと作業ツリーと比べる。
 * extraOptions に挙げた文字列の引数も一緒に読む。
 */
export function parseRevisionRangeArguments<Options extends StringOptions>(
  args: readonly string[],
  extraOptions: Options,
): { range: RevisionRange; values: Partial<Record<keyof Options, string>> } {
  const { values } = parseArgs({
    args: [...args],
    options: {
      base: { type: "string" },
      head: { type: "string" },
      ...extraOptions,
    },
    strict: true,
  });
  const { base, head, ...extraValues } = values as Record<
    string,
    string | undefined
  >;
  if (base === undefined) {
    throw new Error("--base <rev> を指定する");
  }
  return {
    range: { base, head: head ?? null },
    values: extraValues as Partial<Record<keyof Options, string>>,
  };
}
