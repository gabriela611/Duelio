import React from "react";

export type AssetSymbol = "MON" | "BTC" | "ETH" | "SOL" | "USDC" | string;

interface AssetLogoProps {
  symbol: AssetSymbol;
  size?: number;
  className?: string;
}

export const AssetLogo: React.FC<AssetLogoProps> = ({
  symbol,
  size = 24,
  className = "",
}) => {
  const sym = symbol.toUpperCase();

  switch (sym) {
    case "MON":
      return (
        <svg
          width={size}
          height={size}
          viewBox="0 0 32 32"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className={`shrink-0 rounded-full shadow-2xs ${className}`}
        >
          {/* Monad Official Deep Purple Background */}
          <rect width="32" height="32" rx="16" fill="#836EF9" />
          <defs>
            <linearGradient id="monadGlow" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#FFFFFF" />
              <stop offset="100%" stopColor="#D5CBFF" />
            </linearGradient>
          </defs>
          {/* Official Monad Berry/Spiral Swirl Glyph */}
          <path
            d="M 16 7 C 11.029 7 7 11.029 7 16 C 7 20.971 11.029 25 16 25 C 20.971 25 25 20.971 25 16 C 25 13.515 23.993 11.265 22.364 9.636 C 21.973 9.245 21.34 9.245 20.95 9.636 C 20.559 10.026 20.559 10.66 20.95 11.05 C 22.213 12.314 23 14.065 23 16 C 23 19.866 19.866 23 16 23 C 12.134 23 9 19.866 9 16 C 9 12.134 12.134 9 16 9 C 18.065 9 19.914 9.89 21.2 11.3 C 21.57 11.71 22.2 11.73 22.61 11.36 C 23.02 10.99 23.04 10.36 22.67 9.95 C 21.01 8.13 18.64 7 16 7 Z"
            fill="url(#monadGlow)"
          />
          <circle cx="16" cy="16" r="3.2" fill="#FFFFFF" />
        </svg>
      );

    case "BTC":
      return (
        <svg
          width={size}
          height={size}
          viewBox="0 0 32 32"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className={`shrink-0 rounded-full shadow-2xs ${className}`}
        >
          {/* Official Bitcoin Orange Roundel */}
          <rect width="32" height="32" rx="16" fill="#F7931A" />
          {/* Official Tilted Bitcoin Symbol with Serifs */}
          <path
            d="M 22.5 13.2 C 22.1 10.5 20.1 9.5 17.5 9.2 L 18 6.8 L 16.5 6.5 L 16 8.9 C 15.6 8.8 15.2 8.7 14.8 8.6 L 15.3 6.2 L 13.8 5.9 L 13.3 8.3 C 12.9 8.2 12.6 8.1 12.2 8 L 10.2 7.5 L 9.8 9.3 C 9.8 9.3 10.9 9.5 10.8 9.6 C 11.4 9.7 11.5 10.1 11.4 10.5 L 9.9 16.7 C 9.8 16.9 9.6 17 9.4 17 C 9.3 17.1 8.2 16.8 8.2 16.8 L 7.5 18.5 L 9.4 19 C 9.7 19.1 10.1 19.2 10.5 19.3 L 10 21.7 L 11.5 22 L 12 19.6 C 12.4 19.7 12.8 19.8 13.2 19.9 L 12.7 22.3 L 14.2 22.6 L 14.7 20.2 C 17.3 20.7 19.3 20.5 20.5 18.1 C 21.5 16.2 21.1 14.9 19.8 14.1 C 20.8 13.9 22.4 13.2 22.5 13.2 Z M 18.6 17.4 C 18.1 19.5 14.7 18.4 13.5 18.1 L 14.3 14.8 C 15.5 15.1 19.1 15.3 18.6 17.4 Z M 19.1 13 C 18.6 14.8 15.7 13.9 14.7 13.7 L 15.4 10.7 C 16.4 10.9 19.6 11.2 19.1 13 Z"
            fill="#FFFFFF"
          />
        </svg>
      );

    case "ETH":
      return (
        <svg
          width={size}
          height={size}
          viewBox="0 0 32 32"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className={`shrink-0 rounded-full shadow-2xs ${className}`}
        >
          {/* Official Ethereum Roundel */}
          <rect width="32" height="32" rx="16" fill="#627EEA" />
          {/* Faceted Diamond Octahedron */}
          <g transform="translate(8, 5)">
            <polygon
              points="8 0, 0 13.3, 8 9.5"
              fill="#FFFFFF"
              fillOpacity="0.6"
            />
            <polygon points="8 0, 8 9.5, 16 13.3" fill="#FFFFFF" />
            <polygon
              points="8 10.8, 0 14.5, 8 22"
              fill="#FFFFFF"
              fillOpacity="0.6"
            />
            <polygon points="8 10.8, 8 22, 16 14.5" fill="#FFFFFF" />
            <polygon
              points="8 9.5, 0 13.3, 8 10.8"
              fill="#FFFFFF"
              fillOpacity="0.3"
            />
            <polygon
              points="8 9.5, 8 10.8, 16 13.3"
              fill="#FFFFFF"
              fillOpacity="0.8"
            />
          </g>
        </svg>
      );

    case "SOL":
      return (
        <svg
          width={size}
          height={size}
          viewBox="0 0 32 32"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className={`shrink-0 rounded-full shadow-2xs ${className}`}
        >
          {/* Solana Dark Carbon Roundel */}
          <rect width="32" height="32" rx="16" fill="#000000" />
          <defs>
            <linearGradient id="solanaGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#00FFA3" />
              <stop offset="100%" stopColor="#DC1FFF" />
            </linearGradient>
          </defs>
          {/* Solana 3 Speed Parallelograms */}
          <g transform="translate(6, 8.5)">
            <path
              d="M 3.8 2.6 L 19.3 2.6 C 19.8 2.6 20.1 2.9 20 3.3 L 16.9 6.2 C 16.7 6.4 16.4 6.5 16.1 6.5 L 0.7 6.5 C 0.2 6.5 -0.1 6.2 0 5.8 L 3.1 2.9 C 3.3 2.7 3.6 2.6 3.8 2.6 Z"
              fill="url(#solanaGrad)"
            />
            <path
              d="M 16.2 8.3 L 0.7 8.3 C 0.2 8.3 -0.1 8.6 0 9 L 3.1 11.9 C 3.3 12.1 3.6 12.2 3.8 12.2 L 19.3 12.2 C 19.8 12.2 20.1 11.9 20 11.5 L 16.9 8.6 C 16.7 8.4 16.4 8.3 16.2 8.3 Z"
              fill="url(#solanaGrad)"
            />
            <path
              d="M 3.8 14 L 19.3 14 C 19.8 14 20.1 14.3 20 14.7 L 16.9 17.6 C 16.7 17.8 16.4 17.9 16.1 17.9 L 0.7 17.9 C 0.2 17.9 -0.1 17.6 0 17.2 L 3.1 14.3 C 3.3 14.1 3.6 14 3.8 14 Z"
              fill="url(#solanaGrad)"
            />
          </g>
        </svg>
      );

    case "USDC":
      return (
        <svg
          width={size}
          height={size}
          viewBox="0 0 32 32"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className={`shrink-0 rounded-full shadow-2xs ${className}`}
        >
          <rect width="32" height="32" rx="16" fill="#2775CA" />
          <path
            d="M 16 6 C 10.48 6 6 10.48 6 16 C 6 21.52 10.48 26 16 26 C 21.52 26 26 21.52 26 16 C 26 10.48 21.52 6 16 6 Z M 16.8 21.8 L 16.8 23.2 L 15.2 23.2 L 15.2 21.8 C 13.1 21.6 11.8 20.3 11.7 18.6 L 13.6 18.6 C 13.8 19.5 14.6 20.2 16 20.2 C 17.3 20.2 18.1 19.5 18.1 18.7 C 18.1 17.8 17.3 17.3 15.4 16.7 C 13.2 16 11.9 15.1 11.9 13.4 C 11.9 11.8 13.1 10.6 15.2 10.3 L 15.2 8.8 L 16.8 8.8 L 16.8 10.3 C 18.6 10.6 19.7 11.6 19.8 13.1 L 17.9 13.1 C 17.8 12.3 17.1 11.8 16 11.8 C 14.9 11.8 14 12.4 14 13.2 C 14 14 14.8 14.5 16.5 15 C 18.9 15.7 20.2 16.7 20.2 18.5 C 20.2 20.2 18.9 21.5 16.8 21.8 Z"
            fill="#FFFFFF"
          />
        </svg>
      );

    default:
      return (
        <div
          style={{ width: size, height: size }}
          className={`rounded-full bg-slate-200 text-slate-700 font-bold text-xs flex items-center justify-center shadow-2xs ${className}`}
        >
          {sym.slice(0, 3)}
        </div>
      );
  }
};
