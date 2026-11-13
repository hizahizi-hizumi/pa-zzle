// 試作 glass: プレイ画面の地。左上から光の差す、理科室の明るい壁。
export function GlassBackground() {
  return (
    <div
      className="size-full"
      style={{
        background: [
          "linear-gradient(118deg, rgba(255,255,255,0.55) 0%, rgba(255,255,255,0) 38%)",
          "radial-gradient(120% 80% at 30% 35%, #eef2f5 0%, #e3e9ee 55%, #d6dee6 100%)",
        ].join(", "),
      }}
    />
  );
}
