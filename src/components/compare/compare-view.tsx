"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  Check,
  ChefHat,
  GitCompareArrows,
  Trash2,
  X,
} from "lucide-react";
import { FlavorBars } from "@/components/flavor-bars";
import { getIngredient } from "@/lib/ingredients";
import { hasIngredientPhoto, ingredientPhoto } from "@/lib/media";
import { describeAction } from "@/lib/simulator";
import {
  loadComparisonIds,
  loadExperiments,
  MAX_COMPARISON,
  removeExperiment,
  storeComparisonIds,
} from "@/lib/storage";
import type { ExperimentSnapshot } from "@/lib/types";

export function CompareView() {
  const [experiments, setExperiments] = useState<ExperimentSnapshot[]>([]);
  const [comparison, setComparison] = useState<string[]>([]);
  const [ready, setReady] = useState(false);
  const [notice, setNotice] = useState("");

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setExperiments(loadExperiments());
    setComparison(loadComparisonIds());
    setReady(true);
  }, []);

  useEffect(() => {
    if (!notice) return;
    const timeout = window.setTimeout(() => setNotice(""), 2800);
    return () => window.clearTimeout(timeout);
  }, [notice]);

  const comparedExperiments = useMemo(
    () =>
      comparison
        .map((id) => experiments.find((item) => item.id === id))
        .filter((item): item is ExperimentSnapshot => Boolean(item))
        .slice(0, MAX_COMPARISON),
    [comparison, experiments],
  );

  function toggle(id: string) {
    const exists = comparison.includes(id);
    if (!exists && comparison.length >= MAX_COMPARISON) {
      setNotice("最多选择 3 个实验进行对比");
      return;
    }
    setComparison(
      storeComparisonIds(
        exists ? comparison.filter((item) => item !== id) : [...comparison, id],
      ),
    );
  }

  function remove(id: string) {
    const next = removeExperiment(id);
    setExperiments(next);
    setComparison(loadComparisonIds());
    setNotice("实验已删除");
  }

  if (!ready) {
    return (
      <div className="compare-loading">
        <span />
        正在读取本地实验…
      </div>
    );
  }

  return (
    <div className="site-shell compare-shell">
      <div className="compare-heading">
        <div>
          <div className="eyebrow">
            <GitCompareArrows size={15} />
            实验对比 / EARLIER VS LATER
          </div>
          <h1>把“感觉不一样”变成并排可见。</h1>
          <p>
            同一食材只加一种调料，或改变操作顺序后，味觉与质地会怎样分开？选择最多 3 个结果进行比较。
          </p>
        </div>
        <Link className="button button-primary" href="/kitchen/">
          <ChefHat size={18} />
          继续实验
        </Link>
      </div>

      {notice && (
        <div className="toast" role="status">
          <Check size={16} />
          {notice}
        </div>
      )}

      {experiments.length === 0 ? (
        <section className="empty-compare">
          <div className="empty-compare-art">
            <span />
            <ChefHat size={37} />
          </div>
          <span className="mini-label">本地还没有实验</span>
          <h2>先完成并保存一次操作。</h2>
          <p>
            进入自由实验选择食材、执行操作并保存，结果会保存在当前浏览器中，不需要账号。
          </p>
          <Link className="button button-primary" href="/kitchen/">
            打开自由实验 <ArrowRight size={17} />
          </Link>
        </section>
      ) : (
        <>
          <section className="saved-experiments-section">
            <div className="compare-section-heading">
              <div>
                <span className="mini-label">已保存结果</span>
                <h2>选择要比较的实验</h2>
              </div>
              <span>{comparison.length} / {MAX_COMPARISON} 已选择</span>
            </div>
            <div className="saved-experiments-grid">
              {experiments.map((experiment) => {
                const ingredient = getIngredient(experiment.ingredientId);
                const selected = comparison.includes(experiment.id);
                return (
                  <article
                    className={
                      selected
                        ? "saved-experiment-card is-selected"
                        : "saved-experiment-card"
                    }
                    key={experiment.id}
                  >
                    <button
                      type="button"
                      className="saved-experiment-select"
                      onClick={() => toggle(experiment.id)}
                      aria-pressed={selected}
                    >
                      <span className="compare-checkbox">
                        {selected && <Check size={14} />}
                      </span>
                      <span className="saved-art">
                        {hasIngredientPhoto(ingredient.id) ? (
                          <Image
                            src={ingredientPhoto(ingredient.id)}
                            alt={`${ingredient.name}食材摄影`}
                            fill
                            sizes="62px"
                          />
                        ) : (
                          <span className="saved-art-fallback">
                            {ingredient.name.slice(0, 1)}
                          </span>
                        )}
                      </span>
                      <span className="saved-copy">
                        <small>
                          {ingredient.name} · {experiment.branchLabel ?? "旧版单线"} · {experiment.actions.length} 步
                        </small>
                        <strong>{experiment.name}</strong>
                        <span>
                          {new Date(experiment.createdAt).toLocaleString("zh-CN", {
                            month: "short",
                            day: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                      </span>
                    </button>
                    <button
                      type="button"
                      className="icon-button delete-experiment"
                      onClick={() => remove(experiment.id)}
                      aria-label={`删除实验：${experiment.name}`}
                    >
                      <Trash2 size={15} />
                    </button>
                  </article>
                );
              })}
            </div>
          </section>

          {comparedExperiments.length === 0 ? (
            <section className="compare-placeholder">
              <GitCompareArrows size={28} />
              <h2>从上方勾选实验结果</h2>
              <p>选择 2 个或 3 个不同实验，味觉、外观和操作步骤会在这里并排展开。</p>
            </section>
          ) : (
            <section className="comparison-table-section">
              <div className="compare-section-heading">
                <div>
                  <span className="mini-label">并排比较</span>
                  <h2>差异在哪里</h2>
                </div>
                <span>最多 3 列 · 手机端可横向滑动</span>
              </div>
              <div className="comparison-scroll">
                <div
                  className="comparison-grid"
                  style={{
                    gridTemplateColumns: `repeat(${comparedExperiments.length}, minmax(260px, 1fr))`,
                  }}
                >
                  {comparedExperiments.map((experiment) => {
                    const ingredient = getIngredient(experiment.ingredientId);
                    return (
                      <article className="comparison-column" key={experiment.id}>
                        <div className="comparison-column-head">
                          <button
                            type="button"
                            className="remove-column"
                            onClick={() => toggle(experiment.id)}
                            aria-label={`移出对比：${experiment.name}`}
                          >
                            <X size={15} />
                          </button>
                          <span className="mini-label">{ingredient.name}</span>
                          <h3>{experiment.name}</h3>
                          <div className="comparison-appearance">
                            <i
                              style={{
                                backgroundColor: experiment.state.appearance.color,
                              }}
                            />
                            {experiment.state.appearance.label}
                          </div>
                        </div>

                        <div className="comparison-block">
                          <span>味觉图谱</span>
                          <FlavorBars flavor={experiment.state.flavor} compact />
                        </div>

                        <div className="comparison-block">
                          <span>关键状态</span>
                          <div className="comparison-metrics">
                            {[
                              ["熟度", experiment.state.properties.cookedness],
                              ["水分", experiment.state.properties.moisture],
                              ["脆度", experiment.state.properties.crispness],
                              ["褐变", experiment.state.properties.browning],
                              ["挂汁", experiment.state.properties.sauceCoating],
                              ["油腻", experiment.state.properties.oiliness],
                            ].map(([label, value]) => (
                              <div key={label}>
                                <span>{label}</span>
                                <strong>{Math.round(Number(value))}</strong>
                              </div>
                            ))}
                          </div>
                        </div>

                        <div className="comparison-block">
                          <span>操作序列</span>
                          <ol className="action-replay-list">
                            {experiment.actions.map((action, index) => {
                              return (
                                <li key={`${experiment.id}-${index}`}>
                                  <span>{String(index + 1).padStart(2, "0")}</span>
                                  {describeAction(action)}
                                </li>
                              );
                            })}
                          </ol>
                        </div>

                        {experiment.state.warnings.length > 0 && (
                          <div className="comparison-warning">
                            {experiment.state.warnings[0]}
                          </div>
                        )}
                      </article>
                    );
                  })}
                </div>
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}
