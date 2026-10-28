"use client";

import { useState } from "react";
import { Check, UserRound } from "lucide-react";
import { avatarColorFor, validateNickname } from "@/lib/community/validation";
import type { CommunityProfile } from "@/lib/community/types";

export function ProfileSetupDialog({
  initial,
  onSave,
}: {
  initial?: CommunityProfile | null;
  onSave: (nickname: string, avatarColor: string) => Promise<void>;
}) {
  const [nickname, setNickname] = useState(initial?.nickname ?? "");
  const [avatarColor, setAvatarColor] = useState(
    initial?.avatarColor ?? avatarColorFor("厨友"),
  );
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const validation = validateNickname(nickname);
    if (validation) {
      setError(validation);
      return;
    }
    setSaving(true);
    setError("");
    try {
      await onSave(nickname.trim(), avatarColor);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "保存昵称失败");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="community-modal-backdrop" role="dialog" aria-modal="true" aria-label="设置厨友昵称">
      <form className="community-profile-dialog" onSubmit={submit}>
        <span className="community-dialog-icon"><UserRound size={24} /></span>
        <span className="mini-label">COMMUNITY PROFILE</span>
        <h2>{initial ? "修改厨友昵称" : "先给自己起个昵称"}</h2>
        <p>昵称会显示在帖子和大厅消息中。昵称可以重复，系统使用匿名身份区分用户。</p>
        <div className="profile-preview">
          <span className="community-avatar avatar-large" style={{ backgroundColor: avatarColor }}>
            {(nickname.trim() || "厨").slice(0, 1)}
          </span>
          <input
            value={nickname}
            onChange={(event) => {
              setNickname(event.target.value);
              setAvatarColor(avatarColorFor(event.target.value || "厨友"));
            }}
            placeholder="例如：锅边观察员"
            maxLength={16}
            autoFocus
            aria-label="厨友昵称"
          />
        </div>
        <div className="avatar-color-options" aria-label="头像颜色">
          {["#39724b", "#c84b35", "#b17828", "#477d8e", "#76528d"].map((color) => (
            <button
              type="button"
              key={color}
              className={avatarColor === color ? "is-selected" : ""}
              style={{ backgroundColor: color }}
              onClick={() => setAvatarColor(color)}
              aria-label={`选择颜色 ${color}`}
            >
              {avatarColor === color && <Check size={13} />}
            </button>
          ))}
        </div>
        {error && <div className="community-form-error">{error}</div>}
        <button className="button button-primary" type="submit" disabled={saving}>
          {saving ? "保存中…" : "进入厨友交流"}
        </button>
      </form>
    </div>
  );
}
