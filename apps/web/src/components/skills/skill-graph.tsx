"use client";

import { memo, useMemo, useCallback } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  type Node,
  type Edge,
  type NodeProps,
  type NodeMouseHandler,
  BackgroundVariant,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";

import { cn } from "@/lib/utils";
import { trpc } from "@/lib/trpc";
import { TYPE_LEVEL } from "@math-item-os/shared/constants/index";

// ─── 타입 정의 ───

/** 커스텀 노드에 전달되는 데이터 */
interface SkillNodeData extends Record<string, unknown> {
  readonly skillId: string;
  readonly title: string;
  readonly itemCount: number;
  readonly difficultyDistribution: Record<number, number>;
  readonly isRoot: boolean;
  readonly typeLevel: number | null;
}

type SkillNode = Node<SkillNodeData, "skill">;

export interface SkillGraphProps {
  readonly skillId: string;
  readonly depth?: number;
  readonly direction?: "ancestors" | "descendants" | "both";
  readonly onNodeClick?: (skillId: string) => void;
}

// ─── 난이도 색상 매핑 ───

const DIFFICULTY_COLORS: Record<number, string> = {
  1: "bg-green-400", // 매우 쉬움
  2: "bg-lime-400", // 쉬움
  3: "bg-yellow-400", // 보통
  4: "bg-orange-400", // 어려움
  5: "bg-red-400", // 매우 어려움
};

const NODE_WIDTH = 200;
const NODE_HEIGHT = 90;
const HORIZONTAL_GAP = 250;
const VERTICAL_GAP = 120;

// ─── BFS 기반 레이아웃 계산 ───

interface LayoutInput {
  readonly nodeIds: ReadonlyArray<string>;
  readonly edges: ReadonlyArray<{ from: string; to: string }>;
  readonly rootId: string;
  readonly direction: "ancestors" | "descendants" | "both";
}

/** 각 노드의 depth를 BFS로 계산한 뒤 그리드 좌표를 반환 */
function computeNodePositions(
  input: LayoutInput,
): Map<string, { x: number; y: number }> {
  const { nodeIds, edges, rootId, direction } = input;
  const positions = new Map<string, { x: number; y: number }>();

  // 인접 리스트 구성 (방향에 따라 탐색 방향 결정)
  const forwardAdj = new Map<string, string[]>(); // parent -> children (to -> from 방향)
  const backwardAdj = new Map<string, string[]>(); // child -> parents (from -> to 방향)

  for (const id of nodeIds) {
    forwardAdj.set(id, []);
    backwardAdj.set(id, []);
  }

  for (const edge of edges) {
    // edge.from -> edge.to (선수 -> 후속)
    // 후손 방향: from이 상위, to가 하위
    forwardAdj.get(edge.from)?.push(edge.to);
    backwardAdj.get(edge.to)?.push(edge.from);
  }

  // BFS: 루트에서 시작하여 depth 계산
  const depthMap = new Map<string, number>();
  depthMap.set(rootId, 0);

  // 방향에 따라 탐색할 인접 리스트 결정
  if (direction === "descendants" || direction === "both") {
    bfsTraverse(rootId, forwardAdj, depthMap, 1);
  }
  if (direction === "ancestors" || direction === "both") {
    bfsTraverse(rootId, backwardAdj, depthMap, -1);
  }

  // depth별 노드 그룹화
  const depthGroups = new Map<number, string[]>();
  for (const [nodeId, depth] of depthMap) {
    const group = depthGroups.get(depth) ?? [];
    depthGroups.set(depth, [...group, nodeId]);
  }

  // 그리드 좌표 할당
  for (const [depth, group] of depthGroups) {
    const totalWidth = group.length * HORIZONTAL_GAP;
    const startX = -totalWidth / 2 + HORIZONTAL_GAP / 2;

    for (let i = 0; i < group.length; i++) {
      positions.set(group[i], {
        x: startX + i * HORIZONTAL_GAP,
        y: depth * VERTICAL_GAP,
      });
    }
  }

  return positions;
}

