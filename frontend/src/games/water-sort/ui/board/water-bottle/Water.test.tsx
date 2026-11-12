import { cleanup, render } from "@testing-library/react";
import { Water } from "@/games/water-sort/ui/board/water-bottle/Water";

afterEach(cleanup);

test("現行の色水は4単位を区別して描くこと", () => {
  const { container } = render(<Water contents={[0, 0, 1, 1]} />);
  expect(container.querySelectorAll(".water-sort-liquid-slot")).toHaveLength(4);
});

test("比較版の色水は連続した同色を一つの液量として描くこと", () => {
  const { container } = render(
    <Water contents={[0, 0, 1, 1]} variant="fluid" />,
  );
  const liquids = container.querySelectorAll<HTMLElement>(
    ".water-sort-liquid-run",
  );
  expect(liquids).toHaveLength(2);
  expect(liquids[0]?.style.height).toBe("calc(50% + 1px)");
  expect(liquids[1]?.dataset.surface).toBe("true");
});
