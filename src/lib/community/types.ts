export type PostCategory = "question" | "experience" | "experiment" | "chat";
export type CommunityTab = "lobby" | "discussion";
export type ReportTarget = "post" | "reply" | "chat";
export type ReportStatus = "pending" | "resolved" | "dismissed";

export interface CommunityProfile {
  id: string;
  nickname: string;
  avatarColor: string;
  isAdmin: boolean;
  bannedUntil?: string | null;
  createdAt: string;
}

export interface CommunityAuthor {
  id: string;
  nickname: string;
  avatarColor: string;
}

export interface ExperimentSummary {
  experimentId: string;
  name: string;
  ingredientId: string;
  goal?: string;
  actionCount: number;
  appearance: string;
  flavorSummary: string;
  textureSummary: string;
}

export interface CommunityPost {
  id: string;
  author: CommunityAuthor;
  category: PostCategory;
  title: string;
  body: string;
  tags: string[];
  imageUrls: string[];
  experimentSummary?: ExperimentSummary | null;
  likeCount: number;
  replyCount: number;
  likedByMe: boolean;
  isPinned: boolean;
  createdAt: string;
}

export interface CommunityReply {
  id: string;
  postId: string;
  author: CommunityAuthor;
  body: string;
  createdAt: string;
  isHidden: boolean;
}

export interface CommunityChatMessage {
  id: string;
  author: CommunityAuthor;
  body: string;
  createdAt: string;
}

export interface ModerationReport {
  id: string;
  targetType: ReportTarget;
  targetId: string;
  targetPreview: string;
  reason: string;
  status: ReportStatus;
  reporter: CommunityAuthor;
  createdAt: string;
}

export interface CommunityConnectionState {
  configured: boolean;
  connected: boolean;
  onlineCount: number;
  status: "demo" | "connecting" | "connected" | "error" | "offline";
  error?: string;
}
