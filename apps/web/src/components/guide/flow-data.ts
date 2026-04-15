import type { Node, Edge } from "@xyflow/react";
import { MarkerType } from "@xyflow/react";
import {
  FileText,
  Search,
  GitBranch,
  AlertTriangle,
  BarChart3,
  ClipboardCheck,
  Wand2,
  BookOpen,
  Brain,
  Play,
  Tag,
  type LucideIcon,
} from "lucide-react";

// ─── 노드 데이터 타입 ───

export type GuideCategory = "start" | "core" | "admin" | "utility";

export interface GuideNodeData extends Record<string, unknown> {
  readonly label: string;
  readonly description: string;
  readonly tip: string;
  readonly href: string | null;
  readonly category: GuideCategory;
  readonly icon: LucideIcon;
}

export type GuideNode = Node<GuideNodeData, "guide">;

// ─── 레이아웃 상수 ───

const COL = 300; // 컬럼 간격
const ROW = 180; // 행 간격

// ─── 노드 정의 (5단계 컬럼 레이아웃) ───
//
//  Col 0: 시작
//  Col 1: 기본 등록 (문항, 성취기준)
//  Col 2: 연결 (태깅, 그래프, 오개념)
//  Col 3: 품질 (검수, 검색, 생성)
//  Col 4: 출력 & 분석 (학습지, 대시보드)

export const guideNodes: GuideNode[] = [
  // Col 0
  {
    id: "start",
    type: "guide",
    position: { x: 0, y: ROW },
    data: {
      label: "시작",
      description: "서비스를 처음 사용하나요?",
      tip: "아래 흐름을 따라가면 됩니다!",
      href: null,
      category: "start",
      icon: Play,
    },
  },

  // Col 1
  {
    id: "items",
    type: "guide",
    position: { x: COL, y: 0 },
    data: {
      label: "문항 관리",
      description: "수학 문항 등록 및 관리",
      tip: "문항 = 수학 문제 하나. 문제·풀이·정답을 등록합니다",
      href: "/items",
      category: "core",
      icon: FileText,
    },
  },
  {
    id: "skills",
    type: "guide",
    position: { x: COL, y: ROW * 2 },
    data: {
      label: "성취기준 관리",
      description: "교육과정 성취기준 등록",
      tip: "성취기준 = 교육과정의 학습 목표(EdTech에서는 '스킬'). 예: '[9수01-01] 일차방정식 풀기'",
      href: "/skills",
      category: "core",
      icon: Brain,
    },
  },

  // Col 2
  {
    id: "skill-tagging",
    type: "guide",
    position: { x: COL * 2, y: 0 },
    data: {
      label: "성취기준 태깅",
      description: "문항에 성취기준 연결",
      tip: "각 문항에 해당하는 성취기준 코드를 연결합니다",
      href: "/items",
      category: "core",
      icon: Tag,
    },
  },
  {
    id: "skill-graph",
    type: "guide",
    position: { x: COL * 2, y: ROW * 1.3 },
    data: {
      label: "성취기준 그래프",
      description: "선수/후속 관계 시각화",
      tip: "성취기준 간 '이걸 알아야 저걸 배운다' 관계를 트리로 봅니다",
      href: "/skills/graph",
      category: "core",
      icon: GitBranch,
    },
  },
  {
    id: "misconceptions",
    type: "guide",
    position: { x: COL * 2, y: ROW * 2.6 },
    data: {
      label: "오개념",
      description: "오개념 등록 및 교정 경로",
      tip: "오개념 = 학생이 자주 하는 실수 유형. 예: '음수×음수=음수'",
      href: "/misconceptions",
      category: "core",
      icon: AlertTriangle,
    },
  },

  // Col 3
  {
    id: "reviews",
    type: "guide",
    position: { x: COL * 3, y: 0 },
    data: {
      label: "검수 큐",
      description: "문항 품질 검수",
      tip: "등록된 문항을 전문가가 검토하고 승인/반려합니다",
      href: "/admin/reviews",
      category: "admin",
      icon: ClipboardCheck,
    },
  },
  {
    id: "search",
    type: "guide",
    position: { x: COL * 3, y: ROW * 1.3 },
    data: {
      label: "검색",
      description: "문항 전문 검색",
      tip: "키워드로 문항을 찾고 난이도·학년 필터로 좁힙니다",
      href: "/search",
      category: "utility",
      icon: Search,
    },
  },
  {
    id: "generate",
    type: "guide",
    position: { x: COL * 3, y: ROW * 2.6 },
    data: {
      label: "문항 생성",
      description: "AI 변형 문항 자동 생성",
      tip: "기존 문항의 숫자만 바꿔 새 문제를 자동으로 만듭니다",
      href: "/admin/generate",
      category: "admin",
      icon: Wand2,
    },
  },

  // Col 4
  {
    id: "assignments",
    type: "guide",
    position: { x: COL * 4, y: ROW * 0.65 },
    data: {
      label: "학습지",
      description: "학습지 생성 및 배포",
      tip: "학습지 = 학생에게 나눠줄 문제 세트. 용도별로 구성합니다",
      href: "/admin/assignments",
      category: "admin",
      icon: BookOpen,
    },
  },
  {
    id: "dashboard",
    type: "guide",
    position: { x: COL * 4, y: ROW * 2 },
    data: {
      label: "대시보드",
      description: "품질 지표 모니터링",
      tip: "전체 문항 현황·검수율·품질 지표를 한눈에 확인합니다",
      href: "/admin/dashboard",
      category: "admin",
      icon: BarChart3,
    },
  },
];

