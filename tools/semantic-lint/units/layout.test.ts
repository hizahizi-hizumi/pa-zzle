import { describe, expect, test } from "bun:test";
import { resolve } from "node:path";

import type { PlannedFile, SourceDocument } from "../domain/model.ts";
import { planUnits } from "../planning/planner.ts";
import { testExtractor } from "../testing/fixtures.ts";
import {
  buildDecisionState,
  expandDecisionState,
  subjectClosure,
} from "./layout.ts";

const extractor = await testExtractor();
const MARKER = "/* {ref} */";

const source = `import { render } from "@testing-library/react";

describe("一覧", () => {
  beforeEach(() => {
    render(<List />);
  });

  test("項目を表示すること", () => {
    expect(screen.getByRole("list")).toBeVisible();
  });

  describe("空の場合", () => {
    test("案内を表示すること", () => {
      expect(screen.getByText("なし")).toBeVisible();
    });
  });
});

test("単独のtest", () => {});
`;

function plannedFile(
  document: SourceDocument,
  units: readonly string[],
): Pick<PlannedFile, "units"> & { file: SourceDocument } {
  return { file: document, units: planUnits(document, units, extractor) };
}

describe("buildDecisionState", () => {
  test("fileを元の並びで1回だけ載せ、unitを開始・終了の目印で囲む", () => {
    const { file, units } = plannedFile({ path: "a.test.tsx", source }, [
      "test",
      "test-group",
      "setup",
    ]);
    const { state } = buildDecisionState({
      file,
      marker: MARKER,
      units,
      subjectIds: units.map((unit) => unit.id),
    });
    const expanded = expandDecisionState(state, MARKER);

    expect(expanded.file).toBe(source);
    expect(Object.values(expanded.subjects)).toEqual(
      units.map((unit) => unit.source),
    );
    expect(state.file.source).toContain(`/* state.subjects.s0 begin */describe("一覧", () => {
  /* state.subjects.s1 begin */beforeEach(() => {`);
    expect(state.subjects.s0).toEqual({
      unit: "test-group",
      symbol: 'describe("一覧")',
    });
  });

  test("stateに載せないunitは省略の目印だけにする", () => {
    const { file, units } = plannedFile({ path: "a.test.tsx", source }, [
      "test",
      "setup",
    ]);
    const target = units.find((unit) => unit.symbol === 'test("単独のtest")');

    if (!target) {
      throw new Error("fixtureにtestがありません");
    }

    const { state } = buildDecisionState({
      file,
      marker: MARKER,
      units,
      subjectIds: subjectClosure(units, [target.id]),
    });

    expect(Object.values(state.subjects).map((subject) => subject.symbol))
      .toEqual(['test("単独のtest")']);
    expect(state.file.source).toContain("/* omitted */");
    expect(state.file.source).toContain('describe("空の場合", () => {');
  });

  test("指摘位置を宣言したunitは判定対象でなければ目印を付けずに本文を残す", () => {
    const withVariables = `const items = [1];

test("単独のtest", () => {
  const total = sum(items);
});

test("別のtest", () => {});
`;
    const stateFor = (units: readonly string[], symbols: readonly string[]) => {
      const planned = plannedFile(
        { path: "a.test.ts", source: withVariables },
        units,
      );
      const targets = planned.units
        .filter((unit) => symbols.includes(unit.symbol ?? ""))
        .map((unit) => unit.id);

      return buildDecisionState({
        file: planned.file,
        marker: MARKER,
        units: planned.units,
        subjectIds: subjectClosure(planned.units, targets),
      }).state;
    };
    const testOnly = stateFor(["test"], ['test("単独のtest")']);

    // 変数宣言・テスト名のunitが増えても、testだけを判定するstateは変わらない。
    expect(
      stateFor(["test", "variable", "test-title"], ['test("単独のtest")']),
    ).toEqual(testOnly);
    expect(testOnly.file.source).toContain("const items = [1];");
    expect(testOnly.file.source).toContain("const total = sum(items);");

    const variable = stateFor(["test", "variable"], ["total"]);

    expect(Object.values(variable.subjects)).toEqual([
      { unit: "test", symbol: 'test("単独のtest")' },
      { unit: "variable", symbol: "total" },
    ]);
    expect(variable.file.source).toContain("const items = [1];");
    expect(variable.file.source).toContain(
      "const /* state.subjects.s1 begin */total = sum(items)/* state.subjects.s1 end */;",
    );
  });

  test("sourceに目印と同じ文字列があっても取り違えずに戻せる", () => {
    const tricky = 'const note = "/* state.subjects.s0 */";\n\ntest("a", () => {});\n';
    const { file, units } = plannedFile({ path: "a.test.ts", source: tricky }, [
      "test",
    ]);
    const { state } = buildDecisionState({
      file,
      marker: MARKER,
      units,
      subjectIds: units.map((unit) => unit.id),
    });

    expect(Object.keys(state.subjects)).toEqual(["s1_0"]);
    expect(expandDecisionState(state, MARKER).file).toBe(tricky);
  });

  test("リポジトリの全testファイルで目印を付けても情報を失わない", async () => {
    const projectRoot = resolve(import.meta.dir, "../../..");
    const child = Bun.spawn(
      ["git", "ls-files", "*.test.ts", "*.test.tsx"],
      { cwd: projectRoot, stdout: "pipe" },
    );
    const paths = (await new Response(child.stdout).text())
      .split("\n")
      .filter(Boolean);

    for (const path of paths) {
      const document = {
        path,
        source: await Bun.file(resolve(projectRoot, path)).text(),
      };
      const { file, units } = plannedFile(document, [
        "file",
        "test",
        "test-group",
        "setup",
        "function",
      ]);
      const { state } = buildDecisionState({
        file,
        marker: MARKER,
        units,
        subjectIds: units.map((unit) => unit.id),
      });
      const expanded = expandDecisionState(state, MARKER);

      expect(expanded.file).toBe(document.source);
      expect(Object.values(expanded.subjects)).toEqual(
        units.map((unit) => unit.source),
      );
    }
  });
});

