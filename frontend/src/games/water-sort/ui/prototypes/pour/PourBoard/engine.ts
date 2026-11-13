// 盤面の動きと描画。React の外で毎フレーム、試験管の姿勢・液・流れを進めて canvas に描く。
// 論理の盤面は props の state が正で、ここは見た目をそこへ寄せていく。
import type { WaterSortOperation } from "@/games/water-sort/play/use-water-sort-play";
import { classifyWaterSortDeadlock } from "@/games/water-sort/puzzle/deadlock";
import {
  isCompleteWaterSortBottle,
  type WaterSortBottle,
  type WaterSortState,
} from "@/games/water-sort/puzzle/state";
import {
  corkSvg,
  glassSvg,
  liquidColor,
  loadSvgImage,
  mix,
  rackBackSvg,
  rackFrontSvg,
  rimFrontSvg,
  TUBE_IMAGE_BOX,
} from "@/games/water-sort/ui/prototypes/pour/PourBoard/art";
import {
  levelsForTilt,
  MOUTH_Y,
  retainedUnits,
  tiltForRetained,
  traceCavity,
} from "@/games/water-sort/ui/prototypes/pour/PourBoard/geometry";
import type {
  BoardLayout,
  Slot,
} from "@/games/water-sort/ui/prototypes/pour/PourBoard/layout";
import {
  playClearedSound,
  playClinkSound,
  playInvalidSound,
  playPourSound,
  preparePourSounds,
} from "@/games/water-sort/ui/prototypes/pour/PourBoard/sounds";

export type EngineInput = {
  state: WaterSortState;
  sourceBottleIndex: number | null;
  operation: WaterSortOperation | null;
};

export type EngineCallbacks = {
  onActivityChange: (active: boolean) => void;
  onClearAnimationComplete: () => void;
  onFloorChange: (floorY: number | null) => void;
};

type PourOperation = Extract<WaterSortOperation, { type: "poured" }>;

type Seg = { color: number; amount: number; line: number; wave: number };

type Kick =
  | { kind: "refuse"; t0: number; dy: number; dth: number; stopped: boolean }
  /** 選んだ管が首を横に振る。注ぐ傾きと見分けられるよう、傾けずに横へ揺らす。 */
  | { kind: "shake"; t0: number };

type Ring = { x: number; t0: number; amp: number };
type Bubble = { x: number; y: number; vy: number; r: number; t0: number };

type Tube = {
  index: number;
  slot: Slot;
  /** ばねで動く姿勢（制御中でないとき）。 */
  bx: number;
  by: number;
  bth: number;
  vx: number;
  vy: number;
  vth: number;
  tx: number;
  ty: number;
  /** 描く姿勢。 */
  x: number;
  y: number;
  th: number;
  velX: number;
  velY: number;
  accX: number;
  accY: number;
  ctrl: Pour | null;
  kick: Kick | null;
  segs: Seg[];
  tilt: number;
  tiltV: number;
  heave: number;
  heaveV: number;
  ripple: number;
  phase: number;
  cork: number;
  corkDy: number;
  corkAnim: { t0: number; kind: "in" | "out"; impacted: boolean } | null;
  floorSlack: number;
  glint: number;
  /** 空になって穴に収まった直後の、澄んだガラスの光。 */
  fresh: number;
  rings: Ring[];
  bubbles: Bubble[];
  holeFlash: number;
  /** 描くときの液面（管の原点から測った世界の y、世界の下から順）と並び。 */
  levels: number[];
  ordered: Seg[];
  topY: number;
};

type Particle = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  dv: number;
  rate: number;
  born: number;
};

type PourPhase =
  | "travel"
  | "pour"
  | "return"
  | "float"
  | "hang"
  | "drop"
  | "released";

type Pour = {
  id: number;
  src: Tube;
  dst: Tube;
  color: number;
  units: number;
  sgn: number;
  phase: PourPhase;
  phaseStart: number;
  from: { x: number; y: number; th: number };
  lipX: number;
  lipY: number;
  px: number;
  py: number;
  th0: number;
  th1: number;
  travelMs: number;
  tiltMs: number;
  srcEnd: number;
  emitted: number;
  emissionDoneAt: number | null;
  rate: number;
  particles: Particle[];
  landed: number;
  incoming: Seg;
  merge: boolean;
  firstLandAt: number | null;
  lastRingAt: number;
  transferEndAt: number | null;
  emptied: boolean;
  dropV: number;
  landedOnce: boolean;
  corkAt: number | null;
  clearing: boolean;
  after: { src: WaterSortBottle; dst: WaterSortBottle };
};

const LIFT = 30;
const G_VIS = 0.0035;
const FLOW_K = 0.011;
const MIN_FLOW = 0.0009;
const STREAM_GRAVITY = 0.0045;
const CORK_DELAY_MS = 380;
const CORK_FALL_MS = 230;
const CORK_PRESS_MS = 110;
const FINALE_MS = 1500;
const SHAKE_MS = 420;
// 試作の確かめ用: URL に pourslow=<倍率> を付けると動きを遅くする。
const TIME_SCALE =
  typeof window === "undefined"
    ? 1
    : Number(new URLSearchParams(window.location.search).get("pourslow")) || 1;

function clamp(v: number, lo: number, hi: number) {
  return v < lo ? lo : v > hi ? hi : v;
}
function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}
function easeInOutCubic(t: number) {
  return t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2;
}
function easeInOutSine(t: number) {
  return -(Math.cos(Math.PI * t) - 1) / 2;
}
function easeOutCubic(t: number) {
  return 1 - (1 - t) ** 3;
}
function easeOutBack(t: number, s: number) {
  const c3 = s + 1;
  return 1 + c3 * (t - 1) ** 3 + s * (t - 1) ** 2;
}

function segsFromBottle(bottle: WaterSortBottle): Seg[] {
  const segs: Seg[] = [];
  for (const color of bottle) {
    const last = segs[segs.length - 1];
    if (last && last.color === color) last.amount += 1;
    else
      segs.push({ color, amount: 1, line: segs.length > 0 ? 1 : 0, wave: 0 });
  }
  return segs;
}

function segsMatch(segs: readonly Seg[], bottle: WaterSortBottle): boolean {
  const expected = segsFromBottle(bottle);
  const actual: { color: number; amount: number }[] = [];
  for (const seg of segs) {
    if (seg.amount < 1e-6) continue;
    const last = actual[actual.length - 1];
    if (last && last.color === seg.color) last.amount += seg.amount;
    else actual.push({ color: seg.color, amount: seg.amount });
  }
  return (
    actual.length === expected.length &&
    actual.every(
      (seg, i) =>
        seg.color === expected[i]?.color &&
        Math.abs(seg.amount - (expected[i]?.amount ?? 0)) < 1e-4,
    )
  );
}

function totalUnits(segs: readonly Seg[]) {
  let v = 0;
  for (const seg of segs) v += seg.amount;
  return v;
}

type Images = {
  key: string;
  glass: HTMLImageElement | null;
  cork: HTMLImageElement | null;
  rimFront: HTMLImageElement | null;
  back: HTMLImageElement | null;
  front: HTMLImageElement | null;
};

