import { useState } from 'react';
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { cn } from '../../lib/utils';

/**
 * Categorical order validated with the dataviz palette checker (light surface, CVD-safe adjacent pairs).
 * Assign by entity, in this fixed order — never cycle.
 */
export const CHART_COLORS = ['#1f8a66', '#3b78c4', '#c9803a', '#7a6bd0', '#c24e6a'];
const GRID = '#eae2d5';
const AXIS = '#8a7f6e';

function ChartTooltip({ active, payload, label, format, labelFormat, name }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-sand-200 bg-white px-3 py-2 text-xs shadow-lift" dir="auto">
      <p className="mb-1 font-semibold text-stone-500">{labelFormat ? labelFormat(label) : label}</p>
      {payload.map((p) => (
        <p key={p.dataKey} className="flex items-center gap-2 font-bold text-ink">
          <span className="size-2 rounded-full" style={{ background: p.color || p.fill }} />
          {name && <span className="font-medium text-stone-500">{name}</span>}
          <span className="num">{format ? format(p.value) : p.value}</span>
        </p>
      ))}
    </div>
  );
}

/** Single-series area trend. Title names the series, so no legend box. */
export function AreaTrend({ data, xKey = 'date', yKey, format, labelFormat, tickFormat, color = CHART_COLORS[0], height = 240, name }) {
  const gid = `g-${yKey}-${color.slice(1)}`;
  return (
    <div dir="ltr" style={{ height }} className="w-full min-w-0 max-w-full overflow-hidden">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 8, left: -14, bottom: 0 }}>
          <defs>
            <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.28} />
              <stop offset="100%" stopColor={color} stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke={GRID} strokeDasharray="3 4" vertical={false} />
          <XAxis dataKey={xKey} tick={{ fontSize: 10, fill: AXIS }} tickLine={false} axisLine={false} tickFormatter={tickFormat} minTickGap={16} />
          <YAxis tick={{ fontSize: 10, fill: AXIS }} tickLine={false} axisLine={false} width={40} tickFormatter={(v) => (v >= 1000 ? `${v / 1000}k` : v)} allowDecimals={false} />
          <Tooltip cursor={{ stroke: color, strokeWidth: 1, strokeDasharray: '3 3' }} content={<ChartTooltip format={format} labelFormat={labelFormat} name={name} />} />
          <Area type="monotone" dataKey={yKey} stroke={color} strokeWidth={2} fill={`url(#${gid})`} activeDot={{ r: 5, strokeWidth: 2, stroke: '#fff' }} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

export function BarTrend({ data, xKey = 'date', yKey, format, labelFormat, tickFormat, color = CHART_COLORS[1], height = 220, name }) {
  return (
    <div dir="ltr" style={{ height }} className="w-full min-w-0 max-w-full overflow-hidden">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid stroke={GRID} strokeDasharray="3 4" vertical={false} />
          <XAxis dataKey={xKey} tick={{ fontSize: 11, fill: AXIS }} tickLine={false} axisLine={false} tickFormatter={tickFormat} minTickGap={24} />
          <YAxis tick={{ fontSize: 11, fill: AXIS }} tickLine={false} axisLine={false} width={32} allowDecimals={false} />
          <Tooltip cursor={{ fill: 'rgb(31 77 63 / 0.05)' }} content={<ChartTooltip format={format} labelFormat={labelFormat} name={name} />} />
          <Bar dataKey={yKey} fill={color} radius={[4, 4, 0, 0]} maxBarSize={22} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Donut + always-present legend (identity is never colour alone). items: [{ key, label, value }] */
export function Donut({ items, centerLabel, format = (v) => v, colors = CHART_COLORS }) {
  const [active, setActive] = useState(null);
  const total = items.reduce((n, i) => n + i.value, 0);
  const current = active != null ? items[active] : null;
  return (
    <div className="flex flex-col items-center gap-5 w-full min-w-0 max-w-full overflow-hidden">
      <div className="relative size-44 shrink-0 mx-auto" dir="ltr">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={items}
              dataKey="value"
              nameKey="label"
              innerRadius="68%"
              outerRadius="100%"
              paddingAngle={items.length > 1 ? 2 : 0}
              stroke="none"
              onMouseLeave={() => setActive(null)}
              onMouseEnter={(_, i) => setActive(i)}
            >
              {items.map((it, i) => (
                <Cell key={it.key} fill={colors[i % colors.length]} opacity={active == null || active === i ? 1 : 0.35} />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 grid place-items-center text-center">
          <div>
            <div className="num text-2xl font-extrabold text-ink">{format(current ? current.value : total)}</div>
            <div className="max-w-[90px] truncate text-[10px] font-semibold text-stone-500">{current ? current.label : centerLabel}</div>
          </div>
        </div>
      </div>
      <ul className="w-full min-w-0 flex-1 space-y-1.5">
        {items.map((it, i) => (
          <li
            key={it.key}
            onMouseEnter={() => setActive(i)}
            onMouseLeave={() => setActive(null)}
            className={cn('flex items-center justify-between gap-3 rounded-lg px-2 py-1 text-xs transition-colors', active === i && 'bg-sand-100')}
          >
            <span className="flex min-w-0 items-center gap-2">
              <span className="size-2.5 shrink-0 rounded-sm" style={{ background: colors[i % colors.length] }} />
              <span className="truncate font-medium text-stone-600">{it.label}</span>
            </span>
            <span className="flex items-baseline gap-2">
              <span className="num font-bold text-ink">{format(it.value)}</span>
              {total > 0 && <span className="num w-10 text-end text-[11px] font-medium text-stone-400">{Math.round((it.value / total) * 100)}%</span>}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Ranked horizontal bars drawn in CSS: readable labels, direct values, one hue. */
export function HBarList({ items, format = (v) => v, color = CHART_COLORS[0], emptyLabel }) {
  const max = Math.max(1, ...items.map((i) => i.value));
  if (!items.length) return <p className="py-8 text-center text-sm text-stone-400">{emptyLabel}</p>;
  return (
    <ul className="space-y-3.5">
      {items.map((it) => (
        <li key={it.key || it.label} title={`${it.label}: ${format(it.value)}`}>
          <div className="mb-1 flex items-baseline justify-between gap-3 text-xs">
            <span className="min-w-0 truncate font-semibold text-ink">{it.label}</span>
            <span className="flex shrink-0 items-baseline gap-2">
              {it.sub && <span className="num text-[11px] font-medium text-stone-400">{it.sub}</span>}
              <span className="num font-bold text-ink">{format(it.value)}</span>
            </span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-sand-100">
            <div className="h-full rounded-full transition-[width] duration-700" style={{ width: `${Math.max(2, (it.value / max) * 100)}%`, background: it.color || color }} />
          </div>
        </li>
      ))}
    </ul>
  );
}

/** Sequential single-hue ramp (light → dark) for 0–100 values. */
export const heatColor = (v) => {
  if (v <= 0) return '#f5f1ea';
  const stops = ['#d5e8df', '#a2d1bd', '#5fb192', '#2b8f6c', '#1a6a4f', '#114a37'];
  return stops[Math.min(stops.length - 1, Math.floor((v / 100) * stops.length))];
};
export const heatText = (v) => (v >= 45 ? '#fff' : '#1b2420');
