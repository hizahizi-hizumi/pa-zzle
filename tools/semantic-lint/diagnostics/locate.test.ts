import { describe, expect, test } from "bun:test";

import type { PartKind } from "../domain/model.ts";
import { locateViolation } from "./locate.ts";

const subject = { startLine: 1, endLine: 20 };

function part(kind: PartKind, startLine: number, endLine: number, probability: number) {
  return { kind, range: { startLine, endLine }, probability };
}

describe("locateViolation", () => {
  test("threshold以上の文をそれぞれ別の指摘にする", () => {
    expect(
      locateViolation(subject, [
        part("statement", 2, 2, 0.9),
        part("statement", 3, 3, 0.7),
        part("statement", 4, 4, 0.1),
      ]).map((located) => located.range),
    ).toEqual([
      { startLine: 2, endLine: 2 },
      { startLine: 3, endLine: 3 },
    ]);
  });

  test("連続して選ばれた子unitを1つの指摘に結合する", () => {
    expect(
      locateViolation(subject, [
        part("unit", 2, 5, 0.9),
        part("unit", 6, 9, 0.8),
        part("unit", 10, 12, 0.2),
        part("unit", 13, 15, 0.6),
      ]),
    ).toEqual([
      { range: { startLine: 2, endLine: 9 }, probability: 0.9 },
      { range: { startLine: 13, endLine: 15 }, probability: 0.6 },
    ]);
  });

  test("どのpartも選ばれなければunit全体を指摘する", () => {
    expect(
      locateViolation(subject, [part("statement", 2, 2, 0.2)]),
    ).toEqual([{ range: subject }]);
    expect(locateViolation(subject, undefined)).toEqual([{ range: subject }]);
  });
});
