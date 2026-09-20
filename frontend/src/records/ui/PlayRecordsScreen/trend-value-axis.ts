import type { PlayRecordMetricAxisDisplay } from "@/records/ui/play-record-display";

const DOMAIN_PADDING_RATIO = 0.1;
const TARGET_TICK_INTERVAL_COUNT = 5;
const SECOND_MS = 1_000;
const MINUTE_MS = 60 * SECOND_MS;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;
const DURATION_TICK_STEPS_MS = [
  SECOND_MS,
  2 * SECOND_MS,
  5 * SECOND_MS,
  10 * SECOND_MS,
  15 * SECOND_MS,
  30 * SECOND_MS,
  MINUTE_MS,
  2 * MINUTE_MS,
  5 * MINUTE_MS,
  10 * MINUTE_MS,
  15 * MINUTE_MS,
  30 * MINUTE_MS,
  HOUR_MS,
  2 * HOUR_MS,
  3 * HOUR_MS,
  6 * HOUR_MS,
  12 * HOUR_MS,
  DAY_MS,
] as const;

type TrendValueAxis = {
  domain: [number, number];
  ticks?: number[];
};

function getPaddedDomain(values: readonly number[]): [number, number] {
  const dataMinimum = Math.min(...values);
  const dataMaximum = Math.max(...values);
  const span = dataMaximum - dataMinimum;
  const padding =
    span === 0
      ? Math.max(Math.abs(dataMinimum) * DOMAIN_PADDING_RATIO, 1)
      : span * DOMAIN_PADDING_RATIO;

  return [dataMinimum - padding, dataMaximum + padding];
}

function getNiceNumericStep(roughStep: number): number {
  if (roughStep <= 1) {
    return 1;
  }

  const magnitude = 10 ** Math.floor(Math.log10(roughStep));
  const normalizedStep = roughStep / magnitude;

  if (normalizedStep < 1.5) {
    return magnitude;
  }
  if (normalizedStep < 3.5) {
    return 2 * magnitude;
  }
  if (normalizedStep < 7.5) {
    return 5 * magnitude;
  }
  return 10 * magnitude;
}

function getNiceIntegerStep(span: number): number {
  return getNiceNumericStep(span / TARGET_TICK_INTERVAL_COUNT);
}

function getNiceDurationStep(spanMs: number): number {
  const roughStepMs = spanMs / TARGET_TICK_INTERVAL_COUNT;
  const predefinedStep = DURATION_TICK_STEPS_MS.find(
    (step) => step >= roughStepMs,
  );
  if (predefinedStep !== undefined) {
    return predefinedStep;
  }

  return getNiceNumericStep(roughStepMs / DAY_MS) * DAY_MS;
}

function getTickRange(
  values: readonly number[],
  domain: readonly [number, number],
  axis: PlayRecordMetricAxisDisplay,
): [number, number] {
  const dataMinimum = Math.min(...values);
  const dataMaximum = Math.max(...values);
  const minimum =
    axis.minimum !== undefined && dataMinimum >= axis.minimum
      ? Math.max(domain[0], axis.minimum)
      : domain[0];
  const maximum =
    axis.maximum !== undefined && dataMaximum <= axis.maximum
      ? Math.min(domain[1], axis.maximum)
      : domain[1];

  return [minimum, maximum];
}

function getTicks(range: readonly [number, number], step: number): number[] {
  const [minimum, maximum] = range;
  const firstTick = Math.ceil(minimum / step) * step;
  const lastTick = Math.floor(maximum / step) * step;

  if (firstTick > lastTick) {
    return [Math.round((minimum + maximum) / 2)];
  }

  const ticks: number[] = [];
  for (let value = firstTick; value <= lastTick; value += step) {
    ticks.push(Object.is(value, -0) ? 0 : value);
  }
  return ticks;
}

function getAxisTicks(
  values: readonly number[],
  domain: readonly [number, number],
  axis: PlayRecordMetricAxisDisplay,
): number[] {
  const range = getTickRange(values, domain, axis);
  const span = range[1] - range[0];
  const step =
    axis.kind === "integer"
      ? getNiceIntegerStep(span)
      : getNiceDurationStep(span);
  return getTicks(range, step);
}

export function getTrendValueAxis(
  values: readonly number[],
  axis: PlayRecordMetricAxisDisplay | undefined,
): TrendValueAxis {
  const domain = getPaddedDomain(values);
  return axis
    ? { domain, ticks: getAxisTicks(values, domain, axis) }
    : { domain };
}
