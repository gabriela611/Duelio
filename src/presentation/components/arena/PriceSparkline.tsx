"use client";

import React, { useState } from "react";
import { TrendingUp, TrendingDown, Radio } from "lucide-react";
import { SupportedAsset, usePriceStream } from "@/infrastructure/price-feed/usePriceStream";

interface PriceSparklineProps {
  asset: SupportedAsset;
}

export const PriceSparkline: React.FC<PriceSparklineProps> = ({ asset }) => {
  const { currentPrice, changePercent, history, isLive } = usePriceStream(asset);
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  const isPositive = changePercent >= 0;
  const strokeColor = isPositive ? "#14CF1C" : "#FF3B30";
  const gradientId = `gradient-${asset}`;

  // Calculate normalized SVG coordinates
  const prices = history.map((p) => p.price);
  const minPrice = Math.min(...prices, currentPrice);
  const maxPrice = Math.max(...prices, currentPrice);
  const range = maxPrice - minPrice || 1;

  const width = 320;
  const height = 75;
  const paddingY = 8;
  const usableHeight = height - paddingY * 2;

  const points = history.map((p, i) => {
    const x = (i / Math.max(history.length - 1, 1)) * width;
    const y = paddingY + usableHeight - ((p.price - minPrice) / range) * usableHeight;
    return { x, y, price: p.price };
  });

  // Build a smooth cubic Bézier SVG path
  let pathD = "";
  if (points.length > 0) {
    pathD = `M ${points[0].x.toFixed(1)} ${points[0].y.toFixed(1)}`;
    for (let i = 0; i < points.length - 1; i++) {
      const p0 = points[i === 0 ? 0 : i - 1];
      const p1 = points[i];
      const p2 = points[i + 1];
      const p3 = points[i + 2] || p2;

      const cp1x = p1.x + (p2.x - p0.x) / 6;
      const cp1y = p1.y + (p2.y - p0.y) / 6;
      const cp2x = p2.x - (p3.x - p1.x) / 6;
      const cp2y = p2.y - (p3.y - p1.y) / 6;

      pathD += ` C ${cp1x.toFixed(1)} ${cp1y.toFixed(1)}, ${cp2x.toFixed(1)} ${cp2y.toFixed(1)}, ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`;
    }
  }

  const lastPoint = points[points.length - 1] || { x: width, y: height / 2 };
  const areaD = `${pathD} L ${width} ${height} L 0 ${height} Z`;

  const displayPrice =
    hoverIndex !== null && points[hoverIndex]
      ? points[hoverIndex].price
      : currentPrice;

  return (
    <div className="p-3.5 rounded-2xl bg-surface-secondary/70 border border-border space-y-2.5 transition-all">
      {/* Header: Asset & Real-Time Price */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-text-primary">
              {asset}/USD
            </span>
            <span className="flex items-center gap-1 text-[10px] font-mono text-text-secondary bg-surface px-1.5 py-0.5 rounded-md border border-border">
              <Radio
                className={`w-2.5 h-2.5 ${isLive ? "text-positive animate-pulse" : "text-text-tertiary"}`}
              />
              <span>{isLive ? "LIVE" : "SYNC"}</span>
            </span>
          </div>

          <div className="flex items-baseline gap-2 mt-0.5">
            <span className="text-lg font-mono font-bold text-text-primary tabular-nums tracking-tight">
              ${displayPrice.toLocaleString(undefined, {
                minimumFractionDigits: asset === "BTC" ? 1 : 2,
                maximumFractionDigits: 2,
              })}
            </span>
            <span
              className={`text-xs font-mono font-semibold flex items-center gap-0.5 ${
                isPositive ? "text-positive" : "text-negative"
              }`}
            >
              {isPositive ? (
                <TrendingUp className="w-3 h-3" />
              ) : (
                <TrendingDown className="w-3 h-3" />
              )}
              <span>{isPositive ? `+${changePercent}%` : `${changePercent}%`}</span>
            </span>
          </div>
        </div>

        <div className="text-right text-[10px] font-mono text-text-tertiary">
          <div>H: ${maxPrice.toFixed(asset === "BTC" ? 0 : 2)}</div>
          <div>L: ${minPrice.toFixed(asset === "BTC" ? 0 : 2)}</div>
        </div>
      </div>

      {/* Interactive Micro Sparkline */}
      <div
        className="w-full h-16 relative select-none cursor-crosshair"
        onMouseLeave={() => setHoverIndex(null)}
      >
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="w-full h-full overflow-visible"
          preserveAspectRatio="none"
        >
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={strokeColor} stopOpacity="0.18" />
              <stop offset="100%" stopColor={strokeColor} stopOpacity="0.0" />
            </linearGradient>
          </defs>

          {/* Area Fill */}
          <path d={areaD} fill={`url(#${gradientId})`} />

          {/* Line Path */}
          <path
            d={pathD}
            fill="none"
            stroke={strokeColor}
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* Active End Point with pulse */}
          <circle
            cx={lastPoint.x}
            cy={lastPoint.y}
            r="3.5"
            fill={strokeColor}
            className="animate-pulse"
          />
          <circle
            cx={lastPoint.x}
            cy={lastPoint.y}
            r="7"
            fill={strokeColor}
            fillOpacity="0.25"
          />

          {/* Hover Scrub Point */}
          {hoverIndex !== null && points[hoverIndex] && (
            <g>
              <line
                x1={points[hoverIndex].x}
                y1="0"
                x2={points[hoverIndex].x}
                y2={height}
                stroke="currentColor"
                strokeOpacity="0.2"
                strokeDasharray="2 2"
              />
              <circle
                cx={points[hoverIndex].x}
                cy={points[hoverIndex].y}
                r="4.5"
                fill="#FFFFFF"
                stroke={strokeColor}
                strokeWidth="2"
              />
            </g>
          )}
        </svg>

        {/* Transparent Scrub Interaction Layer */}
        <div
          className="absolute inset-0 flex"
          onMouseMove={(e) => {
            const rect = e.currentTarget.getBoundingClientRect();
            const relX = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
            const idx = Math.min(
              points.length - 1,
              Math.max(0, Math.round(relX * (points.length - 1)))
            );
            setHoverIndex(idx);
          }}
        />
      </div>
    </div>
  );
};
