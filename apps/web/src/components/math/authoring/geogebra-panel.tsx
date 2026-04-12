"use client";

import { useState, useEffect, useRef, useCallback, memo } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import type { GeoGebraMode } from "./popup-types";

// --- GeoGebra 스크립트 동적 로드 ---

let ggbLoadPromise: Promise<void> | null = null;

function loadGeoGebraScript(): Promise<void> {
  if (ggbLoadPromise) return ggbLoadPromise;
  ggbLoadPromise = new Promise((resolve, reject) => {
    if (typeof window !== "undefined" && (window as any).GGBApplet) {
      resolve();
      return;
    }
    const script = document.createElement("script");
    script.src = "https://www.geogebra.org/apps/deployggb.js";
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("GeoGebra 스크립트 로드 실패"));
    document.head.appendChild(script);
  });
  return ggbLoadPromise;
}

// --- 모드 탭 정의 ---

const MODES: readonly { key: GeoGebraMode; label: string; appName: string }[] = [
  { key: "graphing", label: "함수 그래프", appName: "graphing" },
  { key: "geometry", label: "기하 작도", appName: "geometry" },
  { key: "classic", label: "통합", appName: "classic" },
];

// --- 컴포넌트 ---

interface GeoGebraPanelProps {
  readonly onExportImage: (dataUrl: string) => void;
}

const GeoGebraPanel = memo(function GeoGebraPanel({
  onExportImage,
}: GeoGebraPanelProps) {
  const [mode, setMode] = useState<GeoGebraMode>("graphing");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const apiRef = useRef<any>(null);
  const instanceId = useRef(`ggb-${Date.now()}`);

  useEffect(() => {
    let cancelled = false;

    async function init() {
      setLoading(true);
      setError(null);
      apiRef.current = null;

      try {
        await loadGeoGebraScript();
        if (cancelled || !containerRef.current) return;

        const container = containerRef.current;
        container.innerHTML = "";
        const elementId = instanceId.current;

        const div = document.createElement("div");
        div.id = elementId;
        container.appendChild(div);

        const modeConfig = MODES.find((m) => m.key === mode)!;
        const params = {
          appName: modeConfig.appName,
          width: container.clientWidth,
          height: 450,
          showMenuBar: false,
          showToolBar: true,
          showAlgebraInput: true,
          language: "ko",
          appletOnLoad: (api: any) => {
            if (!cancelled) {
              apiRef.current = api;
              setLoading(false);
            }
          },
        };

        const applet = new (window as any).GGBApplet(params, true);
        applet.inject(elementId);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "GeoGebra 초기화 실패");
          setLoading(false);
        }
      }
    }

    init();
    return () => { cancelled = true; };
  }, [mode]);

  const handleExport = useCallback(() => {
    const api = apiRef.current;
    if (!api) return;
    try {
      const base64 = api.getPNGBase64(1.0);
      onExportImage(`data:image/png;base64,${base64}`);
    } catch {
      setError("이미지 내보내기 실패");
    }
  }, [onExportImage]);

  return (
    <div className="flex flex-col gap-3">
      {/* 모드 탭 */}
      <div className="flex gap-1">
        {MODES.map((m) => (
          <button
            key={m.key}
            type="button"
            onClick={() => setMode(m.key)}
            className={cn(
              "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
              mode === m.key
                ? "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300"
                : "text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800",
            )}
          >
            {m.label}
          </button>
        ))}
      </div>

      {/* GeoGebra 컨테이너 */}
      <div className="relative min-h-[450px] rounded-md border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900">
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center bg-white/80 dark:bg-slate-900/80">
            <span className="text-sm text-slate-400">GeoGebra 로딩 중...</span>
          </div>
        )}
        {error && (
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-sm text-red-500">{error}</span>
          </div>
        )}
        <div ref={containerRef} className="h-[450px] w-full" />
      </div>

      {/* 내보내기 버튼 */}
      <div className="flex justify-end">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleExport}
          disabled={loading || !!error}
        >
          이미지로 내보내기
        </Button>
      </div>
    </div>
  );
});

export { GeoGebraPanel };