// ─── 엣지 정의 ───

const EDGE_STYLE = { stroke: "#475569", strokeWidth: 2 };
const MARKER = { type: MarkerType.ArrowClosed, color: "#475569" };

export const guideEdges: Edge[] = [
  // 시작 → 기본 등록
  {
    id: "e-start-items",
    source: "start",
    target: "items",
    type: "smoothstep",
    label: "문항 등록",
    style: EDGE_STYLE,
    markerEnd: MARKER,
  },
  {
    id: "e-start-skills",
    source: "start",
    target: "skills",
    type: "smoothstep",
    label: "성취기준 등록",
    style: EDGE_STYLE,
    markerEnd: MARKER,
  },

  // 기본 등록 → 연결
  {
    id: "e-items-tagging",
    source: "items",
    target: "skill-tagging",
    type: "smoothstep",
    style: EDGE_STYLE,
    markerEnd: MARKER,
  },
  {
    id: "e-skills-tagging",
    source: "skills",
    target: "skill-tagging",
    type: "smoothstep",
    style: EDGE_STYLE,
    markerEnd: MARKER,
  },
  {
    id: "e-skills-graph",
    source: "skills",
    target: "skill-graph",
    type: "smoothstep",
    label: "관계 확인",
    style: EDGE_STYLE,
    markerEnd: MARKER,
  },
  {
    id: "e-skills-misconceptions",
    source: "skills",
    target: "misconceptions",
    type: "smoothstep",
    style: EDGE_STYLE,
    markerEnd: MARKER,
  },

  // 연결 → 품질
  {
    id: "e-tagging-reviews",
    source: "skill-tagging",
    target: "reviews",
    type: "smoothstep",
    label: "검수 요청",
    style: EDGE_STYLE,
    markerEnd: MARKER,
  },
  {
    id: "e-reviews-search",
    source: "reviews",
    target: "search",
    type: "smoothstep",
    label: "승인 후 검색",
    style: { ...EDGE_STYLE, strokeDasharray: "5 5" },
    markerEnd: MARKER,
  },
  {
    id: "e-reviews-generate",
    source: "reviews",
    target: "generate",
    type: "smoothstep",
    style: { ...EDGE_STYLE, strokeDasharray: "5 5" },
    markerEnd: MARKER,
  },

  // 품질 → 출력
  {
    id: "e-search-assignments",
    source: "search",
    target: "assignments",
    type: "smoothstep",
    label: "문항 선택",
    style: EDGE_STYLE,
    markerEnd: MARKER,
  },
  {
    id: "e-generate-assignments",
    source: "generate",
    target: "assignments",
    type: "smoothstep",
    style: EDGE_STYLE,
    markerEnd: MARKER,
  },

  // 출력 → 분석
  {
    id: "e-assignments-dashboard",
    source: "assignments",
    target: "dashboard",
    type: "smoothstep",
    label: "현황 확인",
    style: EDGE_STYLE,
    markerEnd: MARKER,
  },
];
