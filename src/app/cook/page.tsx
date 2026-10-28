import type { Metadata } from "next";
import { RecipeKitchen } from "@/components/kitchen/recipe-kitchen";

export const metadata: Metadata = {
  title: "智能菜谱实训厨房",
  description:
    "按 25 道标准化菜谱完成备料、火候、调味和结果复盘，支持可控变量组合与即时纠错。",
};

export default function CookPage() {
  return <RecipeKitchen />;
}
