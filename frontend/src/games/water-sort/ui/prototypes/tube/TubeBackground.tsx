// プレイ画面の地: 左上の窓から光が差す、明るい実験室の壁。
export function TubeBackground() {
  return (
    <div
      className="size-full"
      style={{
        background: [
          "linear-gradient(118deg, rgba(255,255,255,0) 18%, rgba(255,255,255,.42) 30%, rgba(255,255,255,0) 44%)",
          "linear-gradient(118deg, rgba(255,255,255,0) 47%, rgba(255,255,255,.22) 53%, rgba(255,255,255,0) 60%)",
          "radial-gradient(70% 45% at 14% 8%, rgba(255,255,255,.8) 0%, rgba(255,255,255,0) 70%)",
          "radial-gradient(120% 80% at 30% 35%, #e7edf2 0%, #d8e0e8 55%, #c7d2dc 100%)",
        ].join(","),
      }}
    />
  );
}
