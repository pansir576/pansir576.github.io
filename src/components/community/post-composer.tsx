/* eslint-disable @next/next/no-img-element */
"use client";

import { useMemo, useState } from "react";
import { ImagePlus, Lock, Send, X } from "lucide-react";
import { getIngredient } from "@/lib/ingredients";
import {
  buildExperimentSummary,
  MAX_IMAGES,
  postCategories,
  validateImage,
  validatePost,
} from "@/lib/community/validation";
import type {
  ExperimentSummary,
  PostCategory,
} from "@/lib/community/types";
import type { ExperimentSnapshot } from "@/lib/types";

export interface NewPostInput {
  category: PostCategory;
  title: string;
  body: string;
  tags: string[];
  images: File[];
  experimentSummary?: ExperimentSummary | null;
}

export interface PostComposerDraft {
  category: PostCategory;
  title: string;
  body: string;
  tags: string[];
  experimentSummary?: ExperimentSummary | null;
}

export function PostComposer({
  experiments,
  initial,
  onClose,
  onSubmit,
}: {
  experiments: ExperimentSnapshot[];
  initial?: PostComposerDraft | null;
  onClose: () => void;
  onSubmit: (input: NewPostInput) => Promise<void>;
}) {
  const [category, setCategory] = useState<PostCategory>(
    initial?.category ?? "question",
  );
  const [title, setTitle] = useState(initial?.title ?? "");
  const [body, setBody] = useState(initial?.body ?? "");
  const [tags, setTags] = useState(initial?.tags.join(", ") ?? "");
  const [images, setImages] = useState<File[]>([]);
  const [experimentId, setExperimentId] = useState("");
  const [attachedSummary, setAttachedSummary] =
    useState<ExperimentSummary | null>(
      initial?.experimentSummary ?? null,
    );
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const imageObjects = useMemo(
    () => images.map((file) => ({ file, url: URL.createObjectURL(file) })),
    [images],
  );
  const tagList = tags
    .split(/[,，\s]+/)
    .map((tag) => tag.trim())
    .filter(Boolean)
    .slice(0, 5);

  function selectImages(files: FileList | null) {
    const next = Array.from(files ?? []).slice(0, MAX_IMAGES);
    for (const file of next) {
      const validation = validateImage(file);
      if (validation) {
        setError(validation);
        return;
      }
    }
    setImages(next);
    setError("");
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const validation = validatePost({
      category,
      title,
      body,
      tags: tagList,
      imageCount: images.length,
    });
    if (validation) {
      setError(validation);
      return;
    }
    const experiment = experiments.find((item) => item.id === experimentId);
    setSaving(true);
    setError("");
    try {
      await onSubmit({
        category,
        title: title.trim(),
        body: body.trim(),
        tags: tagList,
        images,
        experimentSummary: experiment
          ? buildExperimentSummary(experiment)
          : attachedSummary,
      });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "发布失败");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="community-modal-backdrop" role="dialog" aria-modal="true" aria-label="发布实验讨论">
      <form
        className="post-composer"
        onSubmit={submit}
        data-composer-prefilled={initial ? "true" : "false"}
      >
        <div className="post-composer-heading">
          <div>
            <span className="mini-label">NEW DISCUSSION</span>
            <h2>发布实验讨论</h2>
          </div>
          <button type="button" onClick={onClose} aria-label="关闭发帖窗口">
            <X size={18} />
          </button>
        </div>

        <div className="post-category-options" role="radiogroup" aria-label="帖子分类">
          {postCategories.map((item) => (
            <button
              type="button"
              key={item.id}
              className={category === item.id ? "is-selected" : ""}
              onClick={() => setCategory(item.id)}
              role="radio"
              aria-checked={category === item.id}
            >
              <strong>{item.label}</strong>
              <small>{item.description}</small>
            </button>
          ))}
        </div>

        <label className="community-field">
          <span>标题</span>
          <input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            maxLength={80}
            placeholder="例如：青菜焯水后为什么变暗？"
            aria-label="帖子标题"
          />
          <small>{title.length}/80</small>
        </label>

        <label className="community-field">
          <span>正文</span>
          <textarea
            value={body}
            onChange={(event) => setBody(event.target.value)}
            maxLength={2000}
            rows={6}
            placeholder="说明食材、处理方法、观察到的变化，以及你想和大家讨论的问题。"
            aria-label="帖子正文"
          />
          <small>{body.length}/2000</small>
        </label>

        <label className="community-field">
          <span>标签</span>
          <input
            value={tags}
            onChange={(event) => setTags(event.target.value)}
            placeholder="用逗号分隔，例如：青菜, pH, 叶绿素"
            aria-label="帖子标签"
          />
          <small>最多 5 个标签</small>
        </label>
        {tagList.length > 0 && (
          <div className="composer-tag-preview">
            {tagList.map((tag) => <span key={tag}>{tag}</span>)}
          </div>
        )}

        <label className="community-field">
          <span>附加实验摘要</span>
          <select
            value={experimentId}
            onChange={(event) => {
              setExperimentId(event.target.value);
              if (!event.target.value) setAttachedSummary(null);
            }}
          >
            <option value="">不附加</option>
            {experiments.map((experiment) => (
              <option key={experiment.id} value={experiment.id}>
                {getIngredient(experiment.ingredientId).name} · {experiment.name}
              </option>
            ))}
          </select>
          <small>只公开食材、步骤数量和结果摘要，不上传完整本地数据。</small>
          {attachedSummary && !experimentId && (
            <span className="post-composer-attached-summary">
              已附加：{attachedSummary.name} · {attachedSummary.actionCount} 步
            </span>
          )}
        </label>

        <div className="post-image-upload">
          <label>
            <ImagePlus size={18} />
            添加图片
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              multiple
              onChange={(event) => selectImages(event.target.files)}
            />
          </label>
          <span>最多 3 张，每张不超过 5 MB</span>
          {imageObjects.length > 0 && (
            <div className="post-image-preview">
              {imageObjects.map(({ file, url }) => (
                <div key={file.name}>
                  <img src={url} alt={file.name} />
                  <button
                    type="button"
                    onClick={() => setImages((current) => current.filter((item) => item !== file))}
                    aria-label={`移除图片 ${file.name}`}
                  >
                    <X size={13} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {error && <div className="community-form-error">{error}</div>}
        <div className="post-composer-footer">
          <span><Lock size={13} /> 禁止广告、隐私信息、恶意链接和冒充他人</span>
          <button type="submit" className="button button-primary" disabled={saving}>
            {saving ? "发布中…" : "发布帖子"}
            <Send size={16} />
          </button>
        </div>
      </form>
    </div>
  );
}
