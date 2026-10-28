import type { Metadata } from "next";
import { CompareView } from "@/components/compare/compare-view";

export const metadata: Metadata = {
  title: "实验对比",
  description: "并排查看最多 3 个已保存实验结果，比较味觉、外观与操作步骤。",
};

export default function ComparePage() {
  return (
    <div className="compare-page">
      <CompareView />
    </div>
  );
}