export class PourEngine {
  private ctx: CanvasRenderingContext2D | null;
  private layout: BoardLayout | null = null;
  private input: EngineInput | null = null;
  private tubes: Tube[] = [];
  private pours: Pour[] = [];
  private seenOps = new Set<number>();
  private hadOperation = false;
  private raf = 0;
  private last = 0;
  private now = 0;
  private active = false;
  private deadlocked = false;
  private deadlockKey: WaterSortState | null = null;
  private alive = 1;
  private finaleAt: number | null = null;
  private clearPending = false;
  private images: Images = {
    key: "",
    glass: null,
    cork: null,
    rimFront: null,
    back: null,
    front: null,
  };
  private dpr = 1;
  private lastFloor: number | null = null;

  constructor(
    private canvas: HTMLCanvasElement,
    private box: HTMLElement,
    private callbacks: EngineCallbacks,
  ) {
    this.ctx = canvas.getContext("2d");
    preparePourSounds();
    this.raf = requestAnimationFrame(this.frame);
  }

  setCallbacks(callbacks: EngineCallbacks) {
    this.callbacks = callbacks;
  }

  destroy() {
    cancelAnimationFrame(this.raf);
    if (this.active) this.callbacks.onActivityChange(false);
    this.callbacks.onFloorChange(null);
  }

  setLayout(layout: BoardLayout) {
    const countChanged = layout.slots.length !== this.layout?.slots.length;
    this.layout = layout;
    this.loadImages();
    if (countChanged || this.tubes.length !== layout.slots.length) {
      this.tubes = [];
      this.pours = [];
    } else {
      for (const pour of [...this.pours]) this.finalizePour(pour);
      this.tubes.forEach((tube, i) => {
        tube.slot = layout.slots[i] as Slot;
      });
      this.snapPoses();
    }
    if (this.input) this.sync(this.input);
  }

  sync(input: EngineInput) {
    this.input = input;
    const layout = this.layout;
    if (!layout) return;
    const { state, operation } = input;
    if (
      this.tubes.length !== state.length ||
      state.length !== layout.slots.length
    ) {
      this.buildTubes();
      if (operation) {
        this.seenOps.add(operation.id);
        if (operation.type === "poured" && operation.isClearingMove) {
          this.clearPending = true;
          this.finaleAt = this.now;
        }
      }
      this.hadOperation = operation !== null;
      return;
    }

    if (operation === null) {
      if (this.hadOperation || this.pours.length > 0) {
        for (const pour of [...this.pours]) this.finalizePour(pour);
        this.finaleAt = null;
      }
      this.hadOperation = false;
    } else if (!this.seenOps.has(operation.id)) {
      this.seenOps.add(operation.id);
      this.hadOperation = true;
      this.handleOperation(operation, input);
    }

    this.updateTargets();
    this.reconcile();
    if (this.deadlockKey !== state) {
      this.deadlockKey = state;
      this.deadlocked = classifyWaterSortDeadlock(state) === "deadlocked";
    }
    this.updateActivity();
  }

  private handleOperation(operation: WaterSortOperation, input: EngineInput) {
    const tube = (i: number) => this.tubes[i];
    switch (operation.type) {
      case "source-selected": {
        const t = tube(operation.bottleIndex);
        if (t) this.releaseTube(t);
        return;
      }
      case "source-deselected":
        return;
      case "invalid": {
        playInvalidSound();
        const selected = input.sourceBottleIndex;
        if (selected === null || selected === operation.bottleIndex) {
          const t = tube(operation.bottleIndex);
          if (t && !t.ctrl)
            t.kick = {
              kind: "refuse",
              t0: this.now,
              dy: -11,
              dth: 0,
              stopped: false,
            };
          return;
        }
        const src = tube(selected);
        const dst = tube(operation.bottleIndex);
        if (src && !src.ctrl) src.kick = { kind: "shake", t0: this.now };
        if (dst && !dst.ctrl && !dst.kick) {
          dst.kick = {
            kind: "refuse",
            t0: this.now,
            dy: -4,
            dth: 0,
            stopped: true,
          };
        }
        return;
      }
      case "poured":
        this.startPour(operation);
        return;
    }
  }

  /** この管が関わる注ぎを終わらせ、管をばねに戻す。 */
  private releaseTube(tube: Tube) {
    for (const pour of [...this.pours]) {
      if (pour.src === tube || pour.dst === tube) this.finalizePour(pour);
    }
    tube.kick = null;
  }

  private finalizePour(pour: Pour) {
    const { src, dst } = pour;
    if (src.ctrl === pour) this.handToSpring(src, 0);
    src.segs = segsFromBottle(pour.after.src);
    dst.segs = segsFromBottle(pour.after.dst);
    if (isCompleteWaterSortBottle(pour.after.dst)) {
      dst.cork = 1;
      dst.corkDy = 0;
      dst.corkAnim = null;
    }
    this.pours = this.pours.filter((p) => p !== pour);
    if (pour.clearing && this.finaleAt === null) {
      this.clearPending = true;
      this.finaleAt = this.now;
    }
  }

  private handToSpring(tube: Tube, velocityScale: number) {
    tube.ctrl = null;
    tube.bx = tube.x;
    tube.by = tube.y;
    tube.bth = tube.th;
    tube.vx = tube.velX * velocityScale;
    tube.vy = tube.velY * velocityScale;
    tube.vth = 0;
  }

  private startPour(op: PourOperation) {
    const src = this.tubes[op.sourceBottleIndex];
    const dst = this.tubes[op.destinationBottleIndex];
    if (!src || !dst) return;
    this.releaseTube(src);
    this.releaseTube(dst);
    const before = op.stateBefore;
    const srcBefore = before[op.sourceBottleIndex] ?? [];
    const dstBefore = before[op.destinationBottleIndex] ?? [];
    if (!segsMatch(src.segs, srcBefore)) src.segs = segsFromBottle(srcBefore);
    if (!segsMatch(dst.segs, dstBefore)) dst.segs = segsFromBottle(dstBefore);
    const srcAfter = op.stateAfter[op.sourceBottleIndex] ?? [];
    const dstAfter = op.stateAfter[op.destinationBottleIndex] ?? [];
    const color = srcBefore[srcBefore.length - 1];
    if (color === undefined) return;
    const units = srcBefore.length - srcAfter.length;
    const v0 = srcBefore.length;
    const srcEnd = srcAfter.length;
    const center = (this.layout?.rack.width ?? 0) / 2;
    const sgn =
      Math.sign(dst.slot.cx - src.slot.cx) || (dst.slot.cx < center ? -1 : 1);
    const th0 = sgn * tiltForRetained(Math.min(5, v0 + 0.06));
    const th1 =
      sgn * (srcEnd === 0 ? 1.88 : tiltForRetained(Math.max(0, srcEnd - 0.06)));
    const px = dst.slot.cx - sgn * 7;
    const py = dst.slot.yt - 30;
    const lipX = sgn * 22;
    const lipY = MOUTH_Y;
    const dist = Math.hypot(px - src.x, py - src.y);
    const topSeg = dst.segs[dst.segs.length - 1];
    const merge = topSeg?.color === color;
    const incoming: Seg = {
      color,
      amount: 0,
      line: dst.segs.length > 0 ? 1 : 0,
      wave: 0,
    };
    dst.segs.push(incoming);
    src.kick = null;
    const pour: Pour = {
      id: op.id,
      src,
      dst,
      color,
      units,
      sgn,
      phase: "travel",
      phaseStart: this.now,
      from: { x: src.x, y: src.y, th: src.th },
      lipX,
      lipY,
      px,
      py,
      th0,
      th1,
      travelMs: clamp(250 + dist * 0.85, 300, 560),
      tiltMs: 300 + 115 * units,
      srcEnd,
      emitted: 0,
      emissionDoneAt: null,
      rate: 0,
      particles: [],
      landed: 0,
      incoming,
      merge,
      firstLandAt: null,
      lastRingAt: 0,
      transferEndAt: null,
      emptied: srcEnd === 0,
      dropV: 0,
      landedOnce: false,
      corkAt: null,
      clearing: op.isClearingMove,
      after: { src: srcAfter, dst: dstAfter },
    };
    src.ctrl = pour;
    this.pours.push(pour);
  }

