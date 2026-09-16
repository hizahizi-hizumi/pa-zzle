import type { ReactNode } from "react";

import { Link } from "@/router";

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-muted/30">
      <header className="border-b bg-background">
        <div className="mx-auto flex min-h-app-header w-full max-w-app items-center px-page-inline sm:px-page-inline-wide">
          <Link to="/" className="rounded-sm font-heading tracking-tight outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50">
            パズル pa-zzle
          </Link>
        </div>
      </header>
      <main className="mx-auto w-full max-w-app px-page-inline py-page-block sm:px-page-inline-wide sm:py-page-block-wide">
        {children}
      </main>
    </div>
  );
}
