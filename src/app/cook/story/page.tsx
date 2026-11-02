import type { Metadata } from "next";
import { StoryKitchen } from "@/components/kitchen/story-kitchen";

export const metadata: Metadata = {
  title: "烹语剧场 · 夏弥的 2D 厨房",
  description:
    "在固定 2D 厨房中与夏弥互动，完成 25 道菜的步骤、分支和龙化纠错演出。",
};

export default function StoryKitchenPage() {
  return <StoryKitchen />;
}
