"use client";

import React, { useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { PrivyProvider } from "@privy-io/react-auth";
import { privyConfig } from "@/infrastructure/web3/privyConfig";

import { AuthTokenSync } from "@/presentation/components/auth/AuthTokenSync";

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());

  return (
    <PrivyProvider
      appId={privyConfig.appId}
      config={privyConfig.config}
    >
      <AuthTokenSync />
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    </PrivyProvider>
  );
}
