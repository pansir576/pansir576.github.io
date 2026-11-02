import type { Metadata } from "next";
import { GarlicLettucePrototype } from "@/components/kitchen/garlic-lettuce-prototype";

export const metadata: Metadata = {
  title: "蒜蓉油麦菜可玩原型",
  description:
    "完成洗切、蒜末爆香、大火断生和装盘，观察蒜香窗口与绿叶菜火候。",
};

export default function GarlicLettucePrototypePage() {
  return <GarlicLettucePrototype />;
}
