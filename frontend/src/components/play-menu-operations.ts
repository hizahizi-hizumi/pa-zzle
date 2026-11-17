import { type LucideIcon, Play, RotateCcw, SkipBack } from "lucide-react";

import {
  PLAY_OPERATION_LABELS,
  type PlayOperation,
} from "@/games/play-vocabulary";

/** プレイ中の「…」メニューを開くボタンの名前。読み上げの名前で、遊び方ではこのボタンをこの名前で呼ぶ。 */
export const PLAY_MENU_TRIGGER_LABEL = "その他の操作";

/** プレイ中の「…」メニューでやり直す操作の項目の見せ方。 */
export type PlayMenuOperationItem = {
  label: string;
  icon: LucideIcon;
  /** 今のプレイを捨てる操作として、取り消しの色で示すか。 */
  destructive: boolean;
};

/**
 * プレイ中の「…」メニューでやり直す操作の項目。本番のメニューと遊び方のメニューの図が、同じ定義を使う。
 * 並びはメニューの上からの順。
 */
export const playMenuOperationItems = {
  restart: {
    label: PLAY_OPERATION_LABELS.restart,
    icon: SkipBack,
    destructive: true,
  },
  replay: {
    label: PLAY_OPERATION_LABELS.replay,
    icon: RotateCcw,
    destructive: true,
  },
  startNewProblem: {
    label: PLAY_OPERATION_LABELS.startNewProblem,
    icon: Play,
    destructive: false,
  },
} as const satisfies Partial<Record<PlayOperation, PlayMenuOperationItem>>;
