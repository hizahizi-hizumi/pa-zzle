import {
  createContext,
  type RefObject,
  useContext,
  useEffect,
  useRef,
} from "react";

type CancelSelection = () => void;

/** 選んでいる物のある触れる例の、選びを解く関数の集まり。遊び方の層が1つ持つ。 */
export type HowToPlayExampleSelections = {
  /** 選びを解く関数を加え、外す関数を返す。 */
  add: (cancel: RefObject<CancelSelection>) => () => void;
  /** 加えてあるすべての例の選びを解く。解いた例があれば `true` を返す。 */
  cancelAll: () => boolean;
};

export function createHowToPlayExampleSelections(): HowToPlayExampleSelections {
  const cancels = new Set<RefObject<CancelSelection>>();
  return {
    add(cancel) {
      cancels.add(cancel);
      return () => {
        cancels.delete(cancel);
      };
    },
    cancelAll() {
      if (cancels.size === 0) {
        return false;
      }
      for (const cancel of [...cancels]) {
        cancel.current();
      }
      return true;
    },
  };
}

export const HowToPlayExampleSelectionsContext =
  createContext<HowToPlayExampleSelections | null>(null);

/**
 * 触れる例が、物（駒・島・ボトルなど）を選んでいる間、遊び方の層に知らせる。層は Esc を受けると、層を閉じずに選びを解く。
 * `onCancelSelection` は、本番で選びを解く操作と同じ遷移で選ぶ前の姿に戻す。遊び方の層の外に置いた例では何もしない。
 */
export function useHowToPlayExampleSelection(
  selected: boolean,
  onCancelSelection: () => void,
): void {
  const selections = useContext(HowToPlayExampleSelectionsContext);
  const cancelRef = useRef(onCancelSelection);

  useEffect(() => {
    cancelRef.current = onCancelSelection;
  });

  useEffect(() => {
    if (!selected || selections === null) {
      return;
    }
    return selections.add(cancelRef);
  }, [selected, selections]);
}
