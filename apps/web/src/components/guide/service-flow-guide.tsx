"use client";

import { memo } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  BackgroundVariant,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";

import { guideNodes, guideEdges } from "./flow-data";
import { GuideNodeComponent } from "./guide-node";

const NODE_TYPES = { guide: GuideNodeComponent } as const;

export const ServiceFlowGuide = memo(function ServiceFlowGuide() {
  return (
    <div className="h-full w-full">
      <ReactFlow
        nodes={guideNodes}
        edges={guideEdges}
        nodeTypes={NODE_TYPES}
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
        <MiniMap maskColor="rgba(0, 0, 0, 0.1)" />
      </ReactFlow>
    </div>
  );
});
