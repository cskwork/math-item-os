import type { Metadata } from "next";
import { TRPCProvider } from "@/lib/trpc-provider";
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
    <html lang="ko">
      <body>
        <TRPCProvider>{children}</TRPCProvider>
      </body>
    </html>
  );
}
