import type { Metadata } from "next";
import type { ReactNode } from "react";

import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { LanguageProvider } from "@/contexts/language-context";
import "@/app/globals.css";
import { Toaster } from "sonner";

export const metadata: Metadata = {
  title: "Domlivo AI Agent",
  description: "Domlivo internal admin dashboard",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <LanguageProvider>
          <DashboardShell>{children}</DashboardShell>
          <Toaster position="bottom-right" richColors closeButton />
        </LanguageProvider>
      </body>
    </html>
  );
}