  private buildTubes() {
    const layout = this.layout;
    const input = this.input;
    if (!layout || !input) return;
    this.pours = [];
    this.tubes = layout.slots.map((slot, index) => {
      const bottle = input.state[index] ?? [];
      const lifted = input.sourceBottleIndex === index;
      const y = slot.yt - (lifted ? LIFT : 0);
      return {
        index,
        slot,
        bx: slot.cx,
        by: y,
        bth: 0,
        vx: 0,
        vy: 0,
        vth: 0,
        tx: slot.cx,
        ty: y,
        x: slot.cx,
        y,
        th: 0,
        velX: 0,
        velY: 0,
        accX: 0,
        accY: 0,
        ctrl: null,
        kick: null,
        segs: segsFromBottle(bottle),
        tilt: 0,
        tiltV: 0,
        heave: 0,
        heaveV: 0,
        ripple: 0,
        phase: index * 1.7,
        cork: isCompleteWaterSortBottle(bottle) ? 1 : 0,
        corkDy: 0,
        corkAnim: null,
        floorSlack: 0,
        glint: 0,
        fresh: 0,
        rings: [],
        bubbles: [],
        holeFlash: 0,
        levels: [],
        ordered: [],
        topY: 0,
      };
    });
    this.deadlockKey = input.state;
    this.deadlocked = classifyWaterSortDeadlock(input.state) === "deadlocked";
    this.alive = this.deadlocked ? 0 : 1;
  }

  private snapPoses() {
    this.updateTargets();
    for (const tube of this.tubes) {
      tube.bx = tube.tx;
      tube.by = tube.ty;
      tube.bth = 0;
      tube.vx = tube.vy = tube.vth = 0;
      tube.x = tube.bx;
      tube.y = tube.by;
      tube.th = 0;
      tube.velX = tube.velY = tube.accX = tube.accY = 0;
    }
  }

  private updateTargets() {
    const selected = this.input?.sourceBottleIndex ?? null;
    for (const tube of this.tubes) {
      tube.tx = tube.slot.cx;
      tube.ty = tube.slot.yt - (tube.index === selected ? LIFT : 0);
    }
  }

  /** 注ぎに関わっていない管の液と栓を、論理の盤面に合わせる。 */
  private reconcile() {
    const state = this.input?.state;
    if (!state) return;
    for (const tube of this.tubes) {
      if (this.pours.some((p) => p.src === tube || p.dst === tube)) continue;
      const bottle = state[tube.index] ?? [];
      if (!segsMatch(tube.segs, bottle)) tube.segs = segsFromBottle(bottle);
      else tube.segs = tube.segs.filter((seg) => seg.amount > 1e-6);
      const complete = isCompleteWaterSortBottle(bottle);
      if (complete && tube.cork === 0 && !tube.corkAnim) {
        tube.cork = 1;
        tube.corkDy = 0;
      }
      if (!complete && tube.cork > 0 && tube.corkAnim?.kind !== "out") {
        tube.corkAnim = { t0: this.now, kind: "out", impacted: false };
      }
    }
  }

  private updateActivity() {
    const settlingDeadlock =
      this.deadlocked &&
      this.pours.length === 0 &&
      (this.alive > 0.03 ||
        this.tubes.some(
          (t) => Math.abs(t.heave) + Math.abs(t.tilt) * 20 > 0.08,
        ));
    const active =
      this.pours.length > 0 || this.finaleAt !== null || settlingDeadlock;
    if (active !== this.active) {
      this.active = active;
      this.callbacks.onActivityChange(active);
    }
  }

  private loadImages() {
    const layout = this.layout;
    if (!layout) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    this.dpr = dpr;
    const key = `${layout.key}:${dpr}`;
    if (this.images.key === key) return;
    const images: Images = {
      key,
      glass: null,
      cork: null,
      rimFront: null,
      back: null,
      front: null,
    };
    this.images = images;
    const px = layout.scale * dpr;
    const set = (name: keyof Omit<Images, "key">, svg: string) => {
      void loadSvgImage(svg).then(
        (image) => {
          if (this.images === images) images[name] = image;
        },
        () => undefined,
      );
    };
    set("glass", glassSvg(px * 1.25));
    set("cork", corkSvg(px * 1.25));
    set("rimFront", rimFrontSvg(px * 1.25));
    set("back", rackBackSvg(layout.rack, px));
    set("front", rackFrontSvg(layout.rack, px));
  }

  private frame = (time: number) => {
    this.raf = requestAnimationFrame(this.frame);
    const dt =
      (this.last === 0 ? 16 : clamp(time - this.last, 1, 40)) / TIME_SCALE;
    this.last = time;
    this.now += dt;
    if (!this.layout || this.tubes.length === 0) {
      this.render();
      return;
    }
    this.step(dt);
    this.render();
  };

  private step(dt: number) {
    const now = this.now;
    for (const pour of [...this.pours]) this.stepPour(pour, dt);
    for (const tube of this.tubes) this.stepTubePose(tube, dt);
    for (const tube of this.tubes) this.stepLiquid(tube, dt);
    for (const pour of [...this.pours]) this.stepStream(pour, dt);
    for (const pour of [...this.pours]) this.checkPourDone(pour);

    if (this.deadlocked && this.pours.length === 0) {
      this.alive = Math.max(0, this.alive - dt / 450);
    } else {
      this.alive = Math.min(1, this.alive + dt / 600);
    }

    if (this.finaleAt !== null && this.pours.length === 0) {
      if (this.clearPending) {
        this.clearPending = false;
        this.finaleAt = now;
        this.startFinale();
      }
      if (now - this.finaleAt >= FINALE_MS) {
        this.finaleAt = null;
        this.callbacks.onClearAnimationComplete();
      }
    }
    this.updateActivity();
  }

