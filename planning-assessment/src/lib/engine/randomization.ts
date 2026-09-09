/** Fisher-Yates shuffle — used for question order and option order (§49 anti-memorization). */
export function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function sampleWithoutReplacement<T>(arr: T[], n: number): T[] {
  return shuffle(arr).slice(0, Math.min(n, arr.length));
}

/** Weighted round-robin sampler: distributes `total` picks across buckets proportional to `weights`, at least `minEach` per non-empty bucket where possible. */
export function proportionalAllocation(
  buckets: { key: string; weight: number; available: number; minEach?: number }[],
  total: number,
): Record<string, number> {
  const result: Record<string, number> = {};
  const weightSum = buckets.reduce((s, b) => s + b.weight, 0) || 1;
  let allocated = 0;

  for (const b of buckets) {
    const min = Math.min(b.minEach ?? 0, b.available);
    result[b.key] = min;
    allocated += min;
  }

  let remaining = Math.max(0, total - allocated);
  const order = shuffle([...buckets]);
  while (remaining > 0) {
    let progressed = false;
    for (const b of order) {
      if (remaining <= 0) break;
      const share = Math.max(1, Math.round((b.weight / weightSum) * total));
      if (result[b.key] < Math.min(b.available, share)) {
        result[b.key]++;
        remaining--;
        progressed = true;
      }
    }
    if (!progressed) {
      // weights exhausted their shares — top up from any bucket with room left
      for (const b of order) {
        if (remaining <= 0) break;
        if (result[b.key] < b.available) {
          result[b.key]++;
          remaining--;
          progressed = true;
        }
      }
      if (!progressed) break; // no capacity left anywhere
    }
  }
  return result;
}
