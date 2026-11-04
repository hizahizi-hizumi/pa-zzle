import { matchesPathPattern } from "./path-pattern";

describe("matchesPathPattern", () => {
  const cases = [
    ["docs/adr/**", "docs/adr/ADR-0001-a.md", true],
    ["docs/adr/**", "docs/adr/sub/a.md", true],
    ["docs/adr/**", "docs/adrx/a.md", false],
    [
      "frontend/src/**/ui/**",
      "frontend/src/games/nanpure/ui/board/Board.tsx",
      true,
    ],
    ["frontend/src/**/ui/**", "frontend/src/ui/Button.tsx", true],
    ["frontend/src/**/ui/**", "frontend/src/games/nanpure/build/x.ts", false],
    [
      "frontend/src/games/*/play/**",
      "frontend/src/games/nanpure/play/a.ts",
      true,
    ],
    ["frontend/src/games/*/play/**", "frontend/src/games/a/b/play/a.ts", false],
    ["**/*.test.ts", "score.test.ts", true],
    ["**/*.test.ts", "frontend/src/games/score.test.ts", true],
    ["**/*.test.ts", "frontend/src/games/score.test.tsx", false],
    ["frontend/*.d.ts", "frontend/vite-env.d.ts", true],
    ["frontend/*.d.ts", "frontend/src/vite-env.d.ts", false],
    ["docs/パズル/難易度*.md", "docs/パズル/難易度提供.md", true],
    ["AGENTS.md", "frontend/AGENTS.md", false],
    ["frontend/(x).ts", "frontend/(x).ts", true],
  ] as const;

  test.each(cases)(
    "%s が %s に一致するかを返すこと",
    (pattern, filePath, expected) => {
      const matched = matchesPathPattern(filePath, pattern);

      expect(matched).toBe(expected);
    },
  );
});
