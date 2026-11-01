import { HowToPlayDialog } from "@/components/HowToPlayDialog";
import { HowToPlayTransition } from "@/components/HowToPlayTransition";
import { HowToPlayFigure } from "@/games/nonogram/ui/NonogramHowToPlayDialog/HowToPlayFigure";

type NonogramHowToPlayDialogProps = {
  open: boolean;
  onClose: () => void;
};

/** ルールと操作を、盤面と同じ見え方の小さな図と短い一文で示す。 */
export function NonogramHowToPlayDialog({
  open,
  onClose,
}: NonogramHowToPlayDialogProps) {
  return (
    <HowToPlayDialog
      open={open}
      description="数字を手がかりにマスを塗り、隠れた図柄を完成させる。"
      onClose={onClose}
    >
      <li className="space-y-2">
        <p>
          数字は、その行・列で続けて塗るマスの数。並びの順に塗り、塊の間は1マス以上空ける。
        </p>
        <HowToPlayFigure rows={["###.#."]} rowClues={[[3, 1]]} />
      </li>
      <li className="space-y-2">
        <p>塗りが数字とちょうど合った行・列は、数字が薄くなる。</p>
        <HowToPlayFigure
          rows={["###.#.", "##...."]}
          rowClues={[[3, 1], [3]]}
          matchedRows={[true, false]}
        />
      </li>
      <li className="space-y-2">
        <p>× は塗らないと決めたマスの印。</p>
        <HowToPlayFigure rows={["###x#x"]} rowClues={[[3, 1]]} />
      </li>
      <li className="space-y-2">
        <p>
          下のボタンで塗りと ×
          を切り替え、マスを押して入れる。同じ印のマスを押すと消える。右クリックは、切り替えによらず
          × を入れる・消す。
        </p>
        <HowToPlayTransition>
          <HowToPlayFigure rows={["."]} />
          <HowToPlayFigure rows={["#"]} />
          <HowToPlayFigure rows={["."]} />
        </HowToPlayTransition>
      </li>
      <li className="space-y-2">
        <p>なぞると、同じ行・列のマスにまとめて入れる。</p>
        <HowToPlayTransition>
          <HowToPlayFigure
            rows={[".", ".", ".", "."]}
            trace={{ fromCellIndex: 0, toCellIndex: 2 }}
          />
          <HowToPlayFigure rows={["#", "#", "#", "."]} />
        </HowToPlayTransition>
      </li>
      <li className="space-y-2">
        <p>
          入れるか消すかは、なぞり始めのマスで決まる。同じ印のマスから始めると、離すまで消すだけになる。
        </p>
        <HowToPlayTransition>
          <HowToPlayFigure
            rows={["#", "#", ".", "#"]}
            trace={{ fromCellIndex: 0, toCellIndex: 3 }}
          />
          <HowToPlayFigure rows={[".", ".", ".", "."]} />
        </HowToPlayTransition>
      </li>
      <li className="space-y-2">
        <p>すべての数字が薄くなるとクリア。× や空きが残っていてもよい。</p>
        <HowToPlayFigure
          rows={["##x", "x##", "#.#"]}
          rowClues={[[2], [2], [1, 1]]}
          columnClues={[[1, 1], [2], [2]]}
          matchedRows={[true, true, true]}
          matchedColumns={[true, true, true]}
        />
      </li>
    </HowToPlayDialog>
  );
}
