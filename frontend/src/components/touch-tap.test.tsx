import { cleanup, fireEvent, render, screen } from "@testing-library/react";

import { useTouchTap } from "@/components/touch-tap";

type TapTargetProps = {
  disabled?: boolean;
  onTap: () => void;
};

function TapTarget({ disabled = false, onTap }: TapTargetProps) {
  const { getTapHandlers } = useTouchTap();

  return (
    <button type="button" disabled={disabled} {...getTapHandlers(onTap)}>
      押す
    </button>
  );
}

const touch = { pointerType: "touch", isPrimary: true } as const;

afterEach(() => {
  cleanup();
});

describe("useTouchTap", () => {
  const onTap = vi.fn();

  beforeEach(() => {
    onTap.mockReset();
    render(<TapTarget onTap={onTap} />);
  });

  test("タッチは指を離したときに受け、続けて届く click を捨てること", () => {
    const button = screen.getByText("押す");
    fireEvent.pointerUp(button, touch);
    fireEvent.click(button, { detail: 1 });

    expect(onTap).toHaveBeenCalledTimes(1);
  });

  test("マウスは click で受けること", () => {
    const button = screen.getByText("押す");
    fireEvent.pointerUp(button, { pointerType: "mouse", isPrimary: true });
    fireEvent.click(button, { detail: 1 });

    expect(onTap).toHaveBeenCalledTimes(1);
  });

  test("タッチの直後でもキーボードの click は受けること", () => {
    const button = screen.getByText("押す");
    fireEvent.pointerUp(button, touch);
    fireEvent.click(button, { detail: 0 });

    expect(onTap).toHaveBeenCalledTimes(2);
  });

  test("押したまま外へずらして離したタッチは受けないこと", () => {
    const button = screen.getByText("押す");
    fireEvent.pointerUp(button, { ...touch, clientX: 10, clientY: 10 });

    expect(onTap).not.toHaveBeenCalled();
  });
});

describe("useTouchTap の受け口を押せないボタンに付けた場合", () => {
  const onTap = vi.fn();

  beforeEach(() => {
    onTap.mockReset();
    render(<TapTarget disabled onTap={onTap} />);
  });

  test("タッチで離しても受けないこと", () => {
    fireEvent.pointerUp(screen.getByText("押す"), touch);

    expect(onTap).not.toHaveBeenCalled();
  });
});
