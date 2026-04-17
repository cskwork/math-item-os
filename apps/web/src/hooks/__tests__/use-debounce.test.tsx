// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act, cleanup } from "@testing-library/react";
import { useDebounce } from "../use-debounce";

describe("useDebounce", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it("returns initial value immediately", () => {
    const { result } = renderHook(() => useDebounce("initial", 300));
    expect(result.current).toBe("initial");
  });

  it("collapses rapid changes into a single debounced update", () => {
    const { result, rerender } = renderHook(
      ({ value }: { value: string }) => useDebounce(value, 300),
      { initialProps: { value: "a" } },
    );

    // 3 rapid changes within 300ms
    act(() => {
      vi.advanceTimersByTime(50);
    });
    rerender({ value: "ab" });

    act(() => {
      vi.advanceTimersByTime(50);
    });
    rerender({ value: "abc" });

    act(() => {
      vi.advanceTimersByTime(50);
    });
    rerender({ value: "abcd" });

    // Total 299ms since last change -> still initial
    act(() => {
      vi.advanceTimersByTime(299);
    });
    expect(result.current).toBe("a");

    // +1ms -> final value, skipping intermediates
    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(result.current).toBe("abcd");
  });
});
