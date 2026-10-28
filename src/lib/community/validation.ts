import type { ExperimentSnapshot } from "../types";
import type {
  ExperimentSummary,
  PostCategory,
} from "./types";

export const NICKNAME_MIN = 2;
export const NICKNAME_MAX = 16;
export const POST_TITLE_MIN = 4;
export const POST_TITLE_MAX = 80;
export const POST_BODY_MIN = 10;
export const POST_BODY_MAX = 2000;
export const REPLY_MAX = 1000;
export const CHAT_MAX = 300;
export const MAX_TAGS = 5;
export const MAX_IMAGES = 3;
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

export const postCategories: {
  id: PostCategory;
  label: string;
  description: string;
}[] = [
  { id: "question", label: "提问", description: "把卡住你的步骤说清楚" },
  { id: "experience", label: "经验分享", description: "分享处理食材和调味心得" },
  { id: "experiment", label: "实验结果", description: "展示一次操作或 A/B 对照结果" },
  { id: "chat", label: "闲聊", description: "厨友之间的轻松交流" },
];

export const communityRules = [
  "禁止违法、暴力、色情、仇恨和歧视内容。",
  "禁止泄露自己或他人的隐私信息。",
  "禁止广告、诈骗、恶意链接和冒充他人。",
  "分享实验结果时请说明条件，不要把模拟值当成现实测量。",
];

const blockedTerms = [
  "代开发票",
  "博彩",
  "赌博",
  "色情",
  "约炮",
  "加微信返利",
  "刷单",
  "诈骗",
];

export function validateNickname(value: string): string | null {
  const nickname = value.trim();
  if (nickname.length < NICKNAME_MIN || nickname.length > NICKNAME_MAX) {
    return `昵称需要 ${NICKNAME_MIN}–${NICKNAME_MAX} 个字符`;
  }
  if (/[\u0000-\u001f<>]/.test(nickname)) {
    return "昵称包含不支持的字符";
  }
  return null;
}

export function containsBlockedTerms(value: string): boolean {
  const lowered = value.toLocaleLowerCase("zh-CN");
  return blockedTerms.some((term) => lowered.includes(term));
}

export function validatePost(input: {
  category: PostCategory;
  title: string;
  body: string;
  tags: string[];
  imageCount: number;
}): string | null {
  if (!postCategories.some((item) => item.id === input.category)) {
    return "请选择帖子分类";
  }
  const title = input.title.trim();
  const body = input.body.trim();
  if (title.length < POST_TITLE_MIN || title.length > POST_TITLE_MAX) {
    return `标题需要 ${POST_TITLE_MIN}–${POST_TITLE_MAX} 个字符`;
  }
  if (body.length < POST_BODY_MIN || body.length > POST_BODY_MAX) {
    return `正文需要 ${POST_BODY_MIN}–${POST_BODY_MAX} 个字符`;
  }
  if (input.tags.length > MAX_TAGS) return `最多添加 ${MAX_TAGS} 个标签`;
  if (input.imageCount > MAX_IMAGES) return `最多上传 ${MAX_IMAGES} 张图片`;
  if (containsBlockedTerms(`${title}\n${body}\n${input.tags.join(" ")}`)) {
    return "内容包含社区规则禁止的词语，请修改后再提交";
  }
  return null;
}

export function validateReply(body: string): string | null {
  const value = body.trim();
  if (!value) return "回复不能为空";
  if (value.length > REPLY_MAX) return `回复不能超过 ${REPLY_MAX} 个字符`;
  if (containsBlockedTerms(value)) return "回复包含社区规则禁止的词语";
  return null;
}

export function validateChat(body: string): string | null {
  const value = body.trim();
  if (!value) return "消息不能为空";
  if (value.length > CHAT_MAX) return `消息不能超过 ${CHAT_MAX} 个字符`;
  if (containsBlockedTerms(value)) return "消息包含社区规则禁止的词语";
  return null;
}

export function validateImage(file: File): string | null {
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
    return `${file.name}：仅支持 JPG、PNG 或 WebP`;
  }
  if (file.size > MAX_IMAGE_BYTES) {
    return `${file.name}：单张图片不能超过 5 MB`;
  }
  return null;
}

export function avatarColorFor(value: string): string {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) | 0;
  }
  const colors = [
    "#39724b",
    "#c84b35",
    "#b17828",
    "#477d8e",
    "#76528d",
    "#8e5a2d",
    "#667f45",
  ];
  return colors[Math.abs(hash) % colors.length];
}

export function relativeTime(value: string, now = Date.now()): string {
  const delta = new Date(value).getTime() - now;
  const abs = Math.abs(delta);
  if (abs < 60_000) return "刚刚";
  if (abs < 3_600_000) return `${Math.round(delta / 60_000)} 分钟前`;
  if (abs < 86_400_000) return `${Math.round(delta / 3_600_000)} 小时前`;
  if (abs < 604_800_000) return `${Math.round(delta / 86_400_000)} 天前`;
  return new Date(value).toLocaleDateString("zh-CN", {
    month: "short",
    day: "numeric",
  });
}

export function buildExperimentSummary(
  experiment: ExperimentSnapshot,
): ExperimentSummary {
  const flavorEntries = [
    ["酸", experiment.state.flavor.sour],
    ["甜", experiment.state.flavor.sweet],
    ["咸", experiment.state.flavor.salty],
    ["鲜", experiment.state.flavor.umami],
    ["辣", experiment.state.flavor.spicy],
  ] as const;
  const strongest = flavorEntries.reduce((a, b) => (a[1] >= b[1] ? a : b));
  return {
    experimentId: experiment.id,
    name: experiment.name,
    ingredientId: experiment.ingredientId,
    goal: experiment.goal,
    actionCount: experiment.actions.length,
    appearance: experiment.state.appearance.label,
    flavorSummary:
      strongest[1] < 10 ? "味道清淡" : `${strongest[0]}味较突出`,
    textureSummary: `嫩度 ${Math.round(experiment.state.properties.tenderness)}，脆度 ${Math.round(experiment.state.properties.crispness)}`,
  };
}
