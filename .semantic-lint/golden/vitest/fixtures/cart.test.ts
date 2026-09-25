import { beforeEach, describe, expect, test, vi } from "vitest";

import {
  addItem,
  applyCoupon,
  type Cart,
  createCart,
  parseCartArgs,
  totalPrice,
} from "./cart";

describe("cart", () => {
  const notify = vi.fn();
  const cart: Cart = createCart();

  test("商品を追加すると件数が増えること", () => {
    addItem(cart, { sku: "A-1", price: 100 }, notify);

    expect(cart.items).toHaveLength(1);
  });

  test("通知用のスパイが呼ばれること", () => {
    addItem(cart, { sku: "B-2", price: 200 }, notify);

    expect(notify).toHaveBeenCalledOnce();
  });
});

describe("合計金額", () => {
  let items: { sku: string; price: number }[];
  let expectedTotal: number;

  beforeEach(() => {
    items = [
      { sku: "A-1", price: 100 },
      { sku: "B-2", price: 250 },
    ];
    expectedTotal = 350;
  });

  test("正しく動くこと", () => {
    expect(totalPrice(items)).toBe(expectedTotal);
  });

  test.each([[0], [1]])("テスト %s", (discount) => {
    const total = totalPrice(items, discount);

    expect(total).toBeLessThanOrEqual(expectedTotal);
  });
});

describe("クーポンが期限切れ", () => {
  const expiredCoupon = { code: "SPRING-2024", expiresAt: 0 };

  test("クーポンを適用しないこと", () => {
    const result = applyCoupon(createCart(), expiredCoupon);

    expect(result.applied).toBe(false);
  });
});

describe("parseCartArgs", () => {
  const args = ["--dry-run"];

  test("試行実行オプションを受け付けること", () => {
    const options = parseCartArgs(args);

    expect(options.dryRun).toBe(true);
  });
});
