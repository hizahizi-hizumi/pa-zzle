import type { ReactNode } from "react";

import { Link } from "@/router";

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-muted/30">
      <header className="border-b bg-background">
        <div className="mx-auto flex min-h-14 w-full max-w-5xl items-center px-4 sm:px-6">
          <Link to="/" className="font-semibold tracking-tight">
            パズル pa-zzle
          </Link>
        </div>
      </header>
      <main className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6 sm:py-12">
        {children}
      </main>
    </div>
  );
}
