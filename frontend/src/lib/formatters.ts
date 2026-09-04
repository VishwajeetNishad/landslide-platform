/**
 * Strict wording and formatting helper utilities for Landslide Early Warning
 * strictly distinguishing model estimates from confirmed real-world impacts.
 */

export function formatProbability(prob: number | null | undefined): string {
  if (prob == null || isNaN(prob)) return 'Unavailable';
  const pct = prob <= 1 ? Math.round(prob * 100) : Math.round(prob);
  return `${pct}%`;
}

export function formatConfidenceInterval(lower: number | null | undefined, upper: number | null | undefined): string {
  if (lower == null || upper == null || isNaN(lower) || isNaN(upper)) return 'Unavailable';
  const l = lower <= 1 ? Math.round(lower * 100) : Math.round(lower);
  const u = upper <= 1 ? Math.round(upper * 100) : Math.round(upper);
  return `${l}% - ${u}%`;
}

export function formatExposedPopulation(count: number | null | undefined): string {
  if (count == null || isNaN(count)) return 'Not assessed';
  return `Estimated potentially exposed population: ${count.toLocaleString()}`;
}

export function formatAffectedRoad(metres: number | null | undefined): string {
  if (metres == null || isNaN(metres)) return 'Not assessed';
  return `Potentially affected road length: ${metres.toLocaleString()} m`;
}

export function formatShapValue(val: number | null | undefined): string {
  if (val == null || isNaN(val)) return 'Unavailable';
  return val.toFixed(2);
}

export function formatTimestamp(tsString: string | null | undefined): string {
  if (!tsString) return 'Unavailable';
  return tsString;
}

export function formatPercent(prob: number | null | undefined): string {
  if (prob == null || isNaN(prob)) return 'N/A';
  const pct = prob <= 1 ? (prob * 100).toFixed(1) : prob.toFixed(1);
  return `${pct}%`;
}

export function formatScore(score: number | null | undefined): string {
  if (score == null || isNaN(score)) return 'N/A';
  return score.toFixed(2);
}

export function formatCount(count: number | null | undefined): string {
  if (count == null || isNaN(count)) return '0';
  return count.toLocaleString();
}

export function formatDateTime(ts: string | null | undefined): string {
  if (!ts) return 'Not recorded';
  try {
    const d = new Date(ts);
    if (isNaN(d.getTime())) return ts;
    return d.toLocaleString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return ts;
  }
}

