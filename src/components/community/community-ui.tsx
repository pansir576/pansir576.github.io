import {
  AlertTriangle,
  CheckCircle2,
  FlaskConical,
  MessagesSquare,
  Wifi,
  WifiOff,
} from "lucide-react";
import type {
  CommunityAuthor,
  CommunityConnectionState,
  PostCategory,
} from "@/lib/community/types";
import { postCategories } from "@/lib/community/validation";

export function CommunityAvatar({
  author,
  size = "medium",
}: {
  author: Pick<CommunityAuthor, "nickname" | "avatarColor">;
  size?: "small" | "medium" | "large";
}) {
  return (
    <span
      className={`community-avatar avatar-${size}`}
      style={{ backgroundColor: author.avatarColor }}
      aria-hidden="true"
    >
      {author.nickname.slice(0, 1)}
    </span>
  );
}

export function CategoryBadge({ category }: { category: PostCategory }) {
  const definition = postCategories.find((item) => item.id === category);
  return (
    <span className={`community-category category-${category}`}>
      {definition?.label ?? category}
    </span>
  );
}

export function CommunityStatusBanner({
  connection,
}: {
  connection: CommunityConnectionState;
}) {
  if (connection.configured && connection.connected) {
    return (
      <div className="community-status is-connected">
        <Wifi size={15} />
        实时连接正常 · {connection.onlineCount} 人在线
      </div>
    );
  }
  if (connection.configured && connection.status === "connecting") {
    return (
      <div className="community-status">
        <MessagesSquare size={15} />
        正在连接厨友大厅…
      </div>
    );
  }
  if (connection.configured && connection.status === "error") {
    return (
      <div className="community-status is-error">
        <WifiOff size={15} />
        实时连接异常：{connection.error ?? "请稍后重试"}
      </div>
    );
  }
  return (
    <div className="community-status is-demo">
      <FlaskConical size={15} />
      演示模式：Supabase 尚未配置，当前示例消息不会发送给其他用户
    </div>
  );
}

export function CommunityNotice({
  tone,
  children,
}: {
  tone: "success" | "warning";
  children: React.ReactNode;
}) {
  return (
    <div className={`community-inline-notice is-${tone}`} role="status">
      {tone === "success" ? <CheckCircle2 size={15} /> : <AlertTriangle size={15} />}
      {children}
    </div>
  );
}
