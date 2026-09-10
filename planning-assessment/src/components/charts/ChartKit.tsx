'use client';

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

const PALETTE = ['#1d4ed8', '#0ea5e9', '#14b8a6', '#84cc16', '#f59e0b', '#f97316', '#ef4444', '#a855f7'];

export function SimpleBarChart({ data, dataKey = 'value', nameKey = 'name', height = 260, horizontal = false }: { data: Array<Record<string, unknown>>; dataKey?: string; nameKey?: string; height?: number; horizontal?: boolean }) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} layout={horizontal ? 'vertical' : 'horizontal'} margin={{ top: 4, right: 8, left: 0, bottom: 4 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
        {horizontal ? (
          <>
            <XAxis type="number" tick={{ fontSize: 11 }} />
            <YAxis type="category" dataKey={nameKey} tick={{ fontSize: 11 }} width={140} />
          </>
        ) : (
          <>
            <XAxis dataKey={nameKey} tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} />
          </>
        )}
        <Tooltip />
        <Bar dataKey={dataKey} radius={[4, 4, 4, 4]}>
          {data.map((_, i) => (
            <Cell key={i} fill={PALETTE[i % PALETTE.length]} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

export function SimplePieChart({ data, dataKey = 'value', nameKey = 'name', height = 260 }: { data: Array<Record<string, unknown>>; dataKey?: string; nameKey?: string; height?: number }) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <PieChart>
        <Pie data={data} dataKey={dataKey} nameKey={nameKey} innerRadius={55} outerRadius={90} paddingAngle={2}>
          {data.map((_, i) => (
            <Cell key={i} fill={PALETTE[i % PALETTE.length]} />
          ))}
        </Pie>
        <Legend verticalAlign="bottom" height={36} wrapperStyle={{ fontSize: 11 }} />
        <Tooltip />
      </PieChart>
    </ResponsiveContainer>
  );
}

const RADAR_LABEL_ABBREVIATIONS: Record<string, string> = {
  'Planning & CPM': 'Planning & CPM',
  'Primavera P6': 'Primavera P6',
  'Schedule Analysis': 'Schedule Analysis',
  'Project Controls / EVM': 'Proj. Controls / EVM',
  'Delay / Claims': 'Delay / Claims',
  'Construction Methodology': 'Construction Method.',
  'Analytical Thinking': 'Analytical Thinking',
  'Management / Communication / Ethics': 'Mgmt / Comms / Ethics',
};

export function CompetencyRadar({ data, height = 320 }: { data: Array<{ competency: string; score: number }>; height?: number }) {
  const shortened = data.map((d) => ({ ...d, competency: RADAR_LABEL_ABBREVIATIONS[d.competency] ?? d.competency }));
  return (
    <ResponsiveContainer width="100%" height={height}>
      <RadarChart data={shortened} margin={{ top: 16, right: 48, bottom: 16, left: 48 }} outerRadius="62%">
        <PolarGrid stroke="#e2e8f0" />
        <PolarAngleAxis dataKey="competency" tick={{ fontSize: 10 }} />
        <PolarRadiusAxis domain={[0, 100]} tick={{ fontSize: 9 }} />
        <Radar dataKey="score" stroke="#1d4ed8" fill="#1d4ed8" fillOpacity={0.35} />
        <Tooltip />
      </RadarChart>
    </ResponsiveContainer>
  );
}

export { PALETTE };
