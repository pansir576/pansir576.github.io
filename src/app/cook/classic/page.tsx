import type { Metadata } from "next";
import { GuidedKitchen } from "@/components/kitchen/guided-kitchen";

export const metadata: Metadata = {
  title: "经典一人称厨房",
  description:
    "使用稳定的 2.5D 一人称厨房完整体验食材处理、火候、调味和原理复盘。",
};

export default function ClassicCookPage() {
  return <GuidedKitchen />;
}
