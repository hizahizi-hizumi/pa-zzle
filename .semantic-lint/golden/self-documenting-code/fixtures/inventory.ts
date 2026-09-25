export type StockItem = {
  sku: string;
  quantity: number;
};

/*
 * 在庫管理の全体方針: 在庫は画面・API・バッチのすべてで同じ配列を共有し、
 * 更新は必ず新しい配列を返す。発注は夜間バッチがまとめて行い、画面では
 * 在庫不足の表示だけを行う。返品や棚卸しの扱いは運用手順書を参照し、
 * 手順が変わったらこのコメントも更新すること。
 */
export const DEFAULT_SHORTAGE_THRESHOLD = 3;

/**
 * 在庫を引き当てる。
 * @param items StockItemの配列
 * @param sku string型の商品コード
 * @returns StockItemの配列
 */
export function reserveStock(items: StockItem[], sku: string): StockItem[] {
  // 商品コードが一致する在庫を探す
  const target = items.find((item) => item.sku === sku);
  // 見つからなければそのまま返す
  if (!target) {
    return items;
  }

  // ===== 数量の更新 =====
  // 2024-05: 以前はここで在庫をDBから再取得していたが、呼び出し側へ移した
  return items.map((item) =>
    item === target ? { ...item, quantity: item.quantity - 1 } : item,
  );
}

/** 発注候補のSKU。在庫0のSKUは発注APIが受け付けないため含めない。 */
export function listShortSkus(
  items: StockItem[],
  threshold = DEFAULT_SHORTAGE_THRESHOLD,
): string[] {
  // 発注APIは同じSKUを重複して送るとリクエスト全体を拒否する。
  return [
    ...new Set(
      items
        .filter((item) => item.quantity > 0 && item.quantity < threshold)
        .map((item) => item.sku),
    ),
  ];
}
