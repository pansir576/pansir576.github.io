import type { Metadata } from "next";
import { AdminDashboard } from "@/components/community/admin-dashboard";

export const metadata: Metadata = {
  title: "社区管理后台",
  robots: {
    index: false,
    follow: false,
  },
};

export default function CommunityAdminPage() {
  return <AdminDashboard />;
}