/** BFS 탐색으로 depth 할당 (depthStep: +1이면 하위, -1이면 상위) */
function bfsTraverse(
  startId: string,
  adjacency: Map<string, string[]>,
  depthMap: Map<string, number>,
  depthStep: number,
): void {
  const queue: Array<{ id: string; depth: number }> = [];
  const startDepth = depthMap.get(startId) ?? 0;

  const neighbors = adjacency.get(startId) ?? [];
  for (const neighbor of neighbors) {
    if (!depthMap.has(neighbor)) {
      const nextDepth = startDepth + depthStep;
      depthMap.set(neighbor, nextDepth);
      queue.push({ id: neighbor, depth: nextDepth });
    }
  }

  while (queue.length > 0) {
    const current = queue.shift()!;
    const currentNeighbors = adjacency.get(current.id) ?? [];
    for (const neighbor of currentNeighbors) {
      if (!depthMap.has(neighbor)) {
        const nextDepth = current.depth + depthStep;
        depthMap.set(neighbor, nextDepth);
        queue.push({ id: neighbor, depth: nextDepth });
      }
    }
  }
}

// ─── 난이도 분포 바 컴포넌트 ───

const DifficultyBar = memo(function DifficultyBar({
  distribution,
}: {
  readonly distribution: Record<number, number>;
}) {
  const total = Object.values(distribution).reduce(
    (sum, count) => sum + count,
    0,
  );
  if (total === 0) return null;

  const segments = [1, 2, 3, 4, 5]
    .filter((level) => (distribution[level] ?? 0) > 0)
    .map((level) => ({
      level,
      count: distribution[level] ?? 0,
      widthPercent: ((distribution[level] ?? 0) / total) * 100,
    }));

  return (
    <div className="flex h-2 w-full overflow-hidden rounded-full">
      {segments.map((seg) => (
        <div
          key={seg.level}
          className={cn("h-full", DIFFICULTY_COLORS[seg.level])}
          style={{ width: `${seg.widthPercent}%` }}
          title={`난이도 ${seg.level}: ${seg.count}개`}
        />
      ))}
    </div>
  );
});

// ─── 문제 유형 레벨 색상 매핑 ───

function getTypeLevelColor(level: number): string {
  if (level <= 2) return "bg-green-100 text-green-700";
  if (level <= 4) return "bg-blue-100 text-blue-700";
  return "bg-purple-100 text-purple-700";
}

// ─── 커스텀 스킬 노드 컴포넌트 ───

const SkillNodeComponent = memo(function SkillNodeComponent({
  data,
}: NodeProps<SkillNode>) {
  const { title, itemCount, difficultyDistribution, isRoot, typeLevel } = data;

  return (
    <div
      className={cn(
        "flex flex-col gap-1.5 rounded-lg border-2 bg-white px-3 py-2 shadow-sm",
        "transition-shadow duration-150 hover:shadow-md",
        isRoot ? "border-blue-500" : "border-slate-300",
      )}
      style={{ width: NODE_WIDTH, minHeight: NODE_HEIGHT }}
    >
      {/* 스킬 제목 */}
      <p className="truncate text-center text-sm font-bold text-slate-800">
        {title}
      </p>

      {/* 문제 유형 레벨 배지 */}
      {typeLevel != null && (
        <p className={cn("mx-auto rounded-full px-2 py-0.5 text-center text-[10px] font-medium", getTypeLevelColor(typeLevel))}>
          {TYPE_LEVEL[typeLevel as keyof typeof TYPE_LEVEL]?.label ?? `L${typeLevel}`}
        </p>
      )}

      {/* 문항 수 배지 */}
      <p className="text-center text-xs text-slate-500">
        {itemCount}개 문항
      </p>

      {/* 난이도 분포 바 */}
      <DifficultyBar distribution={difficultyDistribution} />
    </div>
  );
});

// ─── 커스텀 노드 타입 레지스트리 ───

const NODE_TYPES = {
  skill: SkillNodeComponent,
} as const;

// ─── 로딩 스켈레톤 ───

function GraphSkeleton() {
  return (
    <div className="flex h-full w-full items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        {/* 스켈레톤 노드들 */}
        <div className="h-[90px] w-[200px] animate-pulse rounded-lg bg-slate-200" />
        <div className="flex gap-6">
          <div className="h-[90px] w-[200px] animate-pulse rounded-lg bg-slate-200" />
          <div className="h-[90px] w-[200px] animate-pulse rounded-lg bg-slate-200" />
        </div>
        <p className="text-sm text-slate-400">그래프 로딩 중...</p>
      </div>
    </div>
  );
}

