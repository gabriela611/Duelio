import type { Metadata } from "next";
import { RocketClashGame } from "@/presentation/components/exp/RocketClashGame";

export const metadata: Metadata = {
  title: "Rocket Clash EXP | Monad PvP Prediction Arena",
  description:
    "Experimental hold-to-thrust rocket PvP prediction mini-game on Monad. Balance gravity, target Pyth volatility corridors, and battle for MON stakes.",
};

export default function ExpPage() {
  return (
    <main className="min-h-screen bg-[#07000E] text-white flex flex-col items-center justify-start p-4 sm:p-6 lg:p-8 relative overflow-hidden">
      {/* Background glow effects */}
      <div className="absolute top-[-150px] left-1/2 -translate-x-1/2 w-[600px] h-[350px] bg-[#836EF9]/15 blur-[120px] rounded-full pointer-events-none" />
      <div className="absolute bottom-[-100px] right-[-100px] w-[400px] h-[400px] bg-emerald-500/10 blur-[130px] rounded-full pointer-events-none" />

      {/* Main interactive game wrapper */}
      <div className="w-full max-w-5xl z-10 flex flex-col items-center">
        <RocketClashGame />
      </div>
    </main>
  );
}
