// Earned Value Management calculations.
// BAC = Current Budget (Budget At Completion)
// PV  = Planned Value = BAC x Planned % complete (as of date)
// EV  = Earned Value  = BAC x Actual % complete
// AC  = Actual Cost (+ committed/accrued exposure is reported separately, not mixed into AC)
// CV  = EV - AC            SV  = EV - PV
// CPI = EV / AC             SPI = EV / PV
// TCPI = (BAC - EV) / (BAC - AC)   -- efficiency required on remaining work to hit BAC

export interface EVMInputs {
  bac: number;
  plannedPercent: number; // 0..100
  actualPercent: number; // 0..100
  actualCost: number;
}

export interface EVMResult {
  bac: number;
  pv: number;
  ev: number;
  ac: number;
  cv: number;
  sv: number;
  cpi: number;
  spi: number;
  tcpi: number;
}

export function computeEVM({ bac, plannedPercent, actualPercent, actualCost }: EVMInputs): EVMResult {
  const pv = round2(bac * (plannedPercent / 100));
  const ev = round2(bac * (actualPercent / 100));
  const ac = round2(actualCost);
  const cv = round2(ev - ac);
  const sv = round2(ev - pv);
  const cpi = ac !== 0 ? round4(ev / ac) : ev > 0 ? 0 : 1;
  const spi = pv !== 0 ? round4(ev / pv) : ev > 0 ? 0 : 1;
  const remainingWork = bac - ev;
  const remainingBudget = bac - ac;
  const tcpi = remainingBudget !== 0 ? round4(remainingWork / remainingBudget) : 1;
  return { bac, pv, ev, ac, cv, sv, cpi, spi, tcpi };
}

function round2(n: number) {
  return Math.round(n * 100) / 100;
}
function round4(n: number) {
  return Math.round(n * 10000) / 10000;
}
