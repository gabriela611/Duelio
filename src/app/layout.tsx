import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Providers } from "./providers";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#F6F6F5",
};

export const metadata: Metadata = {
  title: "Duelio | PvP Crypto Trading Arena on Monad",
  description:
    "Clash Royale style real-time crypto trading duels, spectator prediction pools, and onchain ELO reputation on Monad (Chain 10143).",
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/icon.svg", type: "image/svg+xml" },
    ],
    apple: "/apple-touch-icon.png",
  },
  openGraph: {
    title: "Duelio | PvP Crypto Trading Arena on Monad",
    description: "Clash Royale style trading duels & spectator predictions powered by Monad and Envio.",
    siteName: "Duelio",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="light" style={{ colorScheme: "light" }}>
      <body className="antialiased bg-background text-text-primary min-h-screen">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
