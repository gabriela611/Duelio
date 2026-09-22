"use client";

import dynamic from "next/dynamic";

const RocketClashGame = dynamic(
  () => import("@/presentation/components/exp/RocketClashGame").then((mod) => mod.RocketClashGame),
  {
    ssr: false,
    loading: () => (
      <div className="w-full max-w-4xl h-[460px] bg-white border border-black/[0.06] rounded-3xl shadow-[0_2px_10px_rgba(0,0,0,0.035)] flex flex-col items-center justify-center animate-pulse">
        <div className="w-12 h-12 rounded-2xl bg-[#836EF9]/10 flex items-center justify-center text-[#6E4EF4] mb-3">
          <span className="text-xl">🚀</span>
        </div>
        <div className="text-sm font-semibold text-slate-700">Loading Rocket Clash...</div>
        <div className="text-xs text-slate-400 mt-1 font-mono">Connecting Pyth Oracle stream</div>
      </div>
    ),
  }
);

export default function ExpPage() {
  return (
    <main className="min-h-screen bg-[#F6F6F5] text-[#0B0B0B] flex flex-col items-center justify-start p-4 sm:p-6 lg:p-8 relative">
      <div className="w-full max-w-4xl z-10 flex flex-col items-center">
        <RocketClashGame />
      </div>
    </main>
  );
}
