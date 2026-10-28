"use client";

import { useEffect, useState } from "react";
import {
  Ban,
  Check,
  Eye,
  EyeOff,
  RefreshCw,
  ShieldCheck,
  X,
} from "lucide-react";
import {
  adminBanContentAuthor,
  adminModerateContent,
  adminResolveReport,
  loadAdminReports,
  loadProfile,
} from "@/lib/community/data";
import { getCommunityClient, isCommunityConfigured } from "@/lib/community/supabase";
import { relativeTime } from "@/lib/community/validation";
import type { ModerationReport, CommunityProfile } from "@/lib/community/types";
import { CommunityAvatar } from "./community-ui";

export function AdminDashboard() {
  const configured = isCommunityConfigured();
  const client = getCommunityClient();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [profile, setProfile] = useState<CommunityProfile | null>(null);
  const [reports, setReports] = useState<ModerationReport[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(configured);
  const [notice, setNotice] = useState("");

  useEffect(() => {
    if (!configured || !client) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setLoading(false);
      return;
    }
    const supabase = client;
    async function restore() {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (session?.user) {
        const admin = await loadProfile(supabase, session.user.id);
        if (admin?.isAdmin) {
          setProfile(admin);
          setReports(await loadAdminReports(supabase));
        }
      }
      setLoading(false);
    }
    void restore();
  }, [client, configured]);

  async function signIn(event: React.FormEvent) {
    event.preventDefault();
    if (!client) return;
    setError("");
    setLoading(true);
    try {
      const { data, error: signInError } = await client.auth.signInWithPassword({
        email,
        password,
      });
      if (signInError) throw signInError;
      if (!data.user) throw new Error("登录失败");
      const admin = await loadProfile(client, data.user.id);
      if (!admin?.isAdmin) {
        await client.auth.signOut();
        throw new Error("该账号没有管理员权限");
      }
      setProfile(admin);
      setReports(await loadAdminReports(client));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "登录失败");
    } finally {
      setLoading(false);
    }
  }

  async function refresh() {
    if (!client) return;
    setReports(await loadAdminReports(client));
    setNotice("举报列表已刷新");
  }

  async function resolve(report: ModerationReport, status: "resolved" | "dismissed") {
    if (!client) return;
    await adminResolveReport(client, report.id, status);
    setReports(await loadAdminReports(client));
    setNotice(status === "resolved" ? "举报已处理" : "举报已忽略");
  }

  async function moderate(
    report: ModerationReport,
    action: "hide" | "restore" | "delete",
  ) {
    if (!client) return;
    await adminModerateContent(client, report.targetType, report.targetId, action);
    setNotice(
      action === "hide" ? "内容已隐藏" : action === "restore" ? "内容已恢复" : "内容已删除",
    );
  }

  async function ban(report: ModerationReport) {
    if (!client) return;
    await adminBanContentAuthor(client, report.targetType, report.targetId, 24);
    setNotice("该匿名身份已禁言 24 小时");
  }

  if (!configured) {
    return (
      <div className="site-shell community-admin-shell">
        <div className="admin-unconfigured">
          <ShieldCheck size={35} />
          <h1>社区管理后台</h1>
          <p>Supabase 环境变量尚未配置。完成 migration 并设置管理员后，这里会显示举报和内容审核工具。</p>
          <a href="/community/">返回厨友交流</a>
        </div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="site-shell community-admin-shell">
        <form className="admin-login-card" onSubmit={signIn}>
          <ShieldCheck size={29} />
          <span className="mini-label">ADMIN ONLY</span>
          <h1>管理员登录</h1>
          <p>使用管理员邮箱和密码登录。匿名厨友身份不能进入此页面。</p>
          <label>
            <span>管理员邮箱</span>
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
              autoComplete="email"
            />
          </label>
          <label>
            <span>密码</span>
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
              autoComplete="current-password"
            />
          </label>
          {error && <div className="community-form-error">{error}</div>}
          <button className="button button-primary" type="submit" disabled={loading}>
            {loading ? "登录中…" : "登录管理后台"}
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="site-shell community-admin-shell">
      <header className="admin-heading">
        <div>
          <span className="mini-label">COMMUNITY MODERATION</span>
          <h1>社区审核后台</h1>
          <p>当前管理员：{profile.nickname} · {profile.id.slice(0, 8)}</p>
        </div>
        <div>
          <button type="button" className="button button-ghost" onClick={refresh}>
            <RefreshCw size={16} /> 刷新
          </button>
          <button type="button" className="button button-ghost" onClick={() => client?.auth.signOut().then(() => setProfile(null))}>
            退出
          </button>
        </div>
      </header>
      {notice && <div className="community-inline-notice is-success">{notice}</div>}
      <div className="admin-stats">
        <div><span>待处理</span><strong>{reports.filter((item) => item.status === "pending").length}</strong></div>
        <div><span>已处理</span><strong>{reports.filter((item) => item.status === "resolved").length}</strong></div>
        <div><span>已忽略</span><strong>{reports.filter((item) => item.status === "dismissed").length}</strong></div>
      </div>
      <div className="admin-report-list">
        {reports.length === 0 ? (
          <div className="admin-empty">目前没有举报</div>
        ) : (
          reports.map((report) => (
            <article className="admin-report-card" key={report.id}>
              <div className="admin-report-top">
                <span>{report.targetType.toUpperCase()}</span>
                <strong>{report.reason}</strong>
                <small>{relativeTime(report.createdAt)}</small>
              </div>
              <p>{report.targetPreview}</p>
              <div className="admin-report-meta">
                <CommunityAvatar author={report.reporter} size="small" />
                举报人：{report.reporter.nickname || "匿名厨友"}
                <span className={`report-status status-${report.status}`}>{report.status}</span>
              </div>
              <div className="admin-report-actions">
                <button type="button" onClick={() => moderate(report, "hide")}><EyeOff size={14} /> 隐藏</button>
                <button type="button" onClick={() => moderate(report, "restore")}><Eye size={14} /> 恢复</button>
                <button type="button" onClick={() => ban(report)}><Ban size={14} /> 禁言 24h</button>
                <button type="button" onClick={() => resolve(report, "resolved")}><Check size={14} /> 已处理</button>
                <button type="button" onClick={() => resolve(report, "dismissed")}><X size={14} /> 忽略</button>
              </div>
            </article>
          ))
        )}
      </div>
    </div>
  );
}
