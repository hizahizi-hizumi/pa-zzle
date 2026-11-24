import { createContext, useContext, useEffect, useId, useRef } from "react";

/**
 * 遊び方の触れる例どうしで、選んだマスを1つにする仕組み。本番の画面で選べるマスは1つなので、
 * ある例でマスを選んだら、ほかの例の選びを外す（面の中の盤面どうしと同じふるまいを、例どうしにもそろえる）。
 */
type MagicSquareExampleSelections = {
  /** 例の選びを外す関数を登録する。返す関数で登録を消す。 */
  register: (exampleId: string, deselect: () => void) => () => void;
  /** その例でマスを選んだとき、ほかの例の選びを外す。 */
  select: (exampleId: string) => void;
};

export function createMagicSquareExampleSelections(): MagicSquareExampleSelections {
  const deselects = new Map<string, () => void>();
  return {
    register(exampleId, deselect) {
      deselects.set(exampleId, deselect);
      return () => {
        deselects.delete(exampleId);
      };
    },
    select(exampleId) {
      for (const [other, deselect] of deselects) {
        if (other !== exampleId) {
          deselect();
        }
      }
    },
  };
}

export const MagicSquareExampleSelectionsContext =
  createContext<MagicSquareExampleSelections | null>(null);

/**
 * この例でマスを選んだことをほかの例に知らせる関数を返す。ほかの例でマスを選んだら `onDeselect` を呼ぶ。
 * 例を並べる遊び方の外（`MagicSquareExampleSelectionsContext` の無い所）では何もしない。
 */
export function useMagicSquareExampleSelection(
  onDeselect: () => void,
): () => void {
  const selections = useContext(MagicSquareExampleSelectionsContext);
  const exampleId = useId();
  const deselectRef = useRef(onDeselect);

  useEffect(() => {
    deselectRef.current = onDeselect;
  });

  useEffect(
    () => selections?.register(exampleId, () => deselectRef.current()),
    [selections, exampleId],
  );

  return () => selections?.select(exampleId);
}
