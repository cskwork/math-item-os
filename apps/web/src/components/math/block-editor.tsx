"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import { MathInline } from "./extensions/math-inline";
import { MathBlock } from "./extensions/math-block";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface BlockEditorProps {
  readonly value: any; // Tiptap JSON
  readonly onChange: (json: any) => void;
  readonly onLatexChange: (latex: string) => void;
  readonly initialLatex?: string;
  readonly label?: string;
  readonly error?: string;
}

// ---------------------------------------------------------------------------
// Serializer: Tiptap JSON -> LaTeX string
// ---------------------------------------------------------------------------

export function serializeToLatex(json: any): string {
  if (!json?.content) return "";

  const parts: string[] = [];

  for (const node of json.content) {
    if (node.type === "mathBlock") {
      parts.push(`$$${node.attrs?.latex ?? ""}$$`);
    } else if (node.type === "paragraph") {
      const inlineParts: string[] = [];
      if (node.content) {
        for (const child of node.content) {
          if (child.type === "mathInline") {
            inlineParts.push(`$${child.attrs?.latex ?? ""}$`);
          } else if (child.type === "text") {
            inlineParts.push(child.text ?? "");
          }
        }
      }
      parts.push(inlineParts.join(""));
    }
  }

  return parts.join("\n");
}

/** Convert a raw LaTeX string to a Tiptap JSON doc with a single math block */
function latexToDoc(latex: string): any {
  return {
    type: "doc",
    content: [
      {
        type: "mathBlock",
        attrs: { latex },
      },
    ],
  };
}

// ---------------------------------------------------------------------------
// Toolbar
// ---------------------------------------------------------------------------

function Toolbar({ editor }: { readonly editor: ReturnType<typeof useEditor> }) {
  if (!editor) return null;

  const btn =
    "inline-flex h-8 w-8 items-center justify-center rounded text-sm hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-40";

  return (
    <div className="flex flex-wrap items-center gap-0.5 border-b border-slate-200 px-2 py-1 dark:border-slate-700">
      <button
        type="button"
        onClick={() => editor.chain().focus().toggleBold().run()}
        className={cn(btn, editor.isActive("bold") && "bg-slate-200 dark:bg-slate-600")}
        title="굵게"
      >
        <strong>B</strong>
      </button>
      <button
        type="button"
        onClick={() => editor.chain().focus().toggleItalic().run()}
        className={cn(btn, editor.isActive("italic") && "bg-slate-200 dark:bg-slate-600")}
        title="기울임"
      >
        <em>I</em>
      </button>

      <div className="mx-1 h-5 w-px bg-slate-200 dark:bg-slate-700" />

      <button
        type="button"
        onClick={() => {
          editor
            .chain()
            .focus()
            .insertContent({ type: "mathInline", attrs: { latex: "" } })
            .run();
        }}
        className={btn}
        title="인라인 수식 ($...$)"
      >
        <span className="font-mono text-xs">$x$</span>
      </button>
      <button
        type="button"
        onClick={() => {
          editor
            .chain()
            .focus()
            .insertContent({ type: "mathBlock", attrs: { latex: "" } })
            .run();
        }}
        className={btn}
        title="디스플레이 수식 ($$...$$)"
      >
        <span className="font-mono text-xs">$$</span>
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// BlockEditor
// ---------------------------------------------------------------------------

function BlockEditor({
  value,
  onChange,
  onLatexChange,
  initialLatex,
  label,
  error,
}: BlockEditorProps) {
  const [sourceMode, setSourceMode] = useState(false);
  const [rawLatex, setRawLatex] = useState("");
  const suppressUpdateRef = useRef(false);

  // Determine initial content
  const initialContent =
    value && value.content
      ? value
      : initialLatex
        ? latexToDoc(initialLatex)
        : undefined;

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        // Disable features we don't need to keep it simple
        codeBlock: false,
        blockquote: false,
        horizontalRule: false,
        heading: false,
      }),
      Placeholder.configure({
        placeholder: "텍스트와 수식을 입력하세요...",
      }),
      MathInline,
      MathBlock,
    ],
    content: initialContent,
    onUpdate: ({ editor: ed }) => {
      if (suppressUpdateRef.current) return;
      const json = ed.getJSON();
      onChange(json);
      onLatexChange(serializeToLatex(json));
    },
  });

  // Sync rawLatex for source mode
  useEffect(() => {
    if (editor && !sourceMode) {
      setRawLatex(serializeToLatex(editor.getJSON()));
    }
  }, [editor, sourceMode]);

  // Handle switching from source mode back to rich mode
  const handleToggleSource = useCallback(() => {
    if (sourceMode && editor) {
      // Apply raw LaTeX back to editor
      const doc = latexToDoc(rawLatex);
      suppressUpdateRef.current = true;
      editor.commands.setContent(doc);
      suppressUpdateRef.current = false;
      onChange(doc);
      onLatexChange(rawLatex);
    } else if (editor) {
      setRawLatex(serializeToLatex(editor.getJSON()));
    }
    setSourceMode((prev) => !prev);
  }, [sourceMode, editor, rawLatex, onChange, onLatexChange]);

  const handleRawChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      setRawLatex(e.target.value);
      onLatexChange(e.target.value);
    },
    [onLatexChange],
  );

  return (
    <div className="flex flex-col gap-2">
      {/* Label + source toggle */}
      <div className="flex items-center justify-between">
        {label && (
          <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
            {label}
          </label>
        )}
        <button
          type="button"
          onClick={handleToggleSource}
          className="text-xs text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-300"
        >
          {sourceMode ? "리치 모드" : "소스 모드"}
        </button>
      </div>

      {sourceMode ? (
        <textarea
          value={rawLatex}
          onChange={handleRawChange}
          spellCheck={false}
          className={cn(
            "min-h-[200px] resize-y rounded-md border bg-white p-3 font-mono text-sm dark:bg-slate-900 dark:text-slate-100",
            "focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-1 dark:focus:ring-slate-500",
            "placeholder:text-slate-400 dark:placeholder:text-slate-500",
            error
              ? "border-red-400 focus:ring-red-400"
              : "border-slate-200 dark:border-slate-700",
          )}
          placeholder="LaTeX 소스를 직접 입력하세요"
        />
      ) : (
        <div
          className={cn(
            "rounded-md border",
            error
              ? "border-red-400"
              : "border-slate-200 dark:border-slate-700",
          )}
        >
          <Toolbar editor={editor} />
          <EditorContent
            editor={editor}
            className={cn(
              "prose prose-sm dark:prose-invert max-w-none",
              "min-h-[200px] p-3",
              "[&_.ProseMirror]:min-h-[200px] [&_.ProseMirror]:outline-none",
              "[&_.ProseMirror_p.is-editor-empty:first-child::before]:text-slate-400 [&_.ProseMirror_p.is-editor-empty:first-child::before]:content-[attr(data-placeholder)]",
            )}
          />
        </div>
      )}

      {/* Error */}
      {error && <p className="text-sm text-red-500">{error}</p>}
    </div>
  );
}

export { BlockEditor };
export type { BlockEditorProps };
