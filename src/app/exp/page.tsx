import type { Metadata } from "next";
import { RocketClashGame } from "@/presentation/components/exp/RocketClashGame";

export const metadata: Metadata = {
  title: "Rocket Clash EXP | Monad PvP Prediction Arena",
  description:
    "Experimental hold-to-thrust rocket PvP prediction mini-game on Monad. Balance gravity, target Pyth volatility corridors, and battle for MON stakes.",
};

export default function ExpPage() {
  return (
    <main className="min-h-screen bg-[#F6F6F5] text-[#0B0B0B] flex flex-col items-center justify-start p-4 sm:p-6 lg:p-8 relative">
      <div className="w-full max-w-4xl z-10 flex flex-col items-center">
        <RocketClashGame />
      </div>
    </main>
  );
}
