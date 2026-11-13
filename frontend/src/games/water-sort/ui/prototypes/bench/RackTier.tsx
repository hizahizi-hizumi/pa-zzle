// 試作 bench の木の試験管立ての1段（試験管の奥の面か、手前の面）。立ての単位で描き、k 倍して置く。
import { memo } from "react";
import {
  type BenchLayout,
  RACK_SIDE,
  TIER_HEIGHT,
  TIER_PITCH,
} from "@/games/water-sort/ui/prototypes/bench/geometry";

export type RackTierProps = {
  layout: BenchLayout;
  row: number;
  part: "back" | "front";
};

function slotXs(layout: BenchLayout, row: number) {
  const count = layout.rowCounts[row] ?? 0;
  const offset = ((layout.columns - count) / 2) * layout.pitchX;
  return Array.from(
    { length: count },
    (_, c) => RACK_SIDE + offset + layout.pitchX * (c + 0.5),
  );
}

export const RackTier = memo(function RackTier({
  layout,
  row,
  part,
}: RackTierProps) {
  const { k, rackLeft, rackTop, rackWidthUnits: rw } = layout;
  const ty = rackTop + row * TIER_PITCH * k;
  const xs = slotXs(layout, row);
  const isLast = row === layout.rows - 1;
  const bw = rw - 16;

  if (part === "back") {
    return (
      <svg
        className="pointer-events-none absolute inset-0 overflow-visible"
        width={layout.width}
        height={layout.height}
        aria-hidden="true"
      >
        <g transform={`translate(${rackLeft} ${ty}) scale(${k})`}>
          {isLast && (
            <g>
              {/* 台に落ちる立ての影（光は左上の窓から） */}
              <ellipse
                cx={rw / 2 + 26}
                cy={TIER_HEIGHT + 6}
                rx={rw / 2 + 30}
                ry={16}
                fill="#2a1606"
                opacity={0.28}
                filter="url(#bn-blur5)"
              />
              <rect
                x={14}
                y={TIER_HEIGHT - 2}
                width={rw - 4}
                height={6}
                rx={3}
                fill="#2a1606"
                opacity={0.35}
                filter="url(#bn-blur2)"
              />
            </g>
          )}
          {/* 奥の横木（ガラス越しに透ける） */}
          <rect
            x={10}
            y={108}
            width={rw - 20}
            height={7}
            rx={3.5}
            fill="url(#bn-dowel)"
          />
          <rect
            x={10}
            y={116}
            width={rw - 20}
            height={3}
            fill="#5a3a1a"
            opacity={0.12}
          />
          {/* 上の板の天面と穴 */}
          <rect
            x={8}
            y={20}
            width={bw}
            height={10}
            rx={1.5}
            fill="url(#bn-wood-top)"
          />
          <rect
            x={8}
            y={20}
            width={bw}
            height={10}
            fill="#000"
            filter="url(#bn-grain)"
            opacity={0.5}
          />
          {xs.map((x) => (
            <g key={`h${x}`}>
              <ellipse cx={x} cy={25} rx={29.5} ry={4.3} fill="#7a5229" />
              <ellipse
                cx={x}
                cy={25.7}
                rx={28}
                ry={3.4}
                fill="#3e2410"
                opacity={0.8}
              />
              <path
                d={`M${x - 29.5},25 A29.5,4.3 0 0 0 ${x + 29.5},25`}
                stroke="#f6dfb2"
                strokeWidth={0.9}
                fill="none"
                opacity={0.85}
              />
            </g>
          ))}
          {/* 下の板の天面 */}
          <rect
            x={8}
            y={190}
            width={bw}
            height={14}
            rx={1.5}
            fill="url(#bn-wood-top)"
          />
          <rect
            x={8}
            y={190}
            width={bw}
            height={14}
            fill="#000"
            filter="url(#bn-grain)"
            opacity={0.5}
          />
          {xs.map((x, i) => (
            <g key={`d${x}`}>
              {/* 使い込んだ染み */}
              {(i + row) % 3 === 1 && (
                <ellipse
                  cx={x - 30}
                  cy={199}
                  rx={7}
                  ry={1.8}
                  fill="#8a5a2c"
                  opacity={0.22}
                />
              )}
              <ellipse
                cx={x}
                cy={197.5}
                rx={27}
                ry={4.4}
                fill="#a87a45"
                opacity={0.55}
              />
              <path
                d={`M${x - 27},197.5 A27,4.4 0 0 1 ${x + 27},197.5`}
                stroke="#7d5229"
                strokeWidth={0.9}
                fill="none"
                opacity={0.6}
              />
              <path
                d={`M${x - 27},197.5 A27,4.4 0 0 0 ${x + 27},197.5`}
                stroke="#fbe6bf"
                strokeWidth={0.7}
                fill="none"
                opacity={0.6}
              />
            </g>
          ))}
        </g>
      </svg>
    );
  }

  const postTop = 14;
  const postHeight = (layout.rows - 1) * TIER_PITCH + TIER_HEIGHT - postTop;
  return (
    <svg
      className="pointer-events-none absolute inset-0 overflow-visible"
      width={layout.width}
      height={layout.height}
      aria-hidden="true"
    >
      <g transform={`translate(${rackLeft} ${ty}) scale(${k})`}>
        <BoardFront x={6} y={30} w={rw - 12} h={12} />
        <BoardFront x={6} y={204} w={rw - 12} h={16} />
        <rect
          x={8}
          y={42}
          width={rw - 16}
          height={5}
          fill="#3a2410"
          opacity={0.16}
          filter="url(#bn-blur2)"
        />
        {isLast && (
          <g transform={`translate(0 ${-row * TIER_PITCH})`}>
            <Post x={0} y={postTop} h={postHeight} fill="url(#bn-post-l)" />
            <Post
              x={rw - 12}
              y={postTop}
              h={postHeight}
              fill="url(#bn-post-r)"
            />
            <rect
              x={0}
              y={postTop - 2}
              width={12}
              height={4}
              rx={2}
              fill="#f2d9aa"
            />
            <rect
              x={rw - 12}
              y={postTop - 2}
              width={12}
              height={4}
              rx={2}
              fill="#e2c38e"
            />
            <rect
              x={11}
              y={postTop + 2}
              width={1}
              height={postHeight - 2}
              fill="#6e4520"
              opacity={0.35}
            />
            <rect
              x={rw - 12}
              y={postTop + 2}
              width={1}
              height={postHeight - 2}
              fill="#fff3d8"
              opacity={0.3}
            />
            {/* 木釘の頭 */}
            {Array.from({ length: layout.rows }, (_, r) => (
              <g key={`peg${r}`}>
                {[36, 212].map((py) => (
                  <g key={py}>
                    <circle
                      cx={6}
                      cy={r * TIER_PITCH + py}
                      r={2.2}
                      fill="#a3713d"
                    />
                    <circle
                      cx={rw - 6}
                      cy={r * TIER_PITCH + py}
                      r={2.2}
                      fill="#8a5c2f"
                    />
                  </g>
                ))}
              </g>
            ))}
          </g>
        )}
      </g>
    </svg>
  );
});

