import { describe, expect, it } from "vitest";
import type { ExperimentSnapshot } from "@/lib/types";
import { createInitialState } from "@/lib/simulator";
import {
  CHAT_MAX,
  POST_BODY_MAX,
  buildExperimentSummary,
  containsBlockedTerms,
  relativeTime,
  validateChat,
  validateNickname,
  validatePost,
  validateReply,
} from "@/lib/community/validation";

describe("community validation", () => {
  it("validates nickname length and unsupported characters", () => {
    expect(validateNickname("锅")).toContain("2");
    expect(validateNickname("锅边观察员")).toBeNull();
    expect(validateNickname("<script>")).not.toBeNull();
  });

  it("validates post category, title, body, tags and images", () => {
    expect(
      validatePost({
        category: "question",
        title: "青菜为什么变色",
        body: "焯水后颜色变暗，想知道酸和温度分别有什么影响。",
        tags: ["青菜", "pH"],
        imageCount: 2,
      }),
    ).toBeNull();
    expect(
      validatePost({
        category: "question",
        title: "短",
        body: "内容太短",
        tags: [],
        imageCount: 0,
      }),
    ).not.toBeNull();
  });

  it("limits chat and reply length", () => {
    expect(validateChat("a".repeat(CHAT_MAX + 1))).not.toBeNull();
    expect(validateReply("")).not.toBeNull();
    expect(validateReply("建议先控水，再试高温快炒。")).toBeNull();
  });

  it("blocks known prohibited terms", () => {
    expect(containsBlockedTerms("这里提供刷单")).toBe(true);
    expect(containsBlockedTerms("我想讨论青菜焯水")).toBe(false);
  });

  it("formats relative time", () => {
    const now = Date.now();
    expect(relativeTime(new Date(now - 20_000).toISOString(), now)).toBe("刚刚");
    expect(relativeTime(new Date(now - 120_000).toISOString(), now)).toContain("分钟");
  });

  it("creates a limited experiment summary without full local data", () => {
    const state = createInitialState("greens");
    const snapshot: ExperimentSnapshot = {
      version: 2,
      id: "experiment-test",
      name: "青菜快炒",
      ingredientId: "greens",
      actions: [{ type: "operation", operationId: "greens-tear" }],
      state,
      createdAt: new Date().toISOString(),
      branchLabel: "1 号试验锅",
    };
    const summary = buildExperimentSummary(snapshot);
    expect(summary.ingredientId).toBe("greens");
    expect(summary.actionCount).toBe(1);
    expect(summary).not.toHaveProperty("actions");
    expect(summary).not.toHaveProperty("state");
    expect(summary.appearance.length).toBeGreaterThan(2);
  });

  it("rejects oversized post text", () => {
    expect(
      validatePost({
        category: "chat",
        title: "一个合法的标题",
        body: "a".repeat(POST_BODY_MAX + 1),
        tags: [],
        imageCount: 0,
      }),
    ).not.toBeNull();
  });
});
