"use client";

import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { ChevronsUpDown, Check } from "lucide-react";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

interface ComboboxOption {
  readonly value: string;
  readonly label: string;
}

interface ComboboxProps {
  readonly options: readonly ComboboxOption[];
  readonly value: string;
  readonly onChange: (value: string) => void;
  readonly placeholder?: string;
  readonly searchPlaceholder?: string;
  readonly emptyText?: string;
  readonly className?: string;
}

function Combobox({
  options,
  value,
  onChange,
  placeholder = "Select...",
  searchPlaceholder = "Search...",
  emptyText = "No results found.",
  className,
}: ComboboxProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setSearch("");
      requestAnimationFrame(() => {
        inputRef.current?.focus();
      });
    }
  }, [open]);

  const filtered = useMemo(() => {
    const term = search.toLowerCase();
    if (term === "") return options;
    return options.filter((opt) => opt.label.toLowerCase().includes(term));
  }, [options, search]);

  const selectedLabel = useMemo(() => {
    if (!value) return null;
    return options.find((opt) => opt.value === value)?.label ?? null;
  }, [options, value]);

  const handleSelect = useCallback(
    (optionValue: string) => {
      onChange(optionValue);
      setOpen(false);
    },
    [onChange],
  );

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          role="combobox"
          aria-expanded={open}
          className={cn(
            "flex h-9 items-center justify-between gap-2 rounded-md border border-slate-200 bg-white px-3 text-sm",
            "hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-1",
            !selectedLabel && "text-slate-500",
            className,
          )}
        >
          <span className="truncate">
            {selectedLabel ?? placeholder}
          </span>
          <ChevronsUpDown className="h-4 w-4 shrink-0 text-slate-400" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        className="w-[--radix-popover-trigger-width] p-0"
        align="start"
      >
        <div className="border-b border-slate-200 px-3 py-2">
          <input
            ref={inputRef}
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={searchPlaceholder}
            className="h-8 w-full bg-transparent text-sm outline-none placeholder:text-slate-400"
          />
        </div>
        <div className="max-h-60 overflow-auto p-1">
          {filtered.length === 0 ? (
            <p className="px-3 py-6 text-center text-sm text-slate-500">
              {emptyText}
            </p>
          ) : (
            filtered.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => handleSelect(opt.value)}
                className={cn(
                  "flex w-full items-center gap-2 rounded-sm px-3 py-2 text-sm",
                  "hover:bg-slate-100 focus:bg-slate-100 focus:outline-none",
                  opt.value === value && "font-medium",
                )}
              >
                <Check
                  className={cn(
                    "h-4 w-4 shrink-0",
                    opt.value === value ? "text-slate-900" : "text-transparent",
                  )}
                />
                <span className="truncate">{opt.label}</span>
              </button>
            ))
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

export { Combobox };
export type { ComboboxOption, ComboboxProps };
