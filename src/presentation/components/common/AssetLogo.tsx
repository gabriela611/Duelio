import React, { useId } from "react";

export type AssetSymbol = "MON" | "BTC" | "ETH" | "SOL" | "USDC" | string;
interface AssetLogoProps { symbol: AssetSymbol; size?: number; className?: string }

/** Consistent, optically centered vector marks; no network assets required. */
export const AssetLogo: React.FC<AssetLogoProps> = ({ symbol, size = 24, className = "" }) => {
  const gradient = `coin-${useId().replace(/:/g, "")}`;
  const sym = symbol.trim().toUpperCase();
  const colors: Record<string, string> = { MON: "#7963ED", BTC: "#F7931A", ETH: "#EDF0FD", SOL: "#15151C", USDC: "#2775CA" };
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" role="img" aria-label={`${sym || "Unknown"} coin`} className={`shrink-0 ${className}`}>
      <circle cx="16" cy="16" r="16" fill={colors[sym] || "#E7E7EB"} />
      <circle cx="16" cy="16" r="15.5" stroke="black" strokeOpacity=".045" />
      {sym === "MON" && <path fill="white" fillRule="evenodd" d="M16 5.5c-3.8 0-10.5 6.7-10.5 10.5S12.2 26.5 16 26.5 26.5 19.8 26.5 16 19.8 5.5 16 5.5Zm-1.6 5.2c-2.6 0-4.4 3.4-4.4 5.9s1.8 4.7 4.4 4.7 7.6-4.7 7.6-7.3-5-3.3-7.6-3.3Z" />}
      {sym === "BTC" && <g transform="rotate(14 16 16)" stroke="white" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round"><path d="M11.5 9.5h6c5 0 5 6.2 0 6.2h-4.8m0 0h5.5c5.4 0 5.4 6.8 0 6.8h-6.7m1.7-13v13M15 6.8v2.7m3.8-2.7v2.7M15 22.5v2.7m3.8-2.7v2.7" /></g>}
      {sym === "ETH" && <g><path d="m16 4.5-7 11.7 7 4 7-4Z" fill="#7589CE" /><path d="m16 4.5 7 11.7-7 4Z" fill="#455BA3" /><path d="m9 17.8 7 9.7 7-9.7-7 4.1Z" fill="#7589CE" /><path d="m16 21.9 7-4.1-7 9.7Z" fill="#455BA3" /></g>}
      {sym === "SOL" && <><defs><linearGradient id={gradient} x1="23" y1="7" x2="9" y2="25" gradientUnits="userSpaceOnUse"><stop stopColor="#14F195" /><stop offset="1" stopColor="#9945FF" /></linearGradient></defs><path d="m10 7.5-3.5 4h15.7l3.3-4Zm-3.5 6.7 3.5 4h15.5l-3.3-4Zm3.5 6.3-3.5 4h15.7l3.3-4Z" fill={`url(#${gradient})`} /></>}
      {sym === "USDC" && <g stroke="white" strokeWidth="1.7" strokeLinecap="round"><path d="M11 7.5a10 10 0 0 0 0 17m10-17a10 10 0 0 1 0 17M19.5 12.2c-.7-2.9-7-2.9-7 .5 0 3.8 7 2.2 7 6 0 3.4-6.3 3.4-7 .5M16 8v2m0 12v2" /></g>}
      {!colors[sym] && <text x="16" y="16.5" dominantBaseline="middle" textAnchor="middle" fill="#4B4B55" fontSize="9" fontWeight="700" fontFamily="system-ui, sans-serif">{sym.slice(0, 3) || "?"}</text>}
    </svg>
  );
};