type BoardFrontProps = { x: number; y: number; w: number; h: number };

function BoardFront({ x, y, w, h }: BoardFrontProps) {
  return (
    <g>
      <rect
        x={x}
        y={y}
        width={w}
        height={h}
        rx={1.5}
        fill="url(#bn-wood-front)"
      />
      <rect
        x={x}
        y={y}
        width={w}
        height={h}
        fill="#000"
        filter="url(#bn-grain)"
        opacity={0.75}
      />
      <rect x={x} y={y} width={w} height={h} fill="url(#bn-wood-hfront)" />
      <rect
        x={x + 1}
        y={y}
        width={w - 2}
        height={1}
        fill="#f8e4bc"
        opacity={0.95}
      />
      <rect
        x={x}
        y={y + h - 1}
        width={w}
        height={1}
        fill="#7d5023"
        opacity={0.6}
      />
    </g>
  );
}

type PostProps = { x: number; y: number; h: number; fill: string };

function Post({ x, y, h, fill }: PostProps) {
  return (
    <g>
      <rect x={x} y={y} width={12} height={h} rx={2} fill={fill} />
      <rect
        x={x}
        y={y}
        width={12}
        height={h}
        fill="#000"
        filter="url(#bn-grain-v)"
        opacity={0.5}
      />
    </g>
  );
}