  private startFinale() {
    playClearedSound();
    for (const tube of this.tubes) {
      tube.heave = 2.6;
      tube.heaveV = 0;
      tube.tilt = 0;
      tube.tiltV = 0;
      tube.ripple = 0;
      tube.phase = 0;
      if (!tube.ctrl) tube.vy += 0.03;
    }
  }

  private stepPour(pour: Pour, dt: number) {
    const { src } = pour;
    const now = this.now;
    const u = (ms: number) => clamp((now - pour.phaseStart) / ms, 0, 1);
    const placeLipAt = (th: number) => {
      const c = Math.cos(th);
      const s = Math.sin(th);
      src.x = pour.px - (c * pour.lipX - s * pour.lipY);
      src.y = pour.py - (s * pour.lipX + c * pour.lipY);
      src.th = th;
    };
    const nextPhase = (phase: PourPhase) => {
      pour.phase = phase;
      pour.phaseStart = now;
      pour.from = { x: src.x, y: src.y, th: src.th };
    };

    switch (pour.phase) {
      case "travel": {
        const k = u(pour.travelMs);
        const th = lerp(
          pour.from.th,
          pour.th0,
          easeInOutSine(clamp((k - 0.18) / 0.82, 0, 1)),
        );
        const c = Math.cos(pour.th0);
        const s = Math.sin(pour.th0);
        const endX = pour.px - (c * pour.lipX - s * pour.lipY);
        const endY = pour.py - (s * pour.lipX + c * pour.lipY);
        const ex = easeInOutCubic(clamp((k - 0.08) / 0.92, 0, 1));
        const ey = easeOutCubic(k);
        src.x = lerp(pour.from.x, endX, ex);
        src.y = lerp(pour.from.y, endY, ey) - 34 * Math.sin(Math.PI * k) ** 1.5;
        src.th = th;
        if (k >= 1) nextPhase("pour");
        break;
      }
      case "pour": {
        const k = u(pour.tiltMs);
        placeLipAt(lerp(pour.th0, pour.th1, easeInOutSine(k)));
        this.emit(pour, dt);
        if (pour.emissionDoneAt !== null && now - pour.emissionDoneAt > 70) {
          nextPhase(pour.emptied ? "float" : "return");
        }
        break;
      }
      case "return": {
        const k = u(500);
        const e = easeInOutCubic(k);
        src.x = lerp(pour.from.x, src.slot.cx, e);
        src.y =
          lerp(pour.from.y, src.slot.yt - 6, e) - 18 * Math.sin(Math.PI * k);
        src.th = pour.from.th * (1 - easeOutBack(k, 0.9));
        if (k >= 1) {
          this.handToSpring(src, 1);
          pour.phase = "released";
        }
        break;
      }
      case "float": {
        const k = u(400);
        const e = easeOutCubic(k);
        src.x = lerp(pour.from.x, src.slot.cx, e);
        src.y =
          lerp(pour.from.y, src.slot.yt - 48, e) - 14 * Math.sin(Math.PI * k);
        src.th = pour.from.th * (1 - easeOutBack(k, 1.3));
        if (k >= 1) nextPhase("hang");
        break;
      }
      case "hang": {
        const k = u(110);
        src.x = src.slot.cx;
        src.y = src.slot.yt - 48 - 2.5 * Math.sin(Math.PI * k);
        src.th = pour.from.th * (1 - k);
        if (k >= 1) {
          nextPhase("drop");
          pour.dropV = 0.02;
        }
        break;
      }
      case "drop": {
        pour.dropV += 0.0068 * dt;
        src.x = src.slot.cx;
        src.th = 0;
        src.y += pour.dropV * dt;
        if (src.y >= src.slot.yt) {
          src.y = src.slot.yt;
          if (!pour.landedOnce) {
            pour.landedOnce = true;
            this.onEmptyTubeSeated(src);
          }
          if (pour.dropV > 0.07) {
            pour.dropV = -pour.dropV * 0.3;
          } else {
            src.velX = 0;
            src.velY = 0;
            this.handToSpring(src, 0);
            pour.phase = "released";
          }
        }
        break;
      }
      case "released":
        break;
    }

    if (
      pour.corkAt !== null &&
      now >= pour.corkAt &&
      !pour.dst.corkAnim &&
      pour.dst.cork === 0
    ) {
      pour.dst.corkAnim = { t0: now, kind: "in", impacted: false };
    }
  }

  private onEmptyTubeSeated(tube: Tube) {
    playClinkSound();
    tube.glint = 1;
    tube.fresh = 1;
    tube.holeFlash = 1;
    for (const other of this.tubes) {
      if (other === tube || other.slot.tier !== tube.slot.tier || other.ctrl)
        continue;
      const near = 1 / (1 + Math.abs(other.slot.cx - tube.slot.cx) / 90);
      other.heaveV += 0.03 * near;
      other.tiltV += 0.0016 * near * Math.sign(other.slot.cx - tube.slot.cx);
    }
  }

  private emit(pour: Pour, dt: number) {
    const { src } = pour;
    if (pour.emissionDoneAt !== null) {
      pour.rate = 0;
      return;
    }
    const v = totalUnits(src.segs);
    const retained = Math.max(retainedUnits(Math.abs(src.th)), pour.srcEnd);
    const excess = v - retained;
    if (excess <= 0) {
      pour.rate = 0;
      return;
    }
    const rate = Math.max(FLOW_K * excess, MIN_FLOW);
    const dv = Math.min(rate * dt, v - pour.srcEnd, pour.units - pour.emitted);
    let remaining = dv;
    for (let i = src.segs.length - 1; i >= 0 && remaining > 0; i--) {
      const seg = src.segs[i] as Seg;
      const take = Math.min(seg.amount, remaining);
      seg.amount -= take;
      remaining -= take;
      if (seg.amount <= 1e-9) src.segs.splice(i, 1);
    }
    pour.emitted += dv;
    pour.rate = dv / dt;
    const c = Math.cos(src.th);
    const s = Math.sin(src.th);
    pour.particles.push({
      x: src.x + c * pour.lipX - s * pour.lipY,
      y: src.y + s * pour.lipX + c * pour.lipY,
      vx: pour.sgn * 0.022,
      vy: 0.03,
      dv,
      rate: pour.rate,
      born: this.now,
    });
    if (pour.emitted >= pour.units - 1e-6) {
      pour.emitted = pour.units;
      pour.emissionDoneAt = this.now;
      pour.rate = 0;
    }
  }

  private stepStream(pour: Pour, dt: number) {
    const { dst } = pour;
    const now = this.now;
    const surfaceY = dst.y + dst.topY;
    const mouthY = dst.y + MOUTH_Y;
    const kept: Particle[] = [];
    for (const p of pour.particles) {
      p.vy += STREAM_GRAVITY * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      if (p.y > mouthY) p.x = clamp(p.x, dst.x - 14, dst.x + 14);
      if (p.y >= surfaceY) {
        this.deposit(pour, p);
      } else {
        kept.push(p);
      }
    }
    pour.particles = kept;
    if (pour.merge && pour.firstLandAt !== null) {
      const frac = clamp(pour.landed / pour.units, 0, 1);
      pour.incoming.line = 1 - frac ** 0.75;
      pour.incoming.wave =
        3.4 *
        Math.sin(Math.PI * Math.min(1, frac * 1.15)) ** 0.6 *
        (1 - frac * 0.5);
    }
    if (
      pour.transferEndAt === null &&
      pour.emissionDoneAt !== null &&
      pour.particles.length === 0
    ) {
      pour.transferEndAt = now;
      pour.src.segs = segsFromBottle(pour.after.src);
      dst.segs = segsFromBottle(pour.after.dst);
      if (isCompleteWaterSortBottle(pour.after.dst)) {
        pour.corkAt = now + CORK_DELAY_MS;
      }
    }
  }

