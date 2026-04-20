"use client";

import { useState, useCallback, useRef, useEffect } from "react";

// --- 검색바 Props ---

interface SearchBarProps {
  readonly value: string;
  readonly onChange: (value: string) => void;
  readonly onSubmit: (value: string) => void;
  readonly placeholder?: string;
  readonly debounceMs?: number;
  readonly isLoading?: boolean;
}

// --- 로딩 스피너 ---

function LoadingSpinner() {
  return (
    <div
      className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin rounded-full border-2 border-slate-300 border-t-slate-600"
      role="status"
      aria-label="검색 중"
    />
  );
}

// --- 입력 초기화 버튼 ---

function ClearButton({ onClick }: Readonly<{ onClick: () => void }>) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="absolute right-3 top-1/2 -translate-y-1/2 flex min-h-[44px] min-w-[44px] items-center justify-center rounded-full text-muted-foreground hover:text-foreground hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      aria-label="검색어 지우기"
    >
      <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <line x1="18" y1="6" x2="6" y2="18" />
        <line x1="6" y1="6" x2="18" y2="18" />
      </svg>
    </button>
  );
}

// --- 검색바 컴포넌트 ---

export function SearchBar({
  value,
  onChange,
  onSubmit,
  placeholder = "검색어를 입력하세요 (예: 일차방정식, 분배법칙)",
  debounceMs = 300,
  isLoading = false,
}: SearchBarProps) {
  // 즉시 표시를 위한 내부 상태
  const [inputValue, setInputValue] = useState(value);
  const debounceTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  // 외부 value 변경 동기화
  useEffect(() => {
    setInputValue(value);
  }, [value]);

  // 디바운스 onChange
  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const newValue = e.target.value;
      setInputValue(newValue);

      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current);
      }

      debounceTimer.current = setTimeout(() => {
        onChange(newValue);
      }, debounceMs);
    },
    [onChange, debounceMs],
  );

  // Enter 키로 제출
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter") {
        if (debounceTimer.current) {
          clearTimeout(debounceTimer.current);
        }
        onChange(inputValue);
        onSubmit(inputValue);
      }
    },
    [inputValue, onChange, onSubmit],
  );

  // 검색어 초기화
  const handleClear = useCallback(() => {
    setInputValue("");
    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
    }
    onChange("");
  }, [onChange]);

  // 언마운트 시 타이머 정리
  useEffect(() => {
    return () => {
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current);
      }
    };
  }, []);

  return (
    <div className="relative">
      <div className="relative">
        {/* 검색 아이콘 */}
        <svg
          className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="11" cy="11" r="8" />
          <line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>

        <input
          type="text"
          value={inputValue}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className="w-full rounded-lg border border-slate-200 bg-white py-2.5 pl-10 pr-10 text-sm
            placeholder:text-slate-400
            focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-200"
        />

        {/* 로딩 스피너 또는 클리어 버튼 */}
        {isLoading ? (
          <LoadingSpinner />
        ) : inputValue ? (
          <ClearButton onClick={handleClear} />
        ) : null}
      </div>
    </div>
  );
}
