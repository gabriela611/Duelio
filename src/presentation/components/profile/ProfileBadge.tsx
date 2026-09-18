"use client";

import React, { useState } from "react";
import { Shield, Key, AlertTriangle, CheckCircle, ExternalLink, Award } from "lucide-react";
import { DUELIO_SESSION_POLICY } from "@/infrastructure/web3/privyConfig";

export const ProfileBadge: React.FC = () => {
  const [sessionActive, setSessionActive] = useState(true);
  const [revoked, setRevoked] = useState(false);

  const handleRevokeSession = () => {
    setSessionActive(false);
    setRevoked(true);
  };

  return (
    <div className="p-4 space-y-4">
      {/* Profile Card */}
      <div className="p-4 rounded-2xl bg-duel-surface border border-duel-border space-y-3">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-monad-600 to-duel-cyan flex items-center justify-center font-black text-base text-white shadow-glow-monad">
            MW
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-bold text-sm text-white">MonadWhale</h3>
              <span className="text-[10px] bg-sky-500/20 text-sky-400 font-bold px-2 py-0.5 rounded-full border border-sky-500/30 flex items-center gap-1">
                @monad_whale (X Linked)
              </span>
            </div>
            <p className="text-xs text-slate-400 font-mono">0x836E...0001</p>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-3 gap-2 pt-1">
          <div className="p-2.5 rounded-xl bg-duel-card border border-duel-border text-center">
            <span className="text-[10px] text-slate-400 font-bold uppercase">ELO Rating</span>
            <div className="text-sm font-black text-monad-300 font-mono">1845</div>
          </div>
          <div className="p-2.5 rounded-xl bg-duel-card border border-duel-border text-center">
            <span className="text-[10px] text-slate-400 font-bold uppercase">Win Rate</span>
            <div className="text-sm font-black text-emerald-400 font-mono">85%</div>
          </div>
          <div className="p-2.5 rounded-xl bg-duel-card border border-duel-border text-center">
            <span className="text-[10px] text-slate-400 font-bold uppercase">Earned MON</span>
            <div className="text-sm font-black text-duel-gold font-mono">128.5</div>
          </div>
        </div>
      </div>

      {/* Privy Beyond-Auth Session Policy Manager */}
      <div className="p-3.5 rounded-2xl bg-duel-surface border border-monad-500/30 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Key className="w-4 h-4 text-monad-400" />
            <h4 className="text-xs font-black text-white uppercase tracking-wider">
              Privy Session Signer Policy
            </h4>
          </div>
          <span
            className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${
              sessionActive
                ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                : "bg-duel-red/20 text-duel-red border border-duel-red/30"
            }`}
          >
            {sessionActive ? "POLICY ACTIVE" : "SESSION REVOKED"}
          </span>
        </div>

        <div className="space-y-1.5 text-[11px] font-mono text-slate-300 bg-duel-card p-2.5 rounded-xl border border-duel-border">
          <div className="flex justify-between">
            <span className="text-slate-400">Target Chain:</span>
            <span className="text-monad-300">Monad Testnet ({DUELIO_SESSION_POLICY.chainId})</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-400">Max Spend Allowance:</span>
            <span>{DUELIO_SESSION_POLICY.maxSpendMon} MON</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-400">Allowed Selectors:</span>
            <span>joinDuel, commitOutcome, placePrediction</span>
          </div>
        </div>

        {/* Emergency Revoke Button */}
        {sessionActive ? (
          <button
            onClick={handleRevokeSession}
            className="w-full py-2 rounded-xl bg-duel-red/20 hover:bg-duel-red/30 border border-duel-red/40 text-duel-red text-xs font-bold transition-all flex items-center justify-center gap-1.5"
          >
            <AlertTriangle className="w-3.5 h-3.5" />
            <span>EMERGENCY REVOKE SESSION KEY</span>
          </button>
        ) : (
          <div className="p-2 rounded-xl bg-slate-800 text-center text-xs text-slate-400 font-semibold">
            Session signer revoked. Future moves require manual wallet confirmation.
          </div>
        )}
      </div>
    </div>
  );
};
