"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { Button } from "@/components/ui/button";

const DEV_EMAIL = "dev@mathitem.local";
const DEV_PASSWORD = "dev1234";

export default function SignInPage() {
  const [email, setEmail] = useState(DEV_EMAIL);
  const [password, setPassword] = useState(DEV_PASSWORD);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const result = await signIn("credentials", {
      email,
      password,
      callbackUrl: "/items",
      redirect: false,
    });

    if (result?.error) {
      setError("이메일 또는 비밀번호가 올바르지 않습니다");
    } else if (result?.url) {
      window.location.href = result.url;
    }
    setLoading(false);
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 dark:bg-slate-950">
      <div className="w-full max-w-sm space-y-6 rounded-lg border border-slate-200 bg-white p-8 shadow-sm dark:border-slate-700 dark:bg-slate-900">
        <div className="text-center">
          <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100">
            Math Item OS
          </h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">로그인</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label
              htmlFor="email"
              className="block text-sm font-medium text-slate-700 dark:text-slate-300"
            >
              Email
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:focus:border-slate-400 dark:focus:ring-slate-400"
              required
            />
          </div>

          <div className="space-y-1.5">
            <label
              htmlFor="password"
              className="block text-sm font-medium text-slate-700 dark:text-slate-300"
            >
              Password
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:focus:border-slate-400 dark:focus:ring-slate-400"
              required
            />
          </div>

          {error && (
            <p className="text-sm text-red-600">{error}</p>
          )}

          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "로그인 중..." : "로그인"}
          </Button>
        </form>

        <div className="rounded-md bg-slate-50 p-3 text-xs text-slate-500 dark:bg-slate-800 dark:text-slate-400">
          <p className="font-medium text-slate-600 dark:text-slate-300">개발용 계정</p>
          <p className="mt-1">
            Email: <code className="text-slate-700 dark:text-slate-300">{DEV_EMAIL}</code>
          </p>
          <p>
            Password: <code className="text-slate-700 dark:text-slate-300">{DEV_PASSWORD}</code>
          </p>
        </div>
      </div>
    </div>
  );
}
