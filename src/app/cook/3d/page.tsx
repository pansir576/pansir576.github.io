import type { Metadata } from "next";
import { ThreeDKitchenEntry } from "@/components/kitchen/three-d/three-d-kitchen-entry";

export const metadata: Metadata = {
  title: "3D 演示厨房",
  description: "保留的第一人称 3D 厨房演示，不属于标准菜谱实训主流程。",
};

export default function ThreeDDemoPage() {
  return <ThreeDKitchenEntry />;
}
