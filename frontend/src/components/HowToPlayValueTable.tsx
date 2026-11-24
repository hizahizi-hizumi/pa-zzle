import { HowToPlayPhrases } from "@/components/HowToPlayPhrases";

type HowToPlayValueTableProps = {
  /** 列の見出し。1つ目は行の見出しの列の名前にする。 */
  columns: readonly string[];
  /** 行ごとの値。1つ目は行の見出し（盤面の大きさなど）にし、列の見出しと同じ数だけ並べる。 */
  rows: readonly (readonly string[])[];
};

/**
 * 見比べる値の小さな表（盤面の大きさごとの数の範囲と合計など）。文の中に値を続けず、行ごとに同じ列で値を見比べられるようにする。
 * 列の見出しは補足の段で淡く、行の見出しは項目の名前と同じ太字の本文、値は本文にし、数字の幅をそろえる。
 * 列は同じ幅に分け、行の間は細い線で分ける。
 */
export function HowToPlayValueTable({
  columns,
  rows,
}: HowToPlayValueTableProps) {
  return (
    <table className="w-full table-fixed border-collapse text-left">
      <thead>
        <tr className="border-b">
          {columns.map((column) => (
            <th
              key={column}
              scope="col"
              className="pb-2 font-normal text-muted-foreground text-supporting"
            >
              <HowToPlayPhrases text={column} />
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.join("/")} className="border-b last:border-b-0">
            {row.map((value, index) =>
              index === 0 ? (
                <th
                  key={columns[index]}
                  scope="row"
                  className="py-2 font-semibold text-body tabular-nums"
                >
                  {value}
                </th>
              ) : (
                <td
                  key={columns[index]}
                  className="py-2 text-body tabular-nums"
                >
                  {value}
                </td>
              ),
            )}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
