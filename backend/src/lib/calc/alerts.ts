export type AlertSeverity = "GREEN" | "YELLOW" | "RED" | "BLACK";

export interface AlertRuleLike {
  metric: string;
  operator: "LT" | "LTE" | "GT" | "GTE" | "EQ";
  threshold: number;
  severity: AlertSeverity;
}

const SEVERITY_RANK: Record<AlertSeverity, number> = { GREEN: 0, YELLOW: 1, RED: 2, BLACK: 3 };

// Given a metric value and the set of configured rules for that metric, returns
// the most severe matching rule (rules are project-configurable, never hard-coded).
export function evaluateMetric(
  metricValue: number,
  rules: AlertRuleLike[]
): { severity: AlertSeverity; rule: AlertRuleLike | null } {
  let best: AlertRuleLike | null = null;
  for (const rule of rules) {
    const hit = matches(metricValue, rule);
    if (hit && (!best || SEVERITY_RANK[rule.severity] > SEVERITY_RANK[best.severity])) {
      best = rule;
    }
  }
  return { severity: best?.severity ?? "GREEN", rule: best };
}

function matches(value: number, rule: AlertRuleLike): boolean {
  switch (rule.operator) {
    case "LT":
      return value < rule.threshold;
    case "LTE":
      return value <= rule.threshold;
    case "GT":
      return value > rule.threshold;
    case "GTE":
      return value >= rule.threshold;
    case "EQ":
      return value === rule.threshold;
    default:
      return false;
  }
}

// Sensible starting defaults (still stored as editable AlertRule rows, not code constants).
export const DEFAULT_ALERT_RULES: Record<string, AlertRuleLike[]> = {
  CPI: [
    { metric: "CPI", operator: "GTE", threshold: 1.0, severity: "GREEN" },
    { metric: "CPI", operator: "LT", threshold: 1.0, severity: "YELLOW" },
    { metric: "CPI", operator: "LT", threshold: 0.85, severity: "RED" },
    { metric: "CPI", operator: "LT", threshold: 0.65, severity: "BLACK" },
  ],
  SPI: [
    { metric: "SPI", operator: "GTE", threshold: 1.0, severity: "GREEN" },
    { metric: "SPI", operator: "LT", threshold: 1.0, severity: "YELLOW" },
    { metric: "SPI", operator: "LT", threshold: 0.85, severity: "RED" },
    { metric: "SPI", operator: "LT", threshold: 0.65, severity: "BLACK" },
  ],
};
