import { useMemo, useState } from "react";
import { formatCurrency } from "../core/currencyFormat";

export interface ChartDataPoint {
	label: string;
	value: number;
	/** Etiqueta secundaria opcional que se muestra en el tooltip */
	detail?: string;
}

interface IncomeBarChartProps {
	data: ChartDataPoint[];
	title?: string;
	height?: number;
	/** Color de las barras en formato Tailwind (clase fill-*). Default: emerald */
	accentColor?: "emerald" | "sky" | "amber";
}

const COLORS = {
	emerald: { bar: "#059669", barHover: "#047857", gradient: ["#10b981", "#059669"] },
	sky: { bar: "#0284c7", barHover: "#0369a1", gradient: ["#38bdf8", "#0284c7"] },
	amber: { bar: "#d97706", barHover: "#b45309", gradient: ["#fbbf24", "#d97706"] },
} as const;

const PADDING = { top: 24, right: 16, bottom: 48, left: 72 };
const MIN_BAR_WIDTH = 14;
const MAX_BAR_WIDTH = 64;
const BAR_GAP_RATIO = 0.3;

function niceMax(maxVal: number): number {
	if (maxVal <= 0) return 100_000;
	const magnitude = 10 ** Math.floor(Math.log10(maxVal));
	const normalized = maxVal / magnitude;
	const nice = normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 5 ? 5 : 10;
	return nice * magnitude;
}

function generateTicks(maxVal: number, targetCount: number): number[] {
	const ceil = niceMax(maxVal);
	const step = ceil / targetCount;
	const ticks: number[] = [];
	for (let i = 0; i <= targetCount; i++) {
		ticks.push(Math.round(step * i));
	}
	return ticks;
}

function formatCompact(value: number): string {
	if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
	if (value >= 1_000) return `${(value / 1_000).toFixed(0)}K`;
	return value.toString();
}

export function IncomeBarChart({
	data,
	title,
	height = 260,
	accentColor = "emerald",
}: IncomeBarChartProps) {
	const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

	const colors = COLORS[accentColor];
	const gradientId = `barGrad-${accentColor}`;

	const maxValue = useMemo(() => Math.max(...data.map((d) => d.value), 0), [data]);
	const ticks = useMemo(() => generateTicks(maxValue, 4), [maxValue]);
	const ceilValue = ticks[ticks.length - 1] ?? 1;

	const chartWidth = useMemo(() => {
		const n = data.length;
		if (n === 0) return 400;
		const idealBarWidth = Math.min(MAX_BAR_WIDTH, Math.max(MIN_BAR_WIDTH, 600 / n));
		const cellWidth = idealBarWidth * (1 + BAR_GAP_RATIO);
		return Math.max(400, PADDING.left + PADDING.right + cellWidth * n);
	}, [data.length]);

	const drawableWidth = chartWidth - PADDING.left - PADDING.right;
	const drawableHeight = height - PADDING.top - PADDING.bottom;

	if (data.length === 0) {
		return (
			<div className="flex items-center justify-center rounded-xl border border-dashed border-slate-300 bg-slate-50/50 py-12">
				<p className="text-sm text-slate-400">Sin datos para graficar</p>
			</div>
		);
	}

	const cellWidth = drawableWidth / data.length;
	const barWidth = Math.min(MAX_BAR_WIDTH, cellWidth * (1 - BAR_GAP_RATIO));

	return (
		<section className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
			{title && (
				<div className="border-b border-slate-200 px-4 py-3">
					<h2 className="text-sm font-semibold text-slate-800">{title}</h2>
				</div>
			)}
			<div className="overflow-x-auto px-2 py-3">
				<svg
					width={chartWidth}
					height={height}
					viewBox={`0 0 ${chartWidth} ${height}`}
					className="select-none"
					role="img"
					aria-label={title ?? "Gráfico de ingresos"}
				>
					<defs>
						<linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
							<stop offset="0%" stopColor={colors.gradient[0]} />
							<stop offset="100%" stopColor={colors.gradient[1]} />
						</linearGradient>
					</defs>

					{/* Gridlines + Y-axis labels */}
					{ticks.map((tick) => {
						const y = PADDING.top + drawableHeight - (tick / ceilValue) * drawableHeight;
						return (
							<g key={tick}>
								<line
									x1={PADDING.left}
									x2={chartWidth - PADDING.right}
									y1={y}
									y2={y}
									stroke="#e2e8f0"
									strokeDasharray={tick === 0 ? "0" : "4 3"}
								/>
								<text
									x={PADDING.left - 8}
									y={y + 4}
									textAnchor="end"
									className="text-[10px] fill-slate-400"
								>
									{formatCompact(tick)}
								</text>
							</g>
						);
					})}

					{/* Baseline */}
					<line
						x1={PADDING.left}
						x2={chartWidth - PADDING.right}
						y1={PADDING.top + drawableHeight}
						y2={PADDING.top + drawableHeight}
						stroke="#cbd5e1"
					/>

					{/* Bars + X-axis labels */}
					{data.map((point, i) => {
						const barHeight = ceilValue > 0 ? (point.value / ceilValue) * drawableHeight : 0;
						const x = PADDING.left + cellWidth * i + (cellWidth - barWidth) / 2;
						const y = PADDING.top + drawableHeight - barHeight;
						const isHovered = hoveredIndex === i;

						return (
							<g
								key={point.label}
								onMouseEnter={() => setHoveredIndex(i)}
								onMouseLeave={() => setHoveredIndex(null)}
								style={{ cursor: "default" }}
							>
								{/* Hit area (wider for thin bars) */}
								<rect
									x={PADDING.left + cellWidth * i}
									y={PADDING.top}
									width={cellWidth}
									height={drawableHeight + PADDING.bottom}
									fill="transparent"
								/>

								{/* Bar */}
								<rect
									x={x}
									y={y}
									width={barWidth}
									height={Math.max(barHeight, 0)}
									rx={Math.min(3, barWidth / 4)}
									fill={isHovered ? colors.barHover : `url(#${gradientId})`}
									className="transition-all duration-150"
								/>

								{/* Hover value label */}
								{isHovered && point.value > 0 && (
									<text
										x={x + barWidth / 2}
										y={y - 6}
										textAnchor="middle"
										className="text-[10px] font-semibold fill-slate-700"
									>
										{formatCurrency(point.value)}
									</text>
								)}

								{/* X-axis label */}
								<text
									x={PADDING.left + cellWidth * i + cellWidth / 2}
									y={PADDING.top + drawableHeight + 16}
									textAnchor="middle"
									className="text-[10px] fill-slate-500"
									transform={
										data.length > 15
											? `rotate(-45, ${PADDING.left + cellWidth * i + cellWidth / 2}, ${PADDING.top + drawableHeight + 16})`
											: undefined
									}
								>
									{point.label}
								</text>
							</g>
						);
					})}
				</svg>
			</div>

			{/* Tooltip row for hovered point */}
			{hoveredIndex !== null && data[hoveredIndex] && (
				<div className="border-t border-slate-100 px-4 py-2 flex items-center gap-3 text-xs text-slate-600 bg-slate-50/60">
					<span className="font-medium text-slate-800">{data[hoveredIndex].label}</span>
					<span className="tabular-nums font-semibold" style={{ color: colors.bar }}>
						{formatCurrency(data[hoveredIndex].value)}
					</span>
					{data[hoveredIndex].detail && (
						<span className="text-slate-400">{data[hoveredIndex].detail}</span>
					)}
				</div>
			)}
		</section>
	);
}
