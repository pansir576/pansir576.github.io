"use client";

import { useEffect, useRef, useState } from "react";
import { Flag, Send, Users } from "lucide-react";
import { CommunityAvatar } from "./community-ui";
import { relativeTime } from "@/lib/community/validation";
import type {
  CommunityChatMessage,
  CommunityConnectionState,
  CommunityProfile,
} from "@/lib/community/types";

export function LiveLobby({
  messages,
  profile,
  connection,
  onSend,
  onReport,
}: {
  messages: CommunityChatMessage[];
  profile: CommunityProfile | null;
  connection: CommunityConnectionState;
  onSend: (body: string) => Promise<void>;
  onReport: (message: CommunityChatMessage) => Promise<void>;
}) {
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const element = scrollRef.current;
    if (element) element.scrollTop = element.scrollHeight;
  }, [messages]);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!body.trim() || sending || !connection.configured) return;
    setSending(true);
    try {
      await onSend(body);
      setBody("");
    } finally {
      setSending(false);
    }
  }

  return (
    <section className="live-lobby-panel">
      <div className="lobby-heading">
        <div>
          <span className="mini-label">LIVE KITCHEN LOBBY</span>
          <h2>实时大厅</h2>
          <p>聊食材、火候和刚做完的实验。大厅消息保留最近 24 小时。</p>
        </div>
        <span className="online-pill">
          <Users size={15} />
          {connection.configured ? connection.onlineCount : 3} 人在线
        </span>
      </div>

      <div className="lobby-messages" ref={scrollRef} aria-live="polite">
        {messages.map((message) => (
          <article className="chat-message" key={message.id}>
            <CommunityAvatar author={message.author} size="small" />
            <div>
              <div className="chat-message-heading">
                <strong>{message.author.nickname}</strong>
                <span>{relativeTime(message.createdAt)}</span>
                {connection.configured && (
                  <button
                    type="button"
                    onClick={() => onReport(message)}
                    aria-label={`举报消息：${message.body.slice(0, 12)}`}
                  >
                    <Flag size={12} />
                  </button>
                )}
              </div>
              <p>{message.body}</p>
            </div>
          </article>
        ))}
      </div>

      <form className="chat-composer" onSubmit={submit}>
        <div>
          <span className="community-avatar avatar-small" style={{ backgroundColor: profile?.avatarColor ?? "#738078" }}>
            {profile?.nickname.slice(0, 1) ?? "厨"}
          </span>
          <textarea
            value={body}
            onChange={(event) => setBody(event.target.value)}
            placeholder={connection.configured ? "和厨友说点什么…" : "Supabase 配置后可发送消息"}
            maxLength={300}
            disabled={!connection.configured || !profile}
            aria-label="实时大厅消息"
            rows={2}
          />
          <button
            type="submit"
            className="chat-send-button"
            disabled={!connection.configured || !body.trim() || sending}
            aria-label="发送大厅消息"
          >
            <Send size={17} />
          </button>
        </div>
        <span>{body.length}/300 · 禁止广告、隐私信息和恶意链接</span>
      </form>
    </section>
  );
}
