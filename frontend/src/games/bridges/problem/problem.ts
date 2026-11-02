import {
  assertBridgesBoard,
  type BridgesBoard,
} from "@/games/bridges/puzzle/board";
import type { ProblemSeed } from "@/games/problem-seed";

/**
 * 1問を遊ぶためのデータ。盤面（島の位置と数字）だけを持ち、解の橋は持たない。
 * クリアは規則で判定し（`isBridgesSolved`）、問題は一意解なので解との照合は要らない。
 */
export type BridgesProblem = BridgesBoard;

/** 問題を作った盤面の大きさ。 */
export type BridgesGenerationConditions = {
  width: number;
  height: number;
};

/** 同じ問題を再現するための情報。記録から同じ問題を引き直すときに使う。 */
export type BridgesProblemIdentity = {
  generatorVersion: string;
  seed: ProblemSeed;
  conditions: BridgesGenerationConditions;
};

/** 問題と、それを再現するための情報。 */
export type BridgesIdentifiedProblem = {
  problem: BridgesProblem;
  identity: BridgesProblemIdentity;
};

/**
 * 問題の形を確かめる。盤面の形が正しいこと。
 * 一意解であることは探索を要するので、ここでは確かめない。
 */
export function assertBridgesProblem(problem: BridgesProblem): void {
  assertBridgesBoard(problem);
}
