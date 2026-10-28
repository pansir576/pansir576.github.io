"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  MessageCircle,
  MessagesSquare,
  Pencil,
  Radio,
  ShieldCheck,
} from "lucide-react";
import {
  createPost,
  createReply,
  deleteOwnPost,
  deleteOwnReply,
  loadChatMessages,
  loadPosts,
  loadProfile,
  loadReplies,
  reportContent,
  saveProfile,
  sendChat,
  togglePostLike,
  uploadPostImages,
} from "@/lib/community/data";
import {
  ensureAnonymousUser,
  getCommunityClient,
  isCommunityConfigured,
} from "@/lib/community/supabase";
import {
  sampleChatMessages,
  samplePosts,
  sampleReplies,
} from "@/lib/community/sample-data";
import type {
  CommunityChatMessage,
  CommunityConnectionState,
  CommunityPost,
  CommunityProfile,
  CommunityReply,
} from "@/lib/community/types";
import { validateChat } from "@/lib/community/validation";
import { loadExperiments } from "@/lib/storage";
import type { ExperimentSnapshot } from "@/lib/types";
import {
  takeGuidedShareDraft,
  type GuidedShareDraft,
} from "@/lib/guided-storage";
import {
  CommunityStatusBanner,
  CommunityNotice,
} from "./community-ui";
import { DiscussionBoard } from "./discussion-board";
import { LiveLobby } from "./live-lobby";
import {
  PostComposer,
  type NewPostInput,
  type PostComposerDraft,
} from "./post-composer";
import { ProfileSetupDialog } from "./profile-setup-dialog";

const DEMO_PROFILE_KEY = "cooking-lab:community-profile:v1";

