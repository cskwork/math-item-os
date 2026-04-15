"use client";

import { memo, useCallback, useRef, useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { trpc } from "@/lib/trpc";
import type { AuthoringBlock } from "../types";

interface CodeBlockProps {
  readonly block: AuthoringBlock;
  readonly onUpdate: (id: string, patch: Partial<AuthoringBlock>) => void;
}

const LANGUAGES = [
  { value: "C" as const, label: "C" },
  { value: "JAVA" as const, label: "Java" },
  { value: "PYTHON" as const, label: "Python" },
  { value: "SQL" as const, label: "SQL" },
] as const;

export const CodeBlock = memo(function CodeBlock({ block, onUpdate }: CodeBlockProps) {
  const editorRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<unknown>(null);

  const language = block.codeLanguage ?? "PYTHON";
  const code = block.code ?? "";

  // CodeMirror 동적 로드 + 초기화
  useEffect(() => {
    let destroyed = false;

    async function initEditor() {
      if (!editorRef.current || destroyed) return;

      const { EditorView, keymap, placeholder } = await import("@codemirror/view");
      const { EditorState } = await import("@codemirror/state");
      const { defaultKeymap, history, historyKeymap } = await import("@codemirror/commands");
      const { lineNumbers, highlightActiveLineGutter } = await import("@codemirror/view");

      // 언어별 확장 로드
      const langExt = await loadLanguageExtension(language);

      if (destroyed || !editorRef.current) return;

      // 기존 에디터 제거
      if (viewRef.current) {
        (viewRef.current as { destroy: () => void }).destroy();
      }

      const state = EditorState.create({
        doc: code,
        extensions: [
          lineNumbers(),
          highlightActiveLineGutter(),
          history(),
          keymap.of([...defaultKeymap, ...historyKeymap]),
          placeholder("코드를 입력하세요..."),
          langExt,
          EditorView.updateListener.of((update) => {
            if (update.docChanged) {
              onUpdate(block.id, { code: update.state.doc.toString() });
            }
          }),
          EditorView.theme({
            "&": { fontSize: "14px", maxHeight: "400px" },
            ".cm-scroller": { overflow: "auto" },
            ".cm-content": { fontFamily: "'Fira Code', 'JetBrains Mono', monospace" },
          }),
        ],
      });

      const view = new EditorView({
        state,
        parent: editorRef.current,
      });

      viewRef.current = view;
    }

    initEditor();

    return () => {
      destroyed = true;
      if (viewRef.current) {
        (viewRef.current as { destroy: () => void }).destroy();
        viewRef.current = null;
      }
    };
    // language 변경 시 에디터 재초기화
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [language]);

  const [execResult, setExecResult] = useState<{
    stdout: string | null;
    stderr: string | null;
    compileOutput: string | null;
    status: { description: string };
    time: string | null;
  } | null>(null);

  const executeMutation = trpc.code.execute.useMutation({
    onSuccess: (data) => setExecResult(data),
  });

  const handleLanguageChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      onUpdate(block.id, { codeLanguage: e.target.value as typeof language });
    },
    [block.id, onUpdate],
  );

  const handleRun = useCallback(() => {
    if (!code.trim()) return;
    setExecResult(null);
    executeMutation.mutate({ code, language });
  }, [code, language, executeMutation]);

  return (
    <div className="space-y-2">
      {/* 언어 선택 + 실행 버튼 */}
      <div className="flex items-center gap-2">
        <select
          value={language}
          onChange={handleLanguageChange}
          className={cn(
            "rounded-md border border-input bg-background px-3 py-1.5 text-sm",
            "focus:outline-none focus:ring-2 focus:ring-ring",
          )}
        >
          {LANGUAGES.map((lang) => (
            <option key={lang.value} value={lang.value}>
              {lang.label}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={handleRun}
          disabled={executeMutation.isPending || !code.trim()}
          className={cn(
            "rounded-md bg-primary/10 px-3 py-1.5 text-sm text-primary",
            "hover:bg-primary/20 transition-colors",
            "disabled:opacity-50 disabled:cursor-not-allowed",
          )}
        >
          {executeMutation.isPending ? "실행 중..." : "▶ 실행"}
        </button>
        {execResult?.time && (
          <span className="text-xs text-muted-foreground">
            {execResult.time}s
          </span>
        )}
      </div>

      {/* CodeMirror 에디터 */}
      <div
        ref={editorRef}
        className={cn(
          "min-h-[120px] rounded-md border border-input bg-muted/30",
          "overflow-hidden",
        )}
      />

      {/* 실행 결과 */}
      {executeMutation.error && (
        <div className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
          {executeMutation.error.message}
        </div>
      )}
      {execResult && (
        <div className="rounded-md border border-border bg-muted/30 p-3 space-y-1">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span className={cn(
              "font-medium",
              execResult.status.description === "성공" ? "text-emerald-600" : "text-destructive",
            )}>
              {execResult.status.description}
            </span>
          </div>
          {execResult.compileOutput && (
            <pre className="font-mono text-xs text-destructive whitespace-pre-wrap">{execResult.compileOutput}</pre>
          )}
          {execResult.stdout && (
            <pre className="font-mono text-sm whitespace-pre-wrap">{execResult.stdout}</pre>
          )}
          {execResult.stderr && (
            <pre className="font-mono text-xs text-orange-600 whitespace-pre-wrap">{execResult.stderr}</pre>
          )}
        </div>
      )}
    </div>
  );
});

/** 언어별 CodeMirror 확장 로드 */
async function loadLanguageExtension(lang: string) {
  switch (lang) {
    case "PYTHON": {
      const { python } = await import("@codemirror/lang-python");
      return python();
    }
    case "JAVA": {
      const { java } = await import("@codemirror/lang-java");
      return java();
    }
    case "SQL": {
      const { sql } = await import("@codemirror/lang-sql");
      return sql();
    }
    case "C": {
      const { cpp } = await import("@codemirror/lang-cpp");
      return cpp();
    }
    default: {
      const { python } = await import("@codemirror/lang-python");
      return python();
    }
  }
}