  private deposit(pour: Pour, p: Particle) {
    const { dst } = pour;
    const now = this.now;
    pour.incoming.amount += p.dv;
    pour.landed += p.dv;
    dst.ripple = Math.min(3.2, dst.ripple + p.dv * 9 + p.rate * 60 * 0.016);
    dst.heaveV += p.dv * 0.05;
    if (pour.firstLandAt === null) {
      pour.firstLandAt = now;
      playPourSound(pour.units, pour.tiltMs * 0.85);
    }
    if (now - pour.lastRingAt > 85) {
      pour.lastRingAt = now;
      dst.rings.push({
        x: p.x - dst.x,
        t0: now,
        amp: clamp(p.rate * 260, 0.4, 1.6),
      });
      const depth = Math.min(30, 10 + p.rate * 3000);
      for (let k = 0; k < 2; k++) {
        dst.bubbles.push({
          x: p.x - dst.x + (Math.random() - 0.5) * 10,
          y: dst.topY + depth * (0.5 + Math.random() * 0.5),
          vy: -0.02 - Math.random() * 0.03,
          r: 0.8 + Math.random() * 1.6,
          t0: now,
        });
      }
    }
  }

  private checkPourDone(pour: Pour) {
    if (pour.phase !== "released" || pour.transferEndAt === null) return;
    if (pour.corkAt !== null) {
      const corkDone = pour.dst.cork === 1 && !pour.dst.corkAnim;
      if (!corkDone) return;
    }
    this.pours = this.pours.filter((p) => p !== pour);
    pour.dst.segs = pour.dst.segs.filter((seg) => seg.amount > 1e-6);
    if (pour.clearing) {
      this.clearPending = true;
      this.finaleAt = this.now;
    }
    this.reconcile();
  }

  private stepTubePose(tube: Tube, dt: number) {
    const prevX = tube.x;
    const prevY = tube.y;
    if (!tube.ctrl) {
      let remaining = dt;
      while (remaining > 0) {
        const h = Math.min(8, remaining);
        remaining -= h;
        const wp = 0.021;
        const zp = 0.62;
        const wt = 0.019;
        const zt = 0.32;
        tube.vx += (-wp * wp * (tube.bx - tube.tx) - 2 * zp * wp * tube.vx) * h;
        tube.vy += (-wp * wp * (tube.by - tube.ty) - 2 * zp * wp * tube.vy) * h;
        tube.vth += (-wt * wt * tube.bth - 2 * zt * wt * tube.vth) * h;
        tube.bx += tube.vx * h;
        tube.by += tube.vy * h;
        tube.bth += tube.vth * h;
        const floor = tube.slot.yt + tube.floorSlack;
        if (tube.by > floor && tube.vy > 0) {
          tube.by = floor;
          tube.vy = -tube.vy * 0.28;
        }
      }
      tube.floorSlack *= Math.exp(-dt / 160);
      let kx = 0;
      let ky = 0;
      let kth = 0;
      const kick = tube.kick;
      if (kick?.kind === "shake") {
        const t = this.now - kick.t0;
        if (t < SHAKE_MS) {
          const k = t / SHAKE_MS;
          kx = 9 * Math.sin(k * Math.PI * 6) * (1 - k) ** 1.4;
        } else {
          tube.kick = null;
        }
      } else if (kick) {
        const t = this.now - kick.t0;
        if (t < 75) {
          const k = t / 75;
          ky = kick.dy * k * k;
          kth = kick.dth * k * k;
        } else if (t < 150) {
          ky = kick.dy;
          kth = kick.dth;
          if (!kick.stopped) {
            kick.stopped = true;
            tube.heaveV -= 0.06;
            tube.tiltV +=
              (kick.dth !== 0
                ? Math.sign(kick.dth)
                : Math.random() < 0.5
                  ? -1
                  : 1) * 0.0045;
            tube.ripple = Math.min(3, tube.ripple + 1.4);
          }
        } else if (t < 290) {
          const k = (t - 150) / 140;
          ky = kick.dy * (1 - k * k);
          kth = kick.dth * (1 - k * k);
        } else {
          tube.kick = null;
          tube.heaveV += 0.035;
        }
      }
      tube.x = tube.bx + kx;
      tube.y = tube.by + ky;
      tube.th = tube.bth + kth;
    }
    const velX = (tube.x - prevX) / dt;
    const velY = (tube.y - prevY) / dt;
    const rawAx = (velX - tube.velX) / dt;
    const rawAy = (velY - tube.velY) / dt;
    tube.accX = tube.accX * 0.45 + rawAx * 0.55;
    tube.accY = tube.accY * 0.45 + rawAy * 0.55;
    tube.velX = velX;
    tube.velY = velY;

    if (tube.corkAnim) {
      const anim = tube.corkAnim;
      const t = this.now - anim.t0;
      if (anim.kind === "in") {
        if (t < CORK_FALL_MS) {
          const k = t / CORK_FALL_MS;
          tube.corkDy = -70 * (1 - k * k);
          tube.cork = Math.min(1, t / 90);
        } else if (t < CORK_FALL_MS + CORK_PRESS_MS) {
          if (!anim.impacted) {
            anim.impacted = true;
            tube.cork = 1;
            tube.vy += 0.05;
            tube.floorSlack = 3.4;
            tube.heaveV -= 0.025;
            tube.glint = 1;
          }
          const k = (t - CORK_FALL_MS) / CORK_PRESS_MS;
          tube.corkDy = -6 * (1 - easeOutCubic(k));
        } else {
          tube.corkDy = 0;
          tube.cork = 1;
          tube.corkAnim = null;
        }
      } else {
        const k = t / 260;
        tube.corkDy = -50 * easeOutCubic(Math.min(1, k));
        tube.cork = Math.max(0, 1 - k);
        if (k >= 1) {
          tube.cork = 0;
          tube.corkDy = 0;
          tube.corkAnim = null;
        }
      }
    }
    tube.glint = Math.max(0, tube.glint - dt / 650);
    tube.holeFlash = Math.max(0, tube.holeFlash - dt / 800);
    tube.fresh = Math.max(0, tube.fresh - dt / 1100);
  }

