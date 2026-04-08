// Auth.js v5 설정 (Google OAuth + 개발용 Credentials)
import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import Credentials from "next-auth/providers/credentials";
import { PrismaAdapter } from "@auth/prisma-adapter";
import type { Adapter } from "next-auth/adapters";
import { prisma } from "@math-item-os/db";
import type { UserRole } from "@math-item-os/db";

// 개발용 계정 정보
const DEV_EMAIL = "dev@mathitem.local";
const DEV_PASSWORD = "dev1234";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      name?: string | null;
      email?: string | null;
      image?: string | null;
      role: UserRole;
    };
  }

  interface User {
    role: UserRole;
  }
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma) as Adapter,
  providers: [
    Google,
    Credentials({
      name: "Dev Login",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const email = credentials?.email as string | undefined;
        const password = credentials?.password as string | undefined;

        if (email !== DEV_EMAIL || password !== DEV_PASSWORD) {
          return null;
        }

        // DB에서 사용자 조회, 없으면 생성
        const user = await prisma.user.upsert({
          where: { email: DEV_EMAIL },
          update: {},
          create: {
            email: DEV_EMAIL,
            name: "Dev User",
            role: "admin",
            emailVerified: new Date(),
          },
        });

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role as UserRole,
        };
      },
    }),
  ],
  session: { strategy: "jwt" },
  callbacks: {
    // JWT에 사용자 정보 저장
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = user.role;
      }
      return token;
    },
    // 세션에 user role 포함
    session({ session, token }) {
      session.user.id = token.id as string;
      session.user.role = token.role as UserRole;
      return session;
    },
  },
  pages: {
    signIn: "/auth/signin",
  },
});
