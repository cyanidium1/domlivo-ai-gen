import type { Metadata } from "next";
import type { ReactNode } from "react";

import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { LanguageProvider } from "@/contexts/language-context";
import "@/app/globals.css";

export const metadata: Metadata = {
  title: "Domlivo Admin",
  description: "Domlivo internal admin dashboard",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <LanguageProvider>
          <DashboardShell>{children}</DashboardShell>
        </LanguageProvider>
      </body>
    </html>
  );
}