  private stepLiquid(tube: Tube, dt: number) {
    const frozen = 1 - this.alive;
    const tiltEq = clamp((-tube.accX / G_VIS) * 0.5, -0.17, 0.17);
    const heaveEq = clamp((-tube.accY / G_VIS) * 1.2, -4.5, 4.5);
    let remaining = dt;
    while (remaining > 0) {
      const h = Math.min(4, remaining);
      remaining -= h;
      const wt = 0.016;
      const zt = 0.075 + frozen * 0.45;
      const wh = 0.022;
      const zh = 0.09 + frozen * 0.45;
      tube.tiltV +=
        (wt * wt * (tiltEq - tube.tilt) - 2 * zt * wt * tube.tiltV) * h;
      tube.heaveV +=
        (wh * wh * (heaveEq - tube.heave) - 2 * zh * wh * tube.heaveV) * h;
      tube.tilt += tube.tiltV * h;
      tube.heave += tube.heaveV * h;
    }
    tube.tilt = clamp(tube.tilt, -0.22, 0.22);
    tube.heave = clamp(tube.heave, -5, 5);
    tube.ripple *= Math.exp(-dt / (380 - frozen * 250));
    tube.phase += dt * 0.0016;

    const mouthUp = Math.cos(tube.th) >= 0;
    tube.ordered = mouthUp ? tube.segs : [...tube.segs].reverse();
    let cum = 0;
    const cumulative = tube.ordered.map((seg) => {
      cum += seg.amount;
      return cum;
    });
    tube.levels = levelsForTilt(tube.th, cumulative);
    const heaveScale = Math.max(0, Math.cos(tube.th));
    const top = tube.levels[tube.levels.length - 1];
    tube.topY = (top ?? 194) + tube.heave * heaveScale;

    const now = this.now;
    tube.rings = tube.rings.filter((r) => now - r.t0 < 520);
    tube.bubbles = tube.bubbles.filter((b) => {
      b.y += b.vy * dt;
      return now - b.t0 < 700 && b.y > tube.topY + 1;
    });
  }

  // ---- 描画 ----

