import type { Metadata } from "next";
import { TomatoEggPrototype } from "@/components/kitchen/tomato-egg-prototype";

export const metadata: Metadata = {
  title: "番茄炒蛋可玩原型",
  description:
    "通过拖拽、切配、火候、翻炒和调味完成一盘番茄炒蛋，并根据真实操作获得结果评价。",
};

export default function TomatoEggPrototypePage() {
  return <TomatoEggPrototype />;
}
