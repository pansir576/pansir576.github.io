"use client";

import { useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  BookOpenText,
  LoaderCircle,
  MessageCircle,
  Send,
  Sparkles,
  Volume2,
  VolumeX,
  X,
} from "lucide-react";
import type {
  GuideMessage,
  GuideMode,
  GuidePartnerDefinition,
  GuidedCookSession,
} from "@/lib/types";
import styles from "./guided-kitchen.module.css";
import { guidedPhases } from "@/lib/guided-cook";
import { getIngredient } from "@/lib/ingredients";

export function GuideDrawer({
  open,
  partner,
  session,
  mode,
  messages,
  busy,
  voiceEnabled,
  recommendation,
  onClose,
  onModeChange,
  onToggleVoice,
  onAsk,
}: {
  open: boolean;
  partner: GuidePartnerDefinition;
  session: GuidedCookSession;
  mode: GuideMode;
  messages: GuideMessage[];
  busy: boolean;
  voiceEnabled: boolean;
  recommendation: { title: string; reason: string };
  onClose: () => void;
  onModeChange: (mode: GuideMode) => void;
  onToggleVoice: () => void;
  onAsk: (question: string) => Promise<void>;
}) {
  const [question, setQuestion] = useState("");
  const messageEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messageEndRef.current?.scrollIntoView({ block: "nearest" });
  }, [messages, mode]);

  if (!open) return null;

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const value = question.trim();
    if (!value || busy) return;
    setQuestion("");
    await onAsk(value);
  }

  return (
    <aside
      className={styles.guideDrawer}
      aria-label={`${partner.name}指导面板`}
      data-guide-drawer
    >
      <header className={styles.drawerHeader}>
        <button
          type="button"
          className={styles.drawerBack}
          onClick={onClose}
          aria-label="关闭伙伴面板"
        >
          <ArrowLeft size={17} />
        </button>
        <span
          className={styles.drawerAvatar}
          style={{ background: partner.accent }}
        >
          {partner.name.slice(0, 1)}
        </span>
        <div>
          <strong>{partner.name}</strong>
          <small>{partner.role} · 随时可调用</small>
        </div>
        <button
          type="button"
          className={styles.drawerClose}
          onClick={onClose}
          aria-label="关闭伙伴面板"
        >
          <X size={17} />
        </button>
      </header>

      <div className={styles.guideModes} role="tablist" aria-label="伙伴功能">
        <button
          type="button"
          role="tab"
          data-guide-mode="flow"
          aria-selected={mode === "flow"}
          className={mode === "flow" ? styles.modeActive : ""}
          onClick={() => onModeChange("flow")}
        >
          <Sparkles size={15} />
          流程指导
        </button>
        <button
          type="button"
          role="tab"
          data-guide-mode="chat"
          aria-selected={mode === "chat"}
          className={mode === "chat" ? styles.modeActive : ""}
          onClick={() => onModeChange("chat")}
        >
          <MessageCircle size={15} />
          交流对话
        </button>
      </div>

      {mode === "flow" ? (
        <div className={styles.flowDrawerBody}>
          <div className={styles.partnerSpeech}>
            <span>{partner.name}</span>
            <p>{partner.greeting}</p>
          </div>
          <div className={styles.flowRecommendation}>
            <span className={styles.drawerEyebrow}>现在这样做</span>
            <h3>{recommendation.title}</h3>
            <p>{recommendation.reason}</p>
          </div>
          <div className={styles.currentContext}>
            <div>
              <span>当前阶段</span>
              <strong>
                {guidedPhases.find((phase) => phase.id === session.phase)
                  ?.label ?? session.phase}
              </strong>
            </div>
            <div>
              <span>食材</span>
              <strong>
                {session.ingredientId
                  ? getIngredient(session.ingredientId).name
                  : "未选择"}
              </strong>
            </div>
            <div>
              <span>有效操作</span>
              <strong>{session.actions.length} 步</strong>
            </div>
          </div>
          <button
            type="button"
            className={styles.voiceToggle}
            onClick={onToggleVoice}
            aria-pressed={voiceEnabled}
          >
            {voiceEnabled ? <Volume2 size={17} /> : <VolumeX size={17} />}
            <span>
              语音播报
              <small>{voiceEnabled ? "已开启，只朗读流程提示" : "默认关闭"}</small>
            </span>
          </button>
          <div className={styles.guideBoundary}>
            <BookOpenText size={15} />
            流程指导来自当前模拟状态，不用等待 AI 网络。
          </div>
        </div>
      ) : (
        <div className={styles.chatBody}>
          <div className={styles.chatMessages}>
            {messages.map((message) => (
              <div
                key={message.id}
                data-message-source={
                  message.role === "partner" ? message.source : undefined
                }
                className={
                  message.role === "user"
                    ? styles.userMessage
                    : styles.partnerMessage
                }
              >
                {message.role === "partner" && (
                  <span>{message.source === "llm" ? "AI" : "本地"}</span>
                )}
                <p>{message.text}</p>
              </div>
            ))}
            {busy && (
              <div className={styles.partnerMessage}>
                <span>AI</span>
                <p className={styles.thinking}>
                  <LoaderCircle size={14} /> 正在结合当前食材和锅内状态…
                </p>
              </div>
            )}
            <div ref={messageEndRef} />
          </div>
          <form className={styles.chatComposer} onSubmit={submit}>
            <textarea
              value={question}
              onChange={(event) => setQuestion(event.target.value)}
              rows={3}
              maxLength={300}
              placeholder="问食材、调料、火候或刚才发生的变化…"
              aria-label="向伙伴提问"
            />
            <div>
              <small>{question.length}/300 · 不保存聊天记录</small>
              <button
                type="submit"
                disabled={busy || !question.trim()}
                className="button button-primary"
              >
                <Send size={15} />
                发送
              </button>
            </div>
          </form>
        </div>
      )}
    </aside>
  );
}