describe("buildDecisionState parts", () => {
  test("判定対象のpartを目印で囲み、子unitのpartはunitの目印の外側を囲む", () => {
    const { file, units } = plannedFile({ path: "a.test.tsx", source }, [
      "test",
      "test-group",
      "setup",
    ]);
    const group = units.find((unit) => unit.symbol === 'describe("一覧")');
    const setup = units.find((unit) => unit.unit === "setup");

    if (!group || !setup) {
      throw new Error("unitがありません。");
    }

    const { state, partKeys } = buildDecisionState({
      file,
      marker: MARKER,
      units,
      subjectIds: subjectClosure(units, [group.id, setup.id]),
      partUnitIds: [group.id, setup.id],
    });
    const refs = [...partKeys.values()].flat();

    expect(partKeys.get(group.id)).toEqual(["p0", "p1", "p2"]);
    expect(partKeys.get(setup.id)).toEqual(["p3"]);
    expect(state.file.source).toContain(
      "/* p0 *//* state.subjects.s1 begin */beforeEach(() => {\n    /* p3 */render(<List />);/* /p3 */\n  })/* state.subjects.s1 end *//* /p0 */;",
    );
    expect(expandDecisionState(state, MARKER, refs).file).toBe(
      source.replace('test("単独のtest", () => {})', "/* omitted */"),
    );
  });

  test("sourceにある目印と同じ名前を避ける", () => {
    const tricky = `test("a", () => {\n  /* p0 */ run();\n});\n`;
    const { file, units } = plannedFile({ path: "a.test.ts", source: tricky }, [
      "test",
    ]);
    const { state, partKeys } = buildDecisionState({
      file,
      marker: MARKER,
      units,
      subjectIds: units.map((unit) => unit.id),
      partUnitIds: units.map((unit) => unit.id),
    });

    expect([...partKeys.values()].flat()).toEqual(["p1_0"]);
    expect(
      expandDecisionState(state, MARKER, ["p1_0"]).file,
    ).toBe(tricky);
  });
});

describe("subjectClosure", () => {
  test("判定対象に祖先とカタログのcontextが指すunitを加える", () => {
    const { units } = plannedFile({ path: "a.test.tsx", source }, [
      "test",
      "test-group",
      "setup",
    ]);
    const nested = units.find((unit) => unit.symbol === 'test("案内を表示すること")');

    expect(
      subjectClosure(units, [nested?.id ?? ""]).map(
        (id) => units.find((unit) => unit.id === id)?.symbol,
      ),
    ).toEqual([
      'describe("一覧")',
      "beforeEach",
      'describe("空の場合")',
      'test("案内を表示すること")',
    ]);
  });

  test("判定対象の子孫は本文の一部として含める", () => {
    const { units } = plannedFile({ path: "a.test.tsx", source }, [
      "test",
      "test-group",
      "setup",
    ]);
    const outer = units.find((unit) => unit.symbol === 'describe("空の場合")');

    expect(
      subjectClosure(units, [outer?.id ?? ""]).map(
        (id) => units.find((unit) => unit.id === id)?.symbol,
      ),
    ).toEqual([
      'describe("一覧")',
      'describe("空の場合")',
      'test("案内を表示すること")',
    ]);
  });
});
