import type { Metadata } from "next";
import type { ReactNode } from "react";

import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { SettingsProvider } from "@/contexts/settings-context";
import "@/app/globals.css";
import { Toaster } from "sonner";

export const metadata: Metadata = {
  title: "Domlivo AI Agent",
  description: "Domlivo internal admin dashboard",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function(){
                try {
                  var raw = localStorage.getItem('domlivo-user-settings');
                  var parsed = raw ? JSON.parse(raw) : null;
                  var theme = parsed && (parsed.theme === 'light' || parsed.theme === 'dark') ? parsed.theme : 'dark';
                  document.documentElement.dataset.theme = theme;
                  document.documentElement.style.colorScheme = theme;
                } catch (e) {}
              })();
            `,
          }}
        />
      </head>
      <body>
        <SettingsProvider>
          <DashboardShell>{children}</DashboardShell>
          <Toaster position="bottom-right" richColors closeButton />
        </SettingsProvider>
      </body>
    </html>
  );
}
