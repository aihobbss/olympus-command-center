import type { Metadata } from "next";
import { AppShell } from "@/components/ui/AppShell";
import { QueryProvider } from "@/components/ui/QueryProvider";
import "./globals.css";

export const metadata: Metadata = {
  title: "Vantage Command Center",
  description: "Centralized command center for fashion dropshippers",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className="font-inter antialiased">
        <QueryProvider>
          <AppShell>{children}</AppShell>
        </QueryProvider>
      </body>
    </html>
  );
}
