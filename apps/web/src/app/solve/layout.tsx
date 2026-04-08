// 학생 풀이 공개 레이아웃 - 인증 불필요, 사이드바 없음
export default function SolveLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className="min-h-screen bg-slate-50">
      <main className="mx-auto max-w-3xl px-4 py-8">{children}</main>
    </div>
  );
}
