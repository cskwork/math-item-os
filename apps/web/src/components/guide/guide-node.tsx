"use client";

import { memo } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import type { NodeProps } from "@xyflow/react";
import { Handle, Position } from "@xyflow/react";
import type { GuideNodeData, GuideNode, GuideCategory } from "./flow-data";

const NODE_WIDTH = 210;

const CATEGORY_STYLES: Record<GuideCategory, string> = {
  start: "border-blue-500 bg-blue-50",
  core: "border-slate-400 bg-white",
  admin: "border-amber-400 bg-amber-50",
  utility: "border-green-400 bg-green-50",
};

const GuideNodeComponent = memo(function GuideNodeComponent({
  data,
}: NodeProps<GuideNode>) {
  const { label, description, tip, href, category, icon: Icon } = data;

  const content = (
    <div
      className={cn(
        "flex flex-col items-center gap-1.5 rounded-lg border-2 px-3 py-3 shadow-sm",
        "transition-shadow duration-150 hover:shadow-md",
        CATEGORY_STYLES[category],
        href && "cursor-pointer",
      )}
      style={{ width: NODE_WIDTH }}
    >
      <Icon className="h-5 w-5 text-slate-600" />
      <p className="text-sm font-bold text-slate-800">{label}</p>
      <p className="text-center text-[11px] leading-tight text-slate-500">
        {description}
      </p>
      <div className="mt-1 w-full border-t border-slate-200 pt-1.5">
        <p className="text-center text-[10px] leading-snug text-slate-400">
          {tip}
        </p>
      </div>
    </div>
  );

  return (
    <>
      <Handle type="target" position={Position.Left} className="!invisible" />
      {href ? (
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        <Link href={href as any}>{content}</Link>
      ) : (
        content
      )}
      <Handle type="source" position={Position.Right} className="!invisible" />
    </>
  );
});

export { GuideNodeComponent };
