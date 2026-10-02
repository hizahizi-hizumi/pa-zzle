import type {
  PlayAttemptDefinition,
  PlayAttemptProgressId,
} from "@/records/play-attempt-definition";

type PlayAttemptProgressDisplay = {
  id: string;
  label: string;
  formatValue: (value: number) => string;
};

type PlayAttemptProgressPresentation = Omit<PlayAttemptProgressDisplay, "id">;

/** 記録画面で、離脱したプレイの進み具合をどう見せるか。 */
export type PlayAttemptDisplayDefinition = {
  definition: PlayAttemptDefinition;
  progress: readonly PlayAttemptProgressDisplay[];
};

type PlayAttemptDisplaySource<Definition extends PlayAttemptDefinition> = {
  definition: Definition;
  progress: Record<
    PlayAttemptProgressId<Definition>,
    PlayAttemptProgressPresentation
  >;
};

/**
 * 試行定義の全進み具合に表示を対応させた試行表示を作る。
 * 進み具合は試行定義の並び順で表示する。
 */
export function createPlayAttemptDisplay<
  Definition extends PlayAttemptDefinition,
>({
  definition,
  progress,
}: PlayAttemptDisplaySource<Definition>): PlayAttemptDisplayDefinition {
  return {
    definition,
    progress: definition.progress.map(
      ({ id }: { id: PlayAttemptProgressId<Definition> }) => ({
        id,
        ...progress[id],
      }),
    ),
  };
}
