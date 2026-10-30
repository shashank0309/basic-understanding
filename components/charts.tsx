"use client";
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis, Line, ComposedChart } from "recharts";

const BASE = "#94a3b8";
const AI = "var(--brand)";

export function StepChart({ data }: { data: { name: string; baseline: number; withAi: number }[] }) {
  return (
    <div className="h-72 w-full">
      <ResponsiveContainer>
        <BarChart data={data} margin={{ top: 8, right: 8, bottom: 40, left: 8 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="name" tick={{ fontSize: 11 }} interval={0} angle={-20} textAnchor="end" height={60} />
          <YAxis tick={{ fontSize: 11 }} label={{ value: "hours / year", angle: -90, position: "insideLeft", fontSize: 11 }} />
          <Tooltip formatter={(v: number) => `${Math.round(v).toLocaleString("en-IN")} h`} />
          <Legend verticalAlign="top" />
          <Bar dataKey="baseline" name="Baseline" fill={BASE} radius={[3, 3, 0, 0]} />
          <Bar dataKey="withAi" name="With AI" fill={AI} radius={[3, 3, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function YearChart({ data }: { data: { year: string; benefit: number; cost: number; cumulative: number }[] }) {
  return (
    <div className="h-64 w-full">
      <ResponsiveContainer>
        <ComposedChart data={data} margin={{ top: 8, right: 8, bottom: 8, left: 8 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="year" tick={{ fontSize: 11 }} />
          <YAxis tick={{ fontSize: 11 }} tickFormatter={(v: number) => `${(v / 1e5).toFixed(0)}L`} />
          <Tooltip formatter={(v: number) => `₹${(v / 1e5).toFixed(2)} L`} />
          <Legend verticalAlign="top" />
          <Bar dataKey="benefit" name="Benefit" fill={AI} radius={[3, 3, 0, 0]} />
          <Bar dataKey="cost" name="Cost" fill="#f59e0b" radius={[3, 3, 0, 0]} />
          <Line dataKey="cumulative" name="Cumulative net" stroke="#0f172a" strokeWidth={2} dot />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

export function ExpectedActualChart({ data }: { data: { name: string; expected: number; actual: number }[] }) {
  return (
    <div className="h-72 w-full">
      <ResponsiveContainer>
        <BarChart data={data} margin={{ top: 8, right: 8, bottom: 40, left: 8 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="name" tick={{ fontSize: 11 }} interval={0} angle={-15} textAnchor="end" height={60} />
          <YAxis tick={{ fontSize: 11 }} tickFormatter={(v: number) => `${(v / 1e5).toFixed(0)}L`} />
          <Tooltip formatter={(v: number) => `₹${(v / 1e5).toFixed(2)} L`} />
          <Legend verticalAlign="top" />
          <Bar dataKey="expected" name="Expected" fill={BASE} radius={[3, 3, 0, 0]} />
          <Bar dataKey="actual" name="Realized" fill={AI} radius={[3, 3, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
