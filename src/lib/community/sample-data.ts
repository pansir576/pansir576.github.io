import type {
  CommunityChatMessage,
  CommunityPost,
  CommunityReply,
} from "./types";

const demoNow = new Date("2026-10-24T22:30:00+08:00").getTime();
const ago = (minutes: number) =>
  new Date(demoNow - minutes * 60_000).toISOString();

export const sampleChatMessages: CommunityChatMessage[] = [
  {
    id: "demo-chat-1",
    author: { id: "demo-1", nickname: "小火慢炖", avatarColor: "#39724b" },
    body: "土豆切丝后冲掉表面淀粉，炒出来确实更清爽。",
    createdAt: ago(8),
  },
  {
    id: "demo-chat-2",
    author: { id: "demo-2", nickname: "醋溜研究员", avatarColor: "#c84b35" },
    body: "我今天试了醋后放，酸香比一开始就加明显。",
    createdAt: ago(5),
  },
  {
    id: "demo-chat-3",
    author: { id: "demo-3", nickname: "锅边观察员", avatarColor: "#477d8e" },
    body: "有人比较过牛肉擦干和湿表面下锅吗？想看两组结果。",
    createdAt: ago(2),
  },
];

export const samplePosts: CommunityPost[] = [
  {
    id: "demo-post-1",
    author: { id: "demo-1", nickname: "小火慢炖", avatarColor: "#39724b" },
    category: "experiment",
    title: "土豆丝先冲洗还是保留淀粉？",
    body: "我用同一个土豆做了两组：A 组冲洗表面淀粉，B 组直接炒。A 更清爽，B 更容易粘连和挂汁。下次想比较擦干后高温快炒的差异。",
    tags: ["土豆", "淀粉", "单变量对照"],
    imageUrls: [],
    likeCount: 18,
    replyCount: 3,
    likedByMe: false,
    isPinned: true,
    createdAt: ago(45),
    experimentSummary: {
      experimentId: "demo-exp-1",
      name: "冲洗淀粉快炒",
      ingredientId: "potato",
      actionCount: 4,
      appearance: "细丝清爽、边缘浅金",
      flavorSummary: "咸味适中",
      textureSummary: "嫩度 42，脆度 71",
    },
  },
  {
    id: "demo-post-2",
    author: { id: "demo-2", nickname: "醋溜研究员", avatarColor: "#c84b35" },
    category: "question",
    title: "青菜焯水后为什么颜色会变暗？",
    body: "同样焯水，加醋的那一组颜色更偏橄榄。是不是酸和高温同时改变了叶绿素？",
    tags: ["上海青", "pH", "叶绿素"],
    imageUrls: [],
    likeCount: 11,
    replyCount: 5,
    likedByMe: false,
    isPinned: false,
    createdAt: ago(95),
  },
  {
    id: "demo-post-3",
    author: { id: "demo-3", nickname: "锅边观察员", avatarColor: "#477d8e" },
    category: "experience",
    title: "牛肉煎香前，表面擦干比腌料更重要",
    body: "以前一直加很多腌料，结果表面总是出水。这次只做干腌和擦干，锅温稳定后褐变更明显，肉也没有被蒸熟。",
    tags: ["牛里脊", "表面水分", "褐变"],
    imageUrls: [],
    likeCount: 27,
    replyCount: 2,
    likedByMe: false,
    isPinned: false,
    createdAt: ago(140),
  },
];

export const sampleReplies: CommunityReply[] = [
  {
    id: "demo-reply-1",
    postId: "demo-post-1",
    author: { id: "demo-3", nickname: "锅边观察员", avatarColor: "#477d8e" },
    body: "B 组如果先煎到定型，再补一点水，可能也能保持挂汁。",
    createdAt: ago(30),
    isHidden: false,
  },
  {
    id: "demo-reply-2",
    postId: "demo-post-1",
    author: { id: "demo-2", nickname: "醋溜研究员", avatarColor: "#c84b35" },
    body: "建议把切丝粗细也保持一致，不然很难只归因于淀粉。",
    createdAt: ago(18),
    isHidden: false,
  },
];
