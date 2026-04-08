// 분석 서비스 단위 테스트 - 순수 함수만 테스트
import { describe, it, expect } from "vitest";
import { computeMedian } from "../analytics.service";

describe("computeMedian", () => {
  it("홀수 개: [1, 3, 5] -> 3", () => {
    expect(computeMedian([1, 3, 5])).toBe(3);
  });

  it("짝수 개: [1, 2, 3, 4] -> 2.5", () => {
    expect(computeMedian([1, 2, 3, 4])).toBe(2.5);
  });

  it("단일 값: [7] -> 7", () => {
    expect(computeMedian([7])).toBe(7);
  });

  it("빈 배열: [] -> 0", () => {
    expect(computeMedian([])).toBe(0);
  });

  it("정렬되지 않은 배열도 올바르게 처리: [5, 1, 3] -> 3", () => {
    expect(computeMedian([5, 1, 3])).toBe(3);
  });

  it("정렬되지 않은 짝수 개: [4, 1, 3, 2] -> 2.5", () => {
    expect(computeMedian([4, 1, 3, 2])).toBe(2.5);
  });

  it("동일한 값들: [5, 5, 5] -> 5", () => {
    expect(computeMedian([5, 5, 5])).toBe(5);
  });

  it("소수점 값: [1.5, 2.5, 3.5] -> 2.5", () => {
    expect(computeMedian([1.5, 2.5, 3.5])).toBe(2.5);
  });

  it("두 개 값: [10, 20] -> 15", () => {
    expect(computeMedian([10, 20])).toBe(15);
  });

  it("원본 배열을 변경하지 않는다 (immutability)", () => {
    const original = [3, 1, 2];
    computeMedian(original);
    expect(original).toEqual([3, 1, 2]);
  });
});
