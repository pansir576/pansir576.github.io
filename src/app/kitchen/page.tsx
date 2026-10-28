import type { Metadata } from "next";
import { Suspense } from "react";
import { KitchenLoading } from "@/components/kitchen/kitchen-loading";
import { KitchenStudio } from "@/components/kitchen/kitchen-studio";

export const metadata: Metadata = {
  title: "自由实验",
  description:
    "自由选择食材、预处理、火候与调料，观察每一步变化，保存并比较实验结果。",
};

export default function KitchenPage() {
  return (
    <div className="kitchen-page">
      <Suspense fallback={<KitchenLoading />}>
        <KitchenStudio />
      </Suspense>
    </div>
  );
}
