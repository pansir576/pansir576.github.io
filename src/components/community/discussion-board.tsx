/* eslint-disable @next/next/no-img-element */
"use client";

import { useState } from "react";
import {
  ArrowUp,
  BookOpen,
  Flag,
  ImageIcon,
  MessageCircle,
  Pin,
  Plus,
  Reply,
  SlidersHorizontal,
  Sparkles,
  Trash2,
} from "lucide-react";
import { getIngredient } from "@/lib/ingredients";
import {
  communityRules,
  postCategories,
  relativeTime,
  validateReply,
} from "@/lib/community/validation";
import type {
  CommunityPost,
  CommunityProfile,
  CommunityReply,
  PostCategory,
} from "@/lib/community/types";
import { CategoryBadge, CommunityAvatar } from "./community-ui";

type SortMode = "newest" | "hot";

export function DiscussionBoard({
  posts,
  profile,
  configured,
  selectedPost,
  replies,
  onOpenComposer,
  onLike,
  onReport,
  onReportReply,
  onOpenPost,
  onReply,
  onDeletePost,
  onDeleteReply,
}: {
  posts: CommunityPost[];
  profile: CommunityProfile | null;
  configured: boolean;
  selectedPost: CommunityPost | null;
  replies: CommunityReply[];
  onOpenComposer: () => void;
  onLike: (post: CommunityPost) => Promise<void>;
  onReport: (post: CommunityPost) => Promise<void>;
  onReportReply: (reply: CommunityReply) => Promise<void>;
  onOpenPost: (post: CommunityPost) => Promise<void>;
  onReply: (post: CommunityPost, body: string) => Promise<void>;
  onDeletePost: (post: CommunityPost) => Promise<void>;
  onDeleteReply: (reply: CommunityReply) => Promise<void>;
}) {
  const [category, setCategory] = useState<PostCategory | "all">("all");
  const [sort, setSort] = useState<SortMode>("newest");
  const [replyBody, setReplyBody] = useState("");
  const [replyError, setReplyError] = useState("");
  const [sendingReply, setSendingReply] = useState(false);

  const filtered = posts
    .filter((post) => category === "all" || post.category === category)
    .sort((a, b) => {
      if (a.isPinned !== b.isPinned) return a.isPinned ? -1 : 1;
      if (sort === "hot") {
        return b.likeCount + b.replyCount * 2 - (a.likeCount + a.replyCount * 2);
      }
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });

  async function submitReply(event: React.FormEvent) {
    event.preventDefault();
    if (!selectedPost) return;
    const validation = validateReply(replyBody);
    if (validation) {
      setReplyError(validation);
      return;
    }
    setSendingReply(true);
    setReplyError("");
    try {
      await onReply(selectedPost, replyBody.trim());
      setReplyBody("");
    } catch (caught) {
      setReplyError(caught instanceof Error ? caught.message : "回复失败");
    } finally {
      setSendingReply(false);
    }
  }

  return (
    <section className="discussion-board">
      <div className="discussion-toolbar">
        <div className="discussion-category-filters" role="tablist" aria-label="讨论分类">
          <button
            type="button"
            className={category === "all" ? "is-selected" : ""}
            onClick={() => setCategory("all")}
          >
            全部
          </button>
          {postCategories.map((item) => (
            <button
              type="button"
              key={item.id}
              className={category === item.id ? "is-selected" : ""}
              onClick={() => setCategory(item.id)}
            >
              {item.label}
            </button>
          ))}
        </div>
        <div className="discussion-sort">
          <SlidersHorizontal size={14} />
          <button
            type="button"
            className={sort === "newest" ? "is-selected" : ""}
            onClick={() => setSort("newest")}
          >
            最新
          </button>
          <button
            type="button"
            className={sort === "hot" ? "is-selected" : ""}
            onClick={() => setSort("hot")}
          >
            热门
          </button>
        </div>
      </div>

      <div className="discussion-layout">
        <div className="discussion-feed">
          <div className="discussion-feed-heading">
            <div>
              <span className="mini-label">EXPERIMENT NOTES</span>
              <h2>厨友实验讨论</h2>
            </div>
            <button
              type="button"
              className="button button-primary"
              onClick={onOpenComposer}
              disabled={!configured || !profile}
            >
              <Plus size={16} />
              发帖
            </button>
          </div>

          {filtered.map((post) => (
            <article
              className={selectedPost?.id === post.id ? "post-card is-open" : "post-card"}
              key={post.id}
            >
              <div className="post-card-main">
                <CommunityAvatar author={post.author} />
                <div className="post-card-content">
                  <div className="post-meta">
                    <strong>{post.author.nickname}</strong>
                    <span>{relativeTime(post.createdAt)}</span>
                    {post.isPinned && <Pin size={12} />}
                    <CategoryBadge category={post.category} />
                  </div>
                  <h3>{post.title}</h3>
                  <p>{post.body}</p>
                  <div className="post-tags">
                    {post.tags.map((tag) => <span key={tag}>{tag}</span>)}
                  </div>
                  {post.imageUrls.length > 0 && (
                    <div className={`post-images count-${post.imageUrls.length}`}>
                      {post.imageUrls.map((url, index) => (
                        <img src={url} alt={`帖子图片 ${index + 1}`} key={url} />
                      ))}
                    </div>
                  )}
                  {post.experimentSummary && (
                    <div className="post-experiment-summary">
                      <span className="post-experiment-icon"><Sparkles size={16} /></span>
                      <div>
                        <span className="mini-label">ATTACHED EXPERIMENT</span>
                        <strong>
                          {getIngredient(post.experimentSummary.ingredientId).name} · {post.experimentSummary.name}
                        </strong>
                        <p>
                          {post.experimentSummary.actionCount} 步 · {post.experimentSummary.appearance}
                          {" · "}{post.experimentSummary.flavorSummary}
                        </p>
                      </div>
                    </div>
                  )}
                  <div className="post-actions">
                    <button type="button" onClick={() => onLike(post)} disabled={!configured || !profile}>
                      <ArrowUp size={14} />
                      {post.likeCount}
                    </button>
                    <button type="button" onClick={() => onOpenPost(post)}>
                      <MessageCircle size={14} />
                      {post.replyCount} 条回复
                    </button>
                    {configured && (
                      <button type="button" onClick={() => onReport(post)}>
                        <Flag size={13} /> 举报
                      </button>
                    )}
                    {configured && profile?.id === post.author.id && (
                      <button type="button" onClick={() => onDeletePost(post)}>
                        <Trash2 size={13} /> 删除
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {selectedPost?.id === post.id && (
                <div className="post-replies">
                  <div className="post-replies-heading">
                    <Reply size={15} />
                    <strong>回复</strong>
                  </div>
                  {replies.length === 0 ? (
                    <p className="empty-replies">还没有回复，来补充第一个观察。</p>
                  ) : (
                    replies.map((reply) => (
                      <article key={reply.id}>
                        <CommunityAvatar author={reply.author} size="small" />
                        <div>
                          <div className="reply-meta">
                            <strong>{reply.author.nickname}</strong>
                            <span>{relativeTime(reply.createdAt)}</span>
                            {configured && (
                              <button
                                type="button"
                                onClick={() => onReportReply(reply)}
                                aria-label="举报回复"
                              >
                                <Flag size={11} />
                              </button>
                            )}
                            {configured && profile?.id === reply.author.id && (
                              <button
                                type="button"
                                onClick={() => onDeleteReply(reply)}
                                aria-label="删除自己的回复"
                              >
                                <Trash2 size={11} />
                              </button>
                            )}
                          </div>
                          <p>{reply.body}</p>
                        </div>
                      </article>
                    ))
                  )}
                  <form onSubmit={submitReply}>
                    <textarea
                      value={replyBody}
                      onChange={(event) => setReplyBody(event.target.value)}
                      placeholder={configured ? "写下你的观察或建议…" : "Supabase 配置后可回复"}
                      maxLength={1000}
                      rows={2}
                      disabled={!configured || !profile}
                      aria-label="回复内容"
                    />
                    <button
                      type="submit"
                      className="button button-ghost"
                      disabled={!configured || !profile || !replyBody.trim() || sendingReply}
                    >
                      回复
                    </button>
                  </form>
                  {replyError && <div className="community-form-error">{replyError}</div>}
                </div>
              )}
            </article>
          ))}
        </div>

        <aside className="community-sidebar">
          <div className="community-rule-card">
            <BookOpen size={19} />
            <h3>厨友交流规则</h3>
            {communityRules.map((rule) => <p key={rule}>{rule}</p>)}
          </div>
          <div className="community-side-card">
            <ImageIcon size={18} />
            <strong>怎样发一条有用的问题？</strong>
            <p>写清食材、切法、火候、调料和观察到的现象，比只问“为什么失败”更容易得到准确回答。</p>
          </div>
        </aside>
      </div>
    </section>
  );
}
