import {
  FileText,
  Search,
  GitBranch,
  AlertTriangle,
  BarChart3,
  ClipboardCheck,
  Wand2,
  BookOpen,
  Users,
  ScrollText,
  Brain,
  type LucideIcon,
} from "lucide-react";

export interface NavItem {
  readonly label: string;
  readonly href: string;
  readonly icon: LucideIcon;
}

export interface NavSection {
  readonly label?: string;
  readonly items: readonly NavItem[];
}

export const navSections: readonly NavSection[] = [
  {
    items: [
      { label: "문항 관리", href: "/items", icon: FileText },
      { label: "검색", href: "/search", icon: Search },
      { label: "성취기준 관리", href: "/skills", icon: Brain },
      { label: "성취기준 그래프", href: "/skills/graph", icon: GitBranch },
      { label: "오개념", href: "/misconceptions", icon: AlertTriangle },
    ],
  },
  {
    label: "관리",
    items: [
      { label: "대시보드", href: "/admin/dashboard", icon: BarChart3 },
      { label: "검수 큐", href: "/admin/reviews", icon: ClipboardCheck },
      { label: "문항 생성", href: "/admin/generate", icon: Wand2 },
      { label: "학습지", href: "/admin/assignments", icon: BookOpen },
      { label: "사용자", href: "/admin/users", icon: Users },
      { label: "감사 로그", href: "/admin/audit", icon: ScrollText },
    ],
  },
] as const;