  private render() {
    const ctx = this.ctx;
    const layout = this.layout;
    if (!ctx) return;
    const dpr = this.dpr;
    const w = Math.round(window.innerWidth * dpr);
    const h = Math.round(window.innerHeight * dpr);
    if (this.canvas.width !== w || this.canvas.height !== h) {
      this.canvas.width = w;
      this.canvas.height = h;
    }
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, w, h);
    if (!layout || this.tubes.length === 0) return;
    const rect = this.box.getBoundingClientRect();
    const floor =
      rect.top +
      (layout.rack.tierTops[1] ?? 0) * layout.scale +
      214 * layout.scale;
    if (this.lastFloor === null || Math.abs(this.lastFloor - floor) > 0.5) {
      this.lastFloor = floor;
      this.callbacks.onFloorChange(floor);
    }
    const k = dpr * layout.scale;
    ctx.setTransform(k, 0, 0, k, rect.left * dpr, rect.top * dpr);
    const { back, front } = this.images;
    const { width: rw, height: rh } = layout.rack;
    if (back) ctx.drawImage(back, 0, 0, rw, rh);
    for (const tube of this.tubes) this.drawShadow(ctx, tube);
    if (front) ctx.drawImage(front, 0, 0, rw, rh);
    for (const tube of this.tubes) {
      if (tube.ctrl) continue;
      this.drawTube(ctx, tube);
      this.drawStripOver(ctx, tube);
    }
    for (const tube of this.tubes) {
      if (!tube.ctrl) continue;
      this.drawTube(ctx, tube);
      this.drawStripOver(ctx, tube);
    }
    for (const pour of this.pours) this.drawStream(ctx, pour);
    // 流れは注ぎ先の口から奥へ入るので、注ぎ先の前板を流れの手前に戻す。
    for (const pour of this.pours) {
      if (pour.particles.length > 0 && !pour.dst.ctrl)
        this.drawStripOver(ctx, pour.dst);
    }
  }

  private drawShadow(ctx: CanvasRenderingContext2D, tube: Tube) {
    const { cx, yt } = tube.slot;
    const dist = Math.hypot(tube.x - cx, tube.y - yt);
    const presence = clamp(1 - dist / 62, 0, 1);
    const flash = tube.holeFlash;
    if (presence > 0.01) {
      const bottom = tube.segs[0];
      ctx.save();
      ctx.translate(cx + 11, yt + 198);
      ctx.scale(1, 0.18);
      const g = ctx.createRadialGradient(0, 0, 0, 0, 0, 30);
      g.addColorStop(0, `rgba(90,58,28,${0.42 * presence})`);
      g.addColorStop(1, "rgba(90,58,28,0)");
      ctx.fillStyle = g;
      ctx.fillRect(-32, -32, 64, 64);
      ctx.restore();
      if (bottom) {
        const color = liquidColor(bottom.color);
        ctx.save();
        ctx.translate(cx + 18, yt + 197);
        ctx.scale(1, 0.22);
        ctx.globalAlpha = 0.55 * presence;
        const cg = ctx.createRadialGradient(0, 0, 0, 0, 0, 20);
        cg.addColorStop(0, color.light);
        cg.addColorStop(1, "rgba(255,255,255,0)");
        ctx.fillStyle = cg;
        ctx.fillRect(-22, -22, 44, 44);
        ctx.restore();
      }
    }
    if (flash > 0) {
      const e = 1 - flash;
      ctx.save();
      ctx.translate(cx, yt + 25);
      const r = 30 + easeOutCubic(e) * 26;
      ctx.strokeStyle = `rgba(255,250,232,${flash})`;
      ctx.lineWidth = 2.6 * flash + 0.4;
      ctx.beginPath();
      ctx.ellipse(0, 0, r, r * 0.15, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.lineWidth = 1;
      ctx.strokeStyle = `rgba(255,250,232,${flash * 0.6})`;
      ctx.beginPath();
      ctx.ellipse(0, 0, r * 0.75 + 8, (r * 0.75 + 8) * 0.15, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
  }

  private drawStripOver(ctx: CanvasRenderingContext2D, tube: Tube) {
    const front = this.images.front;
    const layout = this.layout;
    if (!front || !layout) return;
    const { cx, yt } = tube.slot;
    const align =
      clamp(1 - Math.abs(tube.x - cx) / 24, 0, 1) *
      clamp(1 - Math.abs(tube.th) / 0.3, 0, 1);
    if (align <= 0) return;
    const half = layout.slotWidth / 2;
    const ratio = front.naturalWidth / layout.rack.width;
    const sx = cx - half;
    const sy = yt + 29.5;
    const sw = half * 2;
    const sh = 17;
    ctx.globalAlpha = align;
    const back = this.images.back;
    if (back) {
      // 穴の手前の天面を管の前に戻し、管が穴に差さって見えるようにする。
      const fy = yt + 24;
      const fh = 6.5;
      ctx.save();
      ctx.beginPath();
      ctx.rect(sx, fy, sw, fh);
      ctx.ellipse(cx, yt + 25, 29.5, 4.2, 0, 0, Math.PI * 2);
      ctx.clip("evenodd");
      ctx.drawImage(
        back,
        sx * ratio,
        fy * ratio,
        sw * ratio,
        fh * ratio,
        sx,
        fy,
        sw,
        fh,
      );
      ctx.restore();
    }
    ctx.drawImage(
      front,
      sx * ratio,
      sy * ratio,
      sw * ratio,
      sh * ratio,
      sx,
      sy,
      sw,
      sh,
    );
    ctx.globalAlpha = 1;
  }

  private drawTube(ctx: CanvasRenderingContext2D, tube: Tube) {
    const { glass, cork, rimFront } = this.images;
    ctx.save();
    ctx.translate(tube.x, tube.y);
    ctx.rotate(tube.th);
    if (tube.segs.length > 0) this.drawLiquid(ctx, tube);
    if (this.finaleAt !== null) this.drawSweep(ctx, tube);
    if (tube.fresh > 0) this.drawFresh(ctx, tube.fresh);
    const box = TUBE_IMAGE_BOX;
    if (glass) ctx.drawImage(glass, box.x, box.y, box.w, box.h);
    const doneColor = tube.cork > 0 ? tube.segs[0] : undefined;
    if (doneColor && tube.corkAnim === null) {
      ctx.strokeStyle = liquidColor(doneColor.color).light;
      ctx.globalAlpha = 0.28;
      ctx.lineWidth = 2.4;
      ctx.beginPath();
      ctx.moveTo(-26.5, 8);
      ctx.lineTo(-26.5, 172);
      ctx.arc(0, 172, 26.5, Math.PI, 0, true);
      ctx.lineTo(26.5, 8);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
    if (tube.cork > 0 && cork) {
      ctx.globalAlpha = tube.cork;
      ctx.drawImage(cork, box.x, box.y + tube.corkDy, box.w, box.h);
      ctx.globalAlpha = 1;
      if (tube.corkDy > -16 && rimFront) {
        ctx.drawImage(rimFront, box.x, box.y, box.w, box.h);
      }
    }
    if (tube.glint > 0) this.drawGlint(ctx, tube.glint);
    ctx.restore();
  }

  private drawSweep(ctx: CanvasRenderingContext2D, tube: Tube) {
    if (this.finaleAt === null) return;
    const t =
      this.now - this.finaleAt - tube.slot.cx * 0.9 - tube.slot.tier * 120;
    const p = t / 650;
    if (p < 0 || p > 1) return;
    ctx.save();
    traceCavity(ctx);
    ctx.clip();
    const y = -60 + p * 300;
    const g = ctx.createLinearGradient(0, y - 30, 0, y + 30);
    g.addColorStop(0, "rgba(255,255,255,0)");
    g.addColorStop(0.5, `rgba(255,255,255,${0.5 * Math.sin(Math.PI * p)})`);
    g.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = g;
    ctx.transform(1, -0.45, 0, 1, 0, 0);
    ctx.fillRect(-40, y - 30, 80, 60);
    ctx.restore();
  }

  private drawFresh(ctx: CanvasRenderingContext2D, amount: number) {
    const p = 1 - amount;
    ctx.save();
    traceCavity(ctx);
    ctx.clip();
    ctx.fillStyle = `rgba(255,255,255,${0.32 * amount ** 1.5})`;
    ctx.fillRect(-24, 0, 48, 200);
    const y = 200 - p * 260;
    const g = ctx.createLinearGradient(0, y - 26, 0, y + 26);
    g.addColorStop(0, "rgba(255,255,255,0)");
    g.addColorStop(
      0.5,
      `rgba(255,255,255,${0.75 * Math.sin(Math.PI * Math.min(1, p * 1.2))})`,
    );
    g.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = g;
    ctx.transform(1, -0.35, 0, 1, 0, 0);
    ctx.fillRect(-30, y - 26, 60, 52);
    ctx.restore();
  }

  private drawGlint(ctx: CanvasRenderingContext2D, amount: number) {
    const a = Math.sin(Math.PI * Math.min(1, amount)) ** 0.8;
    ctx.save();
    ctx.translate(-16, 30);
    const g = ctx.createRadialGradient(0, 0, 0, 0, 0, 10);
    g.addColorStop(0, `rgba(255,255,255,${a})`);
    g.addColorStop(0.3, `rgba(255,255,255,${a * 0.7})`);
    g.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = g;
    ctx.fillRect(-10, -10, 20, 20);
    ctx.fillStyle = `rgba(255,255,255,${a})`;
    const r = 7 + 9 * a;
    ctx.beginPath();
    ctx.moveTo(0, -r);
    ctx.lineTo(1, -1);
    ctx.lineTo(r, 0);
    ctx.lineTo(1, 1);
    ctx.lineTo(0, r);
    ctx.lineTo(-1, 1);
    ctx.lineTo(-r, 0);
    ctx.lineTo(-1, -1);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  private drawLiquid(ctx: CanvasRenderingContext2D, tube: Tube) {
    const now = this.now;
    const th = tube.th;
    ctx.save();
    traceCavity(ctx);
    ctx.clip();
    ctx.rotate(-th);
    const c = Math.cos(th);
    const tanTh =
      Math.abs(c) > 0.2 ? Math.tan(th) : Math.sign(Math.sin(th) * c) * 4.9;
    const axisX = (t: number) => clamp(-t * tanTh, -200, 200);
    const alive = this.alive;
    const idleRipple = 0.34 * alive;
    const ripple = tube.ripple + idleRipple;
    const tilt = Math.tan(
      tube.tilt + 0.006 * alive * Math.sin(tube.phase * 0.7 + tube.index),
    );
    const phase = tube.phase;
    const finale = this.finaleAt !== null;
    const surfaceRipple = (x: number) =>
      finale
        ? 0
        : ripple *
          (0.6 * Math.sin(0.42 * x - now * 0.011 + phase) +
            0.4 * Math.sin(0.8 * x + now * 0.016 + phase * 1.3));
    const heaveScale = Math.max(0, c);
    const heave = tube.heave * heaveScale;
    const levels = tube.levels;
    const ordered = tube.ordered;
    const last = ordered.length - 1;
    const doneLift = tube.cork * 0.1;
    const xs: number[] = [];
    const span = Math.abs(c) > 0.94 ? 40 : 220;
    for (let x = -span; x <= span; x += 4) xs.push(x);

    const topLine = (x: number, t: number, xa: number) =>
      t + tilt * (x - xa) + heave + surfaceRipple(x);
    const boundaryLine = (x: number, t: number, xa: number, seg: Seg) =>
      t +
      tilt * 0.55 * (x - xa) +
      heave * 0.25 +
      seg.wave * Math.sin(0.4 * x + now * 0.014 + phase);

    for (let k = last; k >= 0; k--) {
      const seg = ordered[k] as Seg;
      const t = levels[k] ?? 194;
      const xa = axisX(t);
      const color = liquidColor(seg.color);
      const g = ctx.createLinearGradient(0, t - 4, 0, t + 150);
      g.addColorStop(
        0,
        doneLift ? mix(color.light, "#ffffff", doneLift) : color.light,
      );
      g.addColorStop(1, color.deep);
      ctx.fillStyle = g;
      ctx.globalAlpha = 0.96;
      ctx.beginPath();
      xs.forEach((x, i) => {
        const y =
          k === last
            ? topLine(x, t, xa)
            : boundaryLine(x, t, xa, ordered[k + 1] as Seg);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.lineTo(span, 400);
      ctx.lineTo(-span, 400);
      ctx.closePath();
      ctx.fill();
      ctx.globalAlpha = 1;
    }

    // 層の境の光る線（奥の弧は上の液越しに透ける）
    const absC = Math.abs(c);
    const rx = Math.min(220, 22.5 / Math.max(0.1, absC));
    const ry = 3.2 * Math.max(0.2, absC);
    for (let k = 0; k < last; k++) {
      const upper = ordered[k + 1] as Seg;
      if (upper.line <= 0.01 || upper.amount < 0.03) continue;
      const t = levels[k] ?? 194;
      const xa = axisX(t);
      const color = liquidColor((ordered[k] as Seg).color);
      const arc = (from: number, to: number) => {
        ctx.beginPath();
        for (let i = 0; i <= 24; i++) {
          const a = from + ((to - from) * i) / 24;
          const x = xa + rx * Math.cos(a);
          const y = boundaryLine(x, t, xa, upper) + ry * Math.sin(a);
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
      };
      ctx.globalAlpha = 0.5 * upper.line;
      ctx.strokeStyle = mix(color.light, "#ffffff", 0.6);
      ctx.lineWidth = 0.7;
      arc(Math.PI, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = 0.3 * upper.line;
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 2.4;
      arc(0, Math.PI);
      ctx.stroke();
      ctx.globalAlpha = 0.95 * upper.line;
      ctx.lineWidth = 0.9;
      arc(0, Math.PI);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }

    // 液面
    const topSeg = ordered[last];
    if (topSeg) {
      const t = levels[last] ?? 194;
      const xa = axisX(t);
      const color = liquidColor(topSeg.color);
      const point = (a: number) => {
        const x = xa + rx * Math.cos(a);
        return [x, topLine(x, t, xa) + ry * Math.sin(a)] as const;
      };
      ctx.beginPath();
      for (let i = 0; i <= 40; i++) {
        const [x, y] = point((i / 40) * Math.PI * 2);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.closePath();
      ctx.globalAlpha = 0.95;
      ctx.fillStyle = doneLift
        ? mix(color.light, "#ffffff", 0.42 + doneLift)
        : color.surface;
      ctx.fill();
      ctx.globalAlpha = 0.9;
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let i = 0; i <= 24; i++) {
        const [x, y] = point((i / 24) * Math.PI);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
      ctx.globalAlpha = 0.55;
      ctx.lineWidth = 0.8;
      ctx.beginPath();
      for (let i = 0; i <= 12; i++) {
        const [x, y] = point(Math.PI * 1.1 + (i / 12) * Math.PI * 0.55);
        if (i === 0) ctx.moveTo(x, y - 0.6);
        else ctx.lineTo(x, y - 0.6);
      }
      ctx.stroke();
      ctx.globalAlpha = 1;

      for (const ring of tube.rings) {
        const age = (now - ring.t0) / 520;
        const r = 3 + age * 15 * ring.amp;
        ctx.globalAlpha = (1 - age) * 0.8;
        ctx.strokeStyle = "#ffffff";
        ctx.lineWidth = 0.9;
        ctx.beginPath();
        const cy = topLine(ring.x, t, xa) + 0.6;
        ctx.ellipse(
          ring.x,
          cy,
          r,
          r * 0.2 * Math.max(0.3, absC),
          0,
          0,
          Math.PI * 2,
        );
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
    }
    for (const bubble of tube.bubbles) {
      const age = (now - bubble.t0) / 700;
      ctx.globalAlpha = 0.7 * (1 - age);
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 0.6;
      ctx.beginPath();
      ctx.arc(bubble.x, bubble.y, bubble.r, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    ctx.restore();
  }

  private drawStream(ctx: CanvasRenderingContext2D, pour: Pour) {
    const { src } = pour;
    const now = this.now;
    type P = { x: number; y: number; w: number };
    const points: P[] = [];
    const width = (rate: number, age: number) =>
      clamp(1.2 + 2000 * rate, 1.4, 14) / (1 + age / 600);
    if (pour.rate > 0 && src.ctrl === pour) {
      const c = Math.cos(src.th);
      const s = Math.sin(src.th);
      points.push({
        x: src.x + c * pour.lipX - s * pour.lipY,
        y: src.y + s * pour.lipX + c * pour.lipY,
        w: width(pour.rate, 0),
      });
    }
    for (let i = pour.particles.length - 1; i >= 0; i--) {
      const p = pour.particles[i] as Particle;
      points.push({ x: p.x, y: p.y, w: width(p.rate, now - p.born) });
    }
    if (points.length < 2) return;
    const color = liquidColor(pour.color);
    const left: [number, number][] = [];
    const right: [number, number][] = [];
    points.forEach((p, i) => {
      const a = points[Math.max(0, i - 1)] as P;
      const b = points[Math.min(points.length - 1, i + 1)] as P;
      let nx = -(b.y - a.y);
      let ny = b.x - a.x;
      const len = Math.hypot(nx, ny) || 1;
      nx /= len;
      ny /= len;
      left.push([p.x + (nx * p.w) / 2, p.y + (ny * p.w) / 2]);
      right.push([p.x - (nx * p.w) / 2, p.y - (ny * p.w) / 2]);
    });
    const smoothPath = (pts: [number, number][], move: boolean) => {
      const first = pts[0] as [number, number];
      if (move) ctx.moveTo(first[0], first[1]);
      else ctx.lineTo(first[0], first[1]);
      for (let i = 1; i < pts.length - 1; i++) {
        const p = pts[i] as [number, number];
        const q = pts[i + 1] as [number, number];
        ctx.quadraticCurveTo(p[0], p[1], (p[0] + q[0]) / 2, (p[1] + q[1]) / 2);
      }
      const end = pts[pts.length - 1] as [number, number];
      ctx.lineTo(end[0], end[1]);
    };
    ctx.beginPath();
    smoothPath(left, true);
    smoothPath([...right].reverse(), false);
    ctx.closePath();
    ctx.fillStyle = color.deep;
    ctx.globalAlpha = 0.9;
    ctx.lineWidth = 0.9;
    ctx.strokeStyle = color.deep;
    ctx.stroke();
    ctx.globalAlpha = 1;
    const g = ctx.createLinearGradient(
      0,
      (points[0] as P).y,
      0,
      (points[points.length - 1] as P).y,
    );
    g.addColorStop(0, color.light);
    g.addColorStop(1, mix(color.light, color.deep, 0.35));
    ctx.fillStyle = g;
    ctx.fill();
    // 筋の左の光
    ctx.beginPath();
    const hl = points.map((p, i) => {
      const l = left[i] as [number, number];
      return [lerp(p.x, l[0], 0.45), lerp(p.y, l[1], 0.45)] as [number, number];
    });
    smoothPath(hl, true);
    ctx.strokeStyle = "rgba(255,255,255,0.6)";
    ctx.lineWidth = Math.max(
      0.5,
      Math.min(2.2, ((points[0] as P).w || 2) * 0.22),
    );
    ctx.lineCap = "round";
    ctx.stroke();
  }
}
