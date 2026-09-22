describe("calculatePrice", () => {
  test("会員割引を適用すること", () => {
    const result = calculatePrice({ member: true, coupon: false });

    expect(result).toBe(90);
  });

  test("クーポン割引を適用すること", () => {
    const result = calculatePrice({ member: false, coupon: true });

    expect(result).toBe(80);
  });
});
