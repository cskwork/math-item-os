import type { Metadata } from "next";
import { SessionProvider } from "@/lib/session-provider";
import { TRPCProvider } from "@/lib/trpc-provider";
import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import "./globals.css";

export const metadata: Metadata = {
  title: "Math Item OS",
  description: "수학 문항 관리 시스템",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko" suppressHydrationWarning>
      <body className="bg-white text-slate-900 dark:bg-slate-950 dark:text-slate-100">
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-md focus:bg-white focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-slate-900 focus:shadow-lg focus:ring-2 focus:ring-slate-950 dark:focus:bg-slate-900 dark:focus:text-slate-100"
        >
          본문으로 건너뛰기
        </a>
        <ThemeProvider>
          <SessionProvider>
            <TRPCProvider>
              {/* 단일 루트 TooltipProvider: 모든 하위 트리가 하나의 컨텍스트 공유. delayDuration=200 */}
              <TooltipProvider delayDuration={200}>{children}</TooltipProvider>
            </TRPCProvider>
          </SessionProvider>
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  );
}
