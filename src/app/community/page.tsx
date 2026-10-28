import type { Metadata } from "next";
import { CommunityCenter } from "@/components/community/community-center";

export const metadata: Metadata = {
  title: "厨友交流",
  description:
    "在实时大厅和厨友聊天，或发布带图片与实验摘要的烹饪讨论。",
};

export default function CommunityPage() {
  return <CommunityCenter />;
}