// ─── 빈 그래프 표시 ───

function EmptyGraph() {
  return (
    <div className="flex h-full w-full items-center justify-center">
      <div className="flex flex-col items-center gap-2">
        <p className="text-sm text-slate-500">
          연결된 선수/후속 성취기준이 없습니다.
        </p>
      </div>
    </div>
  );
}

// ─── API 데이터를 React Flow 노드/엣지로 변환 ───

interface GraphData {
  readonly nodes: ReadonlyArray<{
    skill: {
      id: string;
      code: string;
      title: string;
      topicPath: string;
      bloomLevel: number | null;
      typeLevel: number | null;
    };
    itemCount: number;
    difficultyDistribution: Record<number, number>;
  }>;
  readonly edges: ReadonlyArray<{
    from: string;
    to: string;
    strength: "strong" | "weak";
    weight: number;
  }>;
}

function transformToReactFlowData(
  data: GraphData,
  rootSkillId: string,
  direction: "ancestors" | "descendants" | "both",
): { nodes: SkillNode[]; edges: Edge[] } {
  // 노드 위치 계산
  const positions = computeNodePositions({
    nodeIds: data.nodes.map((n) => n.skill.id),
    edges: data.edges.map((e) => ({ from: e.from, to: e.to })),
    rootId: rootSkillId,
    direction,
  });

  const nodes: SkillNode[] = data.nodes.map((nodeData) => {
    const position = positions.get(nodeData.skill.id) ?? { x: 0, y: 0 };
    return {
      id: nodeData.skill.id,
      type: "skill" as const,
      position,
      data: {
        skillId: nodeData.skill.id,
        title: nodeData.skill.title,
        itemCount: nodeData.itemCount,
        difficultyDistribution: nodeData.difficultyDistribution,
        isRoot: nodeData.skill.id === rootSkillId,
        typeLevel: nodeData.skill.typeLevel ?? null,
      },
    };
  });

  const edges: Edge[] = data.edges.map((edgeData, index) => {
    const isStrong = edgeData.strength === "strong";
    return {
      id: `edge-${edgeData.from}-${edgeData.to}-${index}`,
      source: edgeData.from,
      target: edgeData.to,
      animated: isStrong,
      style: {
        stroke: isStrong ? "#475569" : "#94a3b8",
        strokeWidth: isStrong ? 2 : 1,
        strokeDasharray: isStrong ? undefined : "5 5",
      },
    };
  });

  return { nodes, edges };
}

// ─── SkillGraph 메인 컴포넌트 ───

const SkillGraph = memo(function SkillGraph({
  skillId,
  depth = 2,
  direction = "both",
  onNodeClick,
}: SkillGraphProps) {
  const { data, isLoading } = trpc.skill.getPrerequisiteGraph.useQuery({
    skillId,
    depth,
    direction,
  });

  const { nodes, edges } = useMemo(() => {
    if (!data) return { nodes: [], edges: [] };
    return transformToReactFlowData(data, skillId, direction);
  }, [data, skillId, direction]);

  const handleNodeClick: NodeMouseHandler<SkillNode> = useCallback(
    (_event, node) => {
      onNodeClick?.(node.data.skillId);
    },
    [onNodeClick],
  );

  if (isLoading) {
    return <GraphSkeleton />;
  }

  // 루트 노드만 존재하는 경우 빈 그래프 표시
  if (nodes.length <= 1) {
    return <EmptyGraph />;
  }

  return (
    <div className="h-full w-full">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={NODE_TYPES}
        onNodeClick={handleNodeClick}
        fitView
        minZoom={0.3}
        maxZoom={1.5}
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable={false}
        proOptions={{ hideAttribution: true }}
      >
        <Background variant={BackgroundVariant.Dots} gap={16} size={1} />
        <Controls showInteractive={false} />
        <MiniMap
          nodeColor={(node) => {
            const skillNode = node as SkillNode;
            return skillNode.data.isRoot ? "#3b82f6" : "#cbd5e1";
          }}
          maskColor="rgba(0, 0, 0, 0.1)"
        />
      </ReactFlow>
    </div>
  );
});

export { SkillGraph };
