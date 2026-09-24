import type { ProviderUsage } from "../domain/model.ts";

/** 任意の選択肢から1つを選ばせる質問。keyが選択肢、値がその説明。 */
export type ChoiceQuestion = {
  instructions: string;
  criteria: Record<string, string>;
};

export type ChoiceAnswer = {
  choice: string;
  confidence: number;
  probabilities: Record<string, number>;
};

/** 同じstateを共有する質問の束。 */
export type ChoiceRequest = {
  state: unknown;
  questions: Record<string, ChoiceQuestion>;
};

export type ChoiceResponse = {
  model: string;
  answers: Record<string, ChoiceAnswer>;
  usage: ProviderUsage;
};

export interface ChoiceProvider {
  readonly kind: string;
  readonly model: string;
  ask(request: ChoiceRequest): Promise<ChoiceResponse>;
}
