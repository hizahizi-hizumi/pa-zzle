import { useState } from "react";
import {
  ISSUE_690_LIVE_IDEAS,
  type Issue690LiveSelection,
} from "@/components/Issue690LiveTypes";
import { Button } from "@/components/ui/button";

export type Issue690CompareToolbarProps = {
  selection: Issue690LiveSelection;
  onChange: (next: Issue690LiveSelection) => void;
  onReplay: () => void;
  gameName: string;
};

export function Issue690CompareToolbar({
  selection,
  onChange,
  onReplay,
  gameName,
}: Issue690CompareToolbarProps) {
  const [expanded, setExpanded] = useState(false);

  return (
    <aside className="i690-toolbar" aria-label="結果演出の比較操作">
      <Button
        type="button"
        variant="ghost"
        size="sm"
        aria-expanded={expanded}
        aria-controls="i690-compare-controls"
        onClick={() => setExpanded((current) => !current)}
      >
        比較
      </Button>
      {expanded && (
        <div className="i690-toolbar-panel" id="i690-compare-controls">
          <label htmlFor="i690-live-selection">演出</label>
          <select
            id="i690-live-selection"
            value={selection}
            onChange={(event) => {
              onChange(event.target.value as Issue690LiveSelection);
              setExpanded(false);
            }}
          >
            <option value="original">現行画面</option>
            {ISSUE_690_LIVE_IDEAS.map((idea) => (
              <option key={idea.id} value={idea.id}>
                {idea.id} {idea.title}
              </option>
            ))}
          </select>
          <div className="i690-toolbar-panel-actions">
            <a
              className="i690-game-switch"
              href={`/puzzles/${gameName === "ウォーターソート" ? "nanpure" : "water-sort"}/result/issue690-comparison-sample`}
            >
              {gameName === "ウォーターソート"
                ? "ナンプレ"
                : "ウォーターソート"}
            </a>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                onReplay();
                setExpanded(false);
              }}
            >
              再生
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setExpanded(false)}
            >
              閉じる
            </Button>
          </div>
        </div>
      )}
    </aside>
  );
}
