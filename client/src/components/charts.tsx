import {
  Area,
  AreaChart,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Skeleton } from "./ui.js";
import { cn } from "../lib/utils.js";

export interface CandlePoint {
  time: string;
  close: string;
  open?: string;
  high?: string;
  low?: string;
}

function formatTickTime(iso: string, spanDays: number): string {
  const d = new Date(iso);
  if (spanDays <= 1)
    return d.toLocaleTimeString("en-CA", { hour: "numeric", minute: "2-digit" });
  if (spanDays <= 30) return d.toLocaleDateString("en-CA", { month: "short", day: "numeric" });
  return d.toLocaleDateString("en-CA", { month: "short", year: "2-digit" });
}

export function PriceChart({
  data,
  spanDays,
  loading,
  height = 280,
  color,
}: {
  data: CandlePoint[];
  spanDays: number;
  loading?: boolean;
  height?: number;
  color?: string;
}) {
  if (loading) {
    return <Skeleton className="w-full" />;
  }
  if (!data.length) {
    return (
      <div className="flex items-center justify-center h-40 text-sm text-ink-dim">
        No chart data available.
      </div>
    );
  }

  const first = Number(data[0]!.close);
  const last = Number(data[data.length - 1]!.close);
  const up = last >= first;
  const stroke = color ?? (up ? "#34d399" : "#f87171");

  const points = data.map((d) => ({
    time: d.time,
    close: Number(d.close),
    label: formatTickTime(d.time, spanDays),
  }));

  return (
    <div style={{ height }} className="w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={points} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
          <defs>
            <linearGradient id={`grad-${stroke.slice(1)}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={stroke} stopOpacity={0.25} />
              <stop offset="100%" stopColor={stroke} stopOpacity={0} />
            </linearGradient>
          </defs>
          <XAxis
            dataKey="label"
            tick={{ fill: "#64748b", fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            minTickGap={40}
          />
          <YAxis
            domain={["auto", "auto"]}
            tick={{ fill: "#64748b", fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            width={64}
            tickFormatter={(v: number) => `$${v.toFixed(2)}`}
          />
          <Tooltip
            contentStyle={{
              background: "#111a2e",
              border: "1px solid #1e2a44",
              borderRadius: 12,
              color: "#e7ecf5",
              fontSize: 12,
            }}
            formatter={(value: number) => [`$${value.toFixed(2)}`, "Price"]}
          />
          <Area
            type="monotone"
            dataKey="close"
            stroke={stroke}
            strokeWidth={2}
            fill={`url(#grad-${stroke.slice(1)})`}
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

export function Sparkline({
  values,
  up,
  width = 96,
  height = 32,
}: {
  values: number[];
  up: boolean;
  width?: number;
  height?: number;
}) {
  if (values.length < 2) return <div style={{ width, height }} />;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const pts = values
    .map((v, i) => {
      const x = (i / (values.length - 1)) * width;
      const y = height - ((v - min) / range) * height;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
  return (
    <svg width={width} height={height} aria-hidden className="overflow-visible">
      <polyline
        points={pts}
        fill="none"
        stroke={up ? "#34d399" : "#f87171"}
        strokeWidth={1.5}
      />
    </svg>
  );
}

export function AllocationPie({
  slices,
}: {
  slices: { name: string; value: number }[];
}) {
  const colors = ["#6366f1", "#34d399", "#f59e0b", "#f87171", "#06b6d4", "#a78bfa", "#fbbf24", "#84cc16"];
  if (!slices.length) return null;
  return (
    <div className="h-56 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={slices}
            dataKey="value"
            nameKey="name"
            innerRadius={55}
            outerRadius={85}
            paddingAngle={2}
            stroke="none"
          >
            {slices.map((_, i) => (
              <Cell key={i} fill={colors[i % colors.length]} />
            ))}
          </Pie>
          <Tooltip
            contentStyle={{
              background: "#111a2e",
              border: "1px solid #1e2a44",
              borderRadius: 12,
              color: "#e7ecf5",
              fontSize: 12,
            }}
            formatter={(value: number, name: string) => [
              `$${value.toFixed(2)}`,
              name,
            ]}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}

export function ChartLegend({ up, label }: { up: boolean; label: string }) {
  return (
    <span className={cn("text-xs", up ? "text-up" : "text-down")}>{label}</span>
  );
}
