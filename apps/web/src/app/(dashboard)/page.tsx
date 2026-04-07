import { redirect } from "next/navigation";

// TODO: /items 라우트 생성 후 타입 단언 제거
export default function DashboardIndex() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  redirect("/items" as any);
}