export function CommunityCenter() {
  const configured = isCommunityConfigured();
  const [tab, setTab] = useState<"lobby" | "discussion">("lobby");
  const [profile, setProfile] = useState<CommunityProfile | null>(null);
  const [posts, setPosts] = useState<CommunityPost[]>(
    configured ? [] : samplePosts,
  );
  const [messages, setMessages] = useState<CommunityChatMessage[]>(
    configured ? [] : sampleChatMessages,
  );
  const [replies, setReplies] = useState<CommunityReply[]>([]);
  const [selectedPost, setSelectedPost] = useState<CommunityPost | null>(null);
  const [composerOpen, setComposerOpen] = useState(false);
  const [composerDraft, setComposerDraft] =
    useState<PostComposerDraft | null>(null);
  const composerRouteHandled = useRef(false);
  const [editingProfile, setEditingProfile] = useState(false);
  const [experiments, setExperiments] = useState<ExperimentSnapshot[]>([]);
  const [notice, setNotice] = useState<{
    tone: "success" | "warning";
    text: string;
  } | null>(null);
  const [loading, setLoading] = useState(configured);
  const [connection, setConnection] = useState<CommunityConnectionState>({
    configured,
    connected: false,
    onlineCount: configured ? 0 : 3,
    status: configured ? "connecting" : "demo",
  });

  const client = getCommunityClient();

  useEffect(() => {
    if (composerRouteHandled.current) return;
    composerRouteHandled.current = true;
    const params = new URLSearchParams(window.location.search);
    if (params.get("tab") === "discussion") {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setTab("discussion");
    }
    if (params.get("compose") === "1") {
      const draft: GuidedShareDraft | null = takeGuidedShareDraft();
      setExperiments(loadExperiments());
      setComposerDraft(draft);
      setComposerOpen(true);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function initialize() {
      if (!configured || !client) {
        try {
          const saved = window.localStorage.getItem(DEMO_PROFILE_KEY);
          if (saved) setProfile(JSON.parse(saved) as CommunityProfile);
        } catch {
          // Demo profile remains optional.
        }
        setConnection({
          configured: false,
          connected: false,
          onlineCount: 3,
          status: "demo",
        });
        setLoading(false);
        return;
      }
      try {
        const user = await ensureAnonymousUser();
        if (!user) throw new Error("无法创建匿名身份");
        const existing = await loadProfile(client, user.id);
        if (cancelled) return;
        setProfile(existing);
        if (existing) {
          const [nextPosts, nextMessages] = await Promise.all([
            loadPosts(client, user.id),
            loadChatMessages(client),
          ]);
          if (!cancelled) {
            setPosts(nextPosts);
            setMessages(nextMessages);
          }
        }
      } catch (caught) {
        if (!cancelled) {
          setConnection({
            configured: true,
            connected: false,
            onlineCount: 0,
            status: "error",
            error: caught instanceof Error ? caught.message : "社区连接失败",
          });
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void initialize();
    return () => {
      cancelled = true;
    };
  }, [client, configured]);

  useEffect(() => {
    if (!configured || !client || !profile || tab !== "lobby") {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setConnection((current) => ({
        ...current,
        connected: configured ? false : current.connected,
        status: configured ? "connecting" : "demo",
      }));
      return;
    }
    const user = profile;
    const channel = client.channel("community-lobby", {
      config: { presence: { key: user.id } },
    });
    channel
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "community_chat_messages" },
        async () => {
          const next = await loadChatMessages(client);
          setMessages(next);
        },
      )
      .on("presence", { event: "sync" }, () => {
        const state = channel.presenceState();
        setConnection((current) => ({
          ...current,
          connected: true,
          status: "connected",
          onlineCount: Object.keys(state).length,
        }));
      })
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          void channel.track({ nickname: user.nickname, online_at: new Date().toISOString() });
          setConnection((current) => ({
            ...current,
            connected: true,
            status: "connected",
          }));
        } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          setConnection((current) => ({
            ...current,
            connected: false,
            status: "error",
            error: "实时大厅连接中断",
          }));
        }
      });
    return () => {
      void client.removeChannel(channel);
    };
  }, [client, configured, profile, tab]);

  useEffect(() => {
    if (!configured || !client || !profile) return;
    const channel = client
      .channel("community-posts")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "community_posts" },
        async () => {
          const next = await loadPosts(client, profile.id);
          setPosts(next);
        },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "community_replies" },
        async () => {
          const next = await loadPosts(client, profile.id);
          setPosts(next);
        },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "community_post_likes" },
        async () => {
          const next = await loadPosts(client, profile.id);
          setPosts(next);
        },
      )
      .subscribe();
    return () => {
      void client.removeChannel(channel);
    };
  }, [client, configured, profile]);

  const connectionWithDemo = useMemo(
    () =>
      configured
        ? connection
        : {
            ...connection,
            configured: false,
            connected: false,
            status: "demo" as const,
          },
    [configured, connection],
  );

  async function saveCommunityProfile(nickname: string, avatarColor: string) {
    if (!configured || !client) {
      const demo: CommunityProfile = {
        id: "demo-local-user",
        nickname,
        avatarColor,
        isAdmin: false,
        createdAt: new Date().toISOString(),
      };
      window.localStorage.setItem(DEMO_PROFILE_KEY, JSON.stringify(demo));
      setProfile(demo);
      setEditingProfile(false);
      return;
    }
    const user = await ensureAnonymousUser();
    if (!user) throw new Error("匿名身份不可用");
    const saved = await saveProfile(client, nickname, avatarColor);
    setProfile(saved);
    setEditingProfile(false);
    void Promise.all([
      loadPosts(client, user.id),
      loadChatMessages(client),
    ])
      .then(([nextPosts, nextMessages]) => {
        setPosts(nextPosts);
        setMessages(nextMessages);
      })
      .catch(() => {
        setNotice({ tone: "warning", text: "资料已保存，社区内容暂时未加载" });
      });
  }

  async function handleSendMessage(body: string) {
    const validation = validateChat(body);
    if (validation) {
      setNotice({ tone: "warning", text: validation });
      throw new Error(validation);
    }
    if (!configured || !client) return;
    try {
      await sendChat(client, body);
      setNotice({ tone: "success", text: "消息已发送" });
    } catch (caught) {
      const text = caught instanceof Error ? caught.message : "发送失败";
      setNotice({ tone: "warning", text });
      throw caught;
    }
  }

  async function handleCreatePost(input: NewPostInput) {
    if (!configured || !client || !profile) return;
    const user = await ensureAnonymousUser();
    if (!user) throw new Error("匿名身份不可用");
    const paths = await uploadPostImages(client, user.id, input.images);
    await createPost(client, {
      category: input.category,
      title: input.title,
      body: input.body,
      tags: input.tags,
      imagePaths: paths,
      experimentSummary: input.experimentSummary,
    });
    setPosts(await loadPosts(client, user.id));
    setComposerOpen(false);
    setNotice({ tone: "success", text: "帖子已发布" });
  }

  async function handleLike(post: CommunityPost) {
    if (!configured || !client || !profile) return;
    await togglePostLike(client, post.id, profile.id, post.likedByMe);
    setPosts(await loadPosts(client, profile.id));
  }

  async function handleReport(post: CommunityPost) {
    if (!configured || !client) return;
    await reportContent(client, "post", post.id, `${post.title} ${post.body}`);
    setNotice({ tone: "success", text: "举报已提交，管理员会处理" });
  }

  async function handleDeletePost(post: CommunityPost) {
    if (!configured || !client || !profile) return;
    if (!window.confirm("确定删除这条帖子吗？删除后无法恢复。")) return;
    await deleteOwnPost(client, post.id);
    setPosts(await loadPosts(client, profile.id));
    if (selectedPost?.id === post.id) {
      setSelectedPost(null);
      setReplies([]);
    }
    setNotice({ tone: "success", text: "帖子已删除" });
  }

  async function handleReportMessage(message: CommunityChatMessage) {
    if (!configured || !client) return;
    await reportContent(client, "chat", message.id, message.body);
    setNotice({ tone: "success", text: "消息举报已提交" });
  }

  async function openPost(post: CommunityPost) {
    setSelectedPost(post);
    if (configured && client) {
      setReplies(await loadReplies(client, post.id));
    } else {
      setReplies(sampleReplies.filter((reply) => reply.postId === post.id));
    }
  }

  async function handleReply(post: CommunityPost, body: string) {
    if (!configured || !client) return;
    await createReply(client, post.id, body);
    setReplies(await loadReplies(client, post.id));
    if (profile) setPosts(await loadPosts(client, profile.id));
    setNotice({ tone: "success", text: "回复已发布" });
  }

  async function handleReportReply(reply: CommunityReply) {
    if (!configured || !client) return;
    await reportContent(client, "reply", reply.id, reply.body);
    setNotice({ tone: "success", text: "回复举报已提交" });
  }

  async function handleDeleteReply(reply: CommunityReply) {
    if (!configured || !client || !profile) return;
    await deleteOwnReply(client, reply.id);
    if (selectedPost) {
      setReplies(await loadReplies(client, selectedPost.id));
      setPosts(await loadPosts(client, profile.id));
    }
    setNotice({ tone: "success", text: "回复已删除" });
  }

  function openComposer() {
    setExperiments(loadExperiments());
    setComposerDraft(null);
    setComposerOpen(true);
  }

  return (
    <div className="community-page">
      <div className="site-shell community-shell">
        <header className="community-hero">
          <div>
            <div className="eyebrow">
              <MessagesSquare size={15} />
              厨友交流 / COOKING COMMUNITY
            </div>
            <h1>把一个人的实验结果，变成大家的经验。</h1>
            <p>实时聊一聊，或者发帖记录处理方式、调味组合和 A/B 对照结果。</p>
          </div>
          {profile && (
            <div className="community-profile-chip">
              <span
                className="community-avatar avatar-medium"
                style={{ backgroundColor: profile.avatarColor }}
              >
                {profile.nickname.slice(0, 1)}
              </span>
              <div>
                <strong>{profile.nickname}</strong>
                <small>{configured ? "匿名厨友身份" : "演示昵称"}</small>
              </div>
              <button type="button" onClick={() => setEditingProfile(true)} aria-label="修改昵称">
                <Pencil size={14} />
              </button>
              {profile.isAdmin && (
                <a href="/community/admin/">
                  <ShieldCheck size={14} /> 管理
                </a>
              )}
            </div>
          )}
        </header>

        <CommunityStatusBanner connection={connectionWithDemo} />
        {notice && (
          <CommunityNotice tone={notice.tone}>{notice.text}</CommunityNotice>
        )}

        <div className="community-tabs" role="tablist" aria-label="厨友交流分区">
          <button
            type="button"
            role="tab"
            aria-selected={tab === "lobby"}
            className={tab === "lobby" ? "is-active" : ""}
            onClick={() => setTab("lobby")}
          >
            <Radio size={17} />
            实时大厅
            <small>即时聊天</small>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === "discussion"}
            className={tab === "discussion" ? "is-active" : ""}
            onClick={() => setTab("discussion")}
          >
            <MessageCircle size={17} />
            实验讨论
            <small>发帖与回复</small>
          </button>
        </div>

        {loading ? (
          <div className="community-loading">正在连接厨友交流中心…</div>
        ) : tab === "lobby" ? (
          <LiveLobby
            messages={messages}
            profile={profile}
            connection={connectionWithDemo}
            onSend={handleSendMessage}
            onReport={handleReportMessage}
          />
        ) : (
          <DiscussionBoard
            posts={posts}
            profile={profile}
            configured={configured}
            selectedPost={selectedPost}
            replies={replies}
            onOpenComposer={openComposer}
            onLike={handleLike}
            onReport={handleReport}
            onReportReply={handleReportReply}
            onOpenPost={openPost}
            onReply={handleReply}
            onDeletePost={handleDeletePost}
            onDeleteReply={handleDeleteReply}
          />
        )}
      </div>

      {!loading && !profile && (
        <ProfileSetupDialog onSave={saveCommunityProfile} />
      )}
      {editingProfile && profile && (
        <ProfileSetupDialog initial={profile} onSave={saveCommunityProfile} />
      )}
      {composerOpen && (
        <PostComposer
          experiments={experiments}
          onClose={() => {
            setComposerOpen(false);
            setComposerDraft(null);
          }}
          initial={composerDraft}
          onSubmit={handleCreatePost}
        />
      )}
    </div>
  );
}
