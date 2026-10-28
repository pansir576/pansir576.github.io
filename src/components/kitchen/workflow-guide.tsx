"use client";

import { useEffect, useRef } from "react";
import {
  ArrowRight,
  Check,
  ChevronDown,
  Circle,
  Info,
  MoveRight,
  Sparkles,
} from "lucide-react";
import type {
  ContextRecommendation,
  GuideItem,
  KitchenTask,
  KitchenWorkflow,
  WorkflowStep,
} from "@/lib/types";

const stateGuide = [
  ["水分", "代表食材整体游离水。下降不一定是失败，可能正在收汁或形成脆感。"],
  ["表面水", "最先影响锅温和褐变。表面太湿时，煎炒容易先变成蒸煮。"],
  ["温度", "决定反应是否启动；还要同时看时间、食材厚度和水分。"],
  ["熟度", "蛋白质凝固、淀粉糊化和组织软化的累计结果，不等于唯一安全指标。"],
  ["上色", "通常表示表面越过水分阶段并发生褐变，继续加热可能转焦苦。"],
  ["脆度 / 嫩度", "两者不一定互斥，要结合食材类型和目标判断软、脆、嫩。"],
  ["锅内位置", "水槽、砧板和锅是不同操作空间；锅为空时不能点火。"],
];

function StepButton({
  step,
  index,
  activeRef,
  onClick,
}: {
  step: WorkflowStep;
  index: number;
  activeRef: React.RefObject<HTMLButtonElement | null>;
  onClick: (step: WorkflowStep) => void;
}) {
  return (
    <button
      ref={step.status === "active" ? activeRef : undefined}
      type="button"
      className={`workflow-step is-${step.status}`}
      onClick={() => onClick(step)}
      aria-current={step.status === "active" ? "step" : undefined}
    >
      <span className="workflow-step-index">
        {step.status === "completed" ? <Check size={13} /> : String(index + 1).padStart(2, "0")}
      </span>
      <span className="workflow-step-copy">
        <strong>{step.title}</strong>
        <small>{step.summary}</small>
      </span>
      {step.status === "active" && <MoveRight size={14} />}
    </button>
  );
}

export function WorkflowGuide({
  workflow,
  tasks,
  prepGuide,
  onStepClick,
  onTaskClick,
  onRecommendationClick,
}: {
  workflow: KitchenWorkflow;
  tasks: KitchenTask[];
  prepGuide: GuideItem[];
  onStepClick: (step: WorkflowStep) => void;
  onTaskClick: (task: KitchenTask) => void;
  onRecommendationClick: (recommendation: ContextRecommendation) => void;
}) {
  const activeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    activeRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "nearest",
      inline: "center",
    });
  }, [workflow.currentPhase]);

  return (
    <section className="workflow-guide" aria-label="实验操作流程和情境指导">
      <div className="workflow-heading">
        <div>
          <span className="mini-label">EXPERIMENT FLOW</span>
          <h2>实验操作流程</h2>
        </div>
        <span>点击步骤可定位到对应操作区，不会自动执行</span>
      </div>
      <div className="workflow-step-strip">
        {workflow.steps.map((step, index) => (
          <StepButton
            key={step.id}
            step={step}
            index={index}
            activeRef={activeRef}
            onClick={onStepClick}
          />
        ))}
      </div>

      <div className={`workflow-recommendation is-${workflow.recommendation.tone}`}>
        <span className="recommendation-icon">
          {workflow.recommendation.tone === "good" ? <Check size={19} /> : <Sparkles size={19} />}
        </span>
        <div className="recommendation-main">
          <span className="mini-label">现在怎么做</span>
          <h3>{workflow.recommendation.title}</h3>
          <p>{workflow.recommendation.reason}</p>
          {workflow.recommendation.alternatives.length > 0 && (
            <div className="recommendation-alternatives">
              <strong>也可以：</strong>
              {workflow.recommendation.alternatives.slice(0, 2).map((item) => (
                <span key={item}>{item}</span>
              ))}
            </div>
          )}
          {workflow.recommendation.caution && (
            <div className="recommendation-caution">
              <Info size={13} />
              {workflow.recommendation.caution}
            </div>
          )}
        </div>
        {workflow.recommendation.actionLabel && (
          <button
            type="button"
            className="button recommendation-action"
            onClick={() => onRecommendationClick(workflow.recommendation)}
          >
            {workflow.recommendation.actionLabel}
            <ArrowRight size={15} />
          </button>
        )}
      </div>

      <div className="workflow-task-list">
        {tasks.map((task, index) => (
          <button
            type="button"
            key={task.id}
            className={[
              "workflow-task",
              task.completed ? "is-complete" : "",
              task.active ? "is-active" : "",
            ].join(" ")}
            onClick={() => onTaskClick(task)}
          >
            <span>{task.completed ? <Check size={13} /> : <Circle size={11} />}</span>
            <i>{String(index + 1).padStart(2, "0")}</i>
            <div>
              <strong>{task.title}</strong>
              <small>{task.description}</small>
            </div>
            {task.optional && <b>可选</b>}
          </button>
        ))}
      </div>

      <details className="workflow-help-details">
        <summary>
          <span><Info size={15} /> 怎么看当前状态</span>
          <ChevronDown size={16} />
        </summary>
        <div className="state-guide-grid">
          {stateGuide.map(([title, detail]) => (
            <div key={title}>
              <strong>{title}</strong>
              <p>{detail}</p>
            </div>
          ))}
        </div>
      </details>

      <details className="workflow-help-details">
        <summary>
          <span><ChevronDown size={15} /> 查看食材处理说明</span>
          <ChevronDown size={16} />
        </summary>
        <div className="workflow-prep-guide">
          {prepGuide.map((item, index) => (
            <div key={item.title}>
              <span>{String(index + 1).padStart(2, "0")}</span>
              <strong>{item.title}</strong>
              <p>{item.detail}</p>
            </div>
          ))}
        </div>
      </details>
    </section>
  );
}
