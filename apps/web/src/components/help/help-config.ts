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
  type LucideIcon,
} from "lucide-react";

// --- 타입 ---

export interface PageHelpEntry {
  readonly id: string;
  readonly title: string;
  readonly section: "main" | "admin";
  readonly icon: LucideIcon;
  readonly shortDescription: string;
  readonly tips: readonly string[];
  readonly fullDescription: string;
}

// --- 도움말 콘텐츠 ---

export const helpEntries: readonly PageHelpEntry[] = [
  // === 주요 기능 ===
  {
    id: "items",
    title: "문항 관리",
    section: "main",
    icon: FileText,
    shortDescription:
      "수학 문항을 등록, 조회, 수정할 수 있는 메인 관리 화면입니다. 상태, 학교급, 유형, 난이도별 필터링을 지원합니다.",
    tips: [
      "상단 필터를 조합하여 원하는 문항만 빠르게 찾을 수 있습니다",
      "카드를 클릭하면 문항 상세 편집 화면으로 이동합니다",
      "'새 문항' 버튼으로 직접 문항을 등록할 수 있습니다",
    ],
    fullDescription:
      "문항 관리는 시스템의 핵심 기능입니다. 등록된 모든 수학 문항을 카드 형태의 그리드 뷰로 확인할 수 있으며, 상태(초안/검토됨/승인됨/폐기됨), 학교급(초/중/고), 문항 유형, 난이도 범위 등 다양한 필터를 조합하여 원하는 문항을 빠르게 찾을 수 있습니다. 각 문항 카드에는 KaTeX으로 렌더링된 수식 미리보기, 난이도, 상태 배지가 표시됩니다. 카드를 클릭하면 상세 편집 화면으로 이동하여 문항 내용, 메타데이터, 스킬 태그 등을 수정할 수 있습니다.",
  },
  {
    id: "search",
    title: "검색",
    section: "main",
    icon: Search,
    shortDescription:
      "전문 검색(Full-text search)으로 문항을 찾습니다. 학교급, 학년, 유형, 난이도, 용도별 패싯 필터를 지원합니다.",
    tips: [
      "검색어를 입력하면 문항 내용, 풀이, 메타데이터를 모두 검색합니다",
      "좌측 패싯 필터로 결과를 좁힐 수 있습니다",
      "관련도, 난이도, 날짜순으로 정렬할 수 있습니다",
    ],
    fullDescription:
      "검색 기능은 Meilisearch 기반의 전문 검색을 제공합니다. 키워드를 입력하면 문항 본문, 풀이, 메타데이터를 통합 검색하여 관련 문항을 빠르게 찾을 수 있습니다. 좌측의 패싯 필터(학교급, 학년, 유형, 난이도, 용도)를 활용하면 검색 결과를 더 세밀하게 좁힐 수 있습니다. 검색 결과는 관련도, 난이도, 날짜순으로 정렬할 수 있으며, 검색 소요 시간도 함께 표시됩니다.",
  },
  {
    id: "skills-graph",
    title: "스킬 그래프",
    section: "main",
    icon: GitBranch,
    shortDescription:
      "수학 교육과정의 스킬(학습 요소) 간 계층 구조와 관계를 시각적으로 보여줍니다.",
    tips: [
      "마우스 휠로 확대/축소, 배경을 드래그하여 그래프를 이동할 수 있습니다",
      "노드를 클릭하면 해당 스킬에 연결된 문항을 확인할 수 있습니다",
      "확대/축소로 전체 구조를 파악하세요",
    ],
    fullDescription:
      "스킬 그래프는 수학 교육과정의 학습 요소(스킬)를 그래프 형태로 시각화합니다. 각 노드는 하나의 스킬을 나타내며, 간선은 선수 학습 관계를 표현합니다. 이를 통해 교육과정의 연계성을 한눈에 파악하고, 특정 스킬에 연결된 문항을 탐색할 수 있습니다. 그래프는 React Flow 기반으로 인터랙티브한 탐색이 가능합니다.",
  },
  {
    id: "misconceptions",
    title: "오개념",
    section: "main",
    icon: AlertTriangle,
    shortDescription:
      "학생들이 자주 범하는 오개념을 탐색하고, 단계별 교정 학습 경로를 생성합니다.",
    tips: [
      "좌측에서 오개념을 선택하면 우측에 교정 경로가 표시됩니다",
      "난이도 수준을 조절하여 학생 수준에 맞는 교정 경로를 생성할 수 있습니다",
      "교정 경로는 단계별로 구성되어 순서대로 학습하면 됩니다",
    ],
    fullDescription:
      "오개념 탐색 기능은 수학 학습에서 학생들이 자주 범하는 오류 유형을 분석하고, 이를 교정하기 위한 단계별 학습 경로를 제공합니다. 좌측 패널에서 오개념을 선택하면 우측 패널에 해당 오개념에 대한 교정 학습 경로가 생성됩니다. 난이도를 조절하여 학생의 현재 수준에 맞는 교정 자료를 구성할 수 있습니다.",
  },

  // === 관리 기능 ===
  {
    id: "admin-dashboard",
    title: "대시보드",
    section: "admin",
    icon: BarChart3,
    shortDescription:
      "전체 문항의 품질 지표를 한눈에 확인하는 관리자 대시보드입니다. KPI 카드, 상태 분포, 최근 활동 로그를 제공합니다.",
    tips: [
      "KPI 카드로 전체 문항 수, 검수 대기, 메타데이터 완성도, CAS 검증 통과율을 확인하세요",
      "상태 분포 차트로 초안/검토/승인/폐기 비율을 파악할 수 있습니다",
      "최근 활동 로그에서 시스템 변경 내역을 빠르게 확인할 수 있습니다",
    ],
    fullDescription:
      "관리자 대시보드는 시스템 전체의 품질 현황을 요약합니다. 상단의 KPI 카드는 전체 문항 수, 검수 대기 건수, 메타데이터 완성도, CAS(Computer Algebra System) 검증 통과율을 실시간으로 표시합니다. 중앙에는 문항 상태 분포(초안/검토됨/승인됨/폐기됨) 차트와 평균 난이도 게이지가 배치되어 있으며, 하단의 최근 활동 테이블에서 시스템 전반의 변경 내역을 시간순으로 확인할 수 있습니다.",
  },
  {
    id: "admin-reviews",
    title: "검수 큐",
    section: "admin",
    icon: ClipboardCheck,
    shortDescription:
      "문항 품질 검수 작업을 관리합니다. 태그 검수, 생성 검수, 중복 검수, 풀이 오류 등의 검수 유형을 지원합니다.",
    tips: [
      "검수 유형과 상태로 필터링하여 우선순위가 높은 작업부터 처리하세요",
      "각 항목의 '승인' 또는 '반려' 버튼으로 검수 결과를 기록합니다",
      "우선순위(1~5)가 높을수록 먼저 처리해야 할 작업입니다",
    ],
    fullDescription:
      "검수 큐는 문항 품질 관리의 핵심 워크플로우입니다. 시스템에서 자동으로 생성되거나 관리자가 수동으로 등록한 검수 작업을 대기열 형태로 관리합니다. 검수 유형(태그 검수, 생성 검수, 중복 검수, 풀이 오류)과 상태(대기/진행중/완료/반려), 우선순위(1~5)로 필터링할 수 있습니다. 각 검수 항목에 대해 승인 또는 반려 처리를 하면 해당 문항의 품질 상태가 자동으로 업데이트됩니다.",
  },
  {
    id: "admin-generate",
    title: "문항 생성",
    section: "admin",
    icon: Wand2,
    shortDescription:
      "템플릿 기반으로 변형 문항을 자동 생성합니다. 계수 범위, 분수/음수 옵션을 설정하고 CAS 검증 결과를 확인할 수 있습니다.",
    tips: [
      "좌측에서 템플릿을 선택한 뒤 우측에서 생성 옵션을 설정하세요",
      "생성 개수, 계수 범위, 분수/음수 포함 여부를 조절할 수 있습니다",
      "생성된 변형 문항은 CAS 검증을 거쳐 정답 확인이 완료된 것만 표시됩니다",
    ],
    fullDescription:
      "문항 생성 기능은 기존 문항 템플릿을 기반으로 계수나 변수를 변경한 변형 문항을 자동으로 생성합니다. 좌측 패널에서 템플릿을 선택하고, 우측 패널에서 생성 개수, 계수 범위(최소~최대), 분수 포함 여부, 음수 포함 여부 등의 옵션을 설정합니다. 생성된 문항은 CAS(Computer Algebra System)를 통해 정답이 검증되며, 검증 통과율과 함께 각 변형 문항의 미리보기를 확인할 수 있습니다.",
  },
  {
    id: "admin-assignments",
    title: "학습지",
    section: "admin",
    icon: BookOpen,
    shortDescription:
      "학습지(워크시트)를 생성하고 관리합니다. 진단, 교정, 시험대비, 심화 등 목적별로 문항을 조합합니다.",
    tips: [
      "용도(진단/교정/시험대비/심화)에 따라 적절한 난이도 범위가 자동 안내됩니다",
      "'새 학습지' 버튼으로 목적에 맞는 문항을 조합할 수 있습니다",
      "기존 학습지를 클릭하면 구성 문항을 편집할 수 있습니다",
    ],
    fullDescription:
      "학습지 관리 기능은 수학 교육 현장에서 사용할 워크시트를 생성하고 관리합니다. 학습지는 용도(진단 평가, 교정 학습, 시험 대비, 심화 학습)에 따라 적절한 난이도 범위의 문항이 자동으로 추천됩니다. 예를 들어 진단 평가는 전 범위(1~5), 교정 학습은 쉬운 문항 위주(1~2), 시험 대비는 중상 난이도(3~4), 심화 학습은 고난이도(4~5)를 중심으로 구성됩니다. 학습지 목록에서 제목, 용도, 문항 수, 생성일을 확인할 수 있습니다.",
  },
  {
    id: "admin-users",
    title: "사용자",
    section: "admin",
    icon: Users,
    shortDescription:
      "시스템 사용자의 역할(관리자/검수자/교사)을 관리합니다.",
    tips: [
      "역할 드롭다운에서 사용자의 권한을 즉시 변경할 수 있습니다",
      "관리자(admin)는 모든 기능에 접근 가능합니다",
      "교사(teacher)는 문항 조회와 학습지 관련 기능을 사용할 수 있습니다",
    ],
    fullDescription:
      "사용자 관리 페이지에서는 시스템에 등록된 모든 사용자의 목록을 확인하고 역할을 관리할 수 있습니다. 세 가지 역할(관리자/검수자/교사)이 있으며, 각 역할에 따라 접근 가능한 기능이 다릅니다. 관리자는 모든 기능에 접근할 수 있고, 검수자는 검수 큐와 문항 관리를 담당하며, 교사는 문항 조회와 학습지 사용이 가능합니다. 역할 드롭다운을 통해 사용자의 권한을 즉시 변경할 수 있습니다.",
  },
  {
    id: "admin-audit",
    title: "감사 로그",
    section: "admin",
    icon: ScrollText,
    shortDescription:
      "시스템 내 모든 변경 내역(생성/수정/삭제/승인/폐기/생성/배정)을 추적합니다.",
    tips: [
      "테이블명, 작업 유형, 날짜 범위로 필터링할 수 있습니다",
      "행을 펼치면 변경 전/후 데이터를 JSON으로 비교할 수 있습니다",
      "문제 추적이나 감사 시 변경 이력을 확인하는 데 활용하세요",
    ],
    fullDescription:
      "감사 로그는 시스템에서 발생한 모든 데이터 변경 내역을 기록합니다. 생성(create), 수정(update), 삭제(delete), 승인(approve), 폐기(retire), 문항 생성(generate), 배정(assign) 등 모든 작업이 기록되며, 테이블명, 작업 유형, 날짜 범위로 필터링할 수 있습니다. 각 로그 항목을 펼치면 변경 전(oldData)과 변경 후(newData)의 JSON 데이터를 비교하여 정확히 무엇이 변경되었는지 확인할 수 있습니다.",
  },
] as const;

// --- 유틸리티 ---

export function getHelpEntry(pageId: string): PageHelpEntry | undefined {
  return helpEntries.find((entry) => entry.id === pageId);
}

export function getHelpEntriesBySection(
  section: "main" | "admin",
): readonly PageHelpEntry[] {
  return helpEntries.filter((entry) => entry.section === section);
}
