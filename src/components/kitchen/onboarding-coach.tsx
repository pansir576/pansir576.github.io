"use client";

import { ArrowRight, Check, MousePointerClick, ScanEye, X } from "lucide-react";

const steps = [
  {
    title: "先看五步流程",
    body: "顶部流程条会标出当前阶段。点击流程步骤可定位到对应操作区。",
    icon: MousePointerClick,
  },
  {
    title: "在正确区域操作",
    body: "查看“现在怎么做”建议，再在水槽、砧板或炒锅完成对应操作。",
    icon: Check,
  },
  {
    title: "观察状态反馈",
    body: "注意水分、温度、形态和气泡提示。任务只是建议，不会限制探索。",
    icon: ScanEye,
  },
];

export function OnboardingCoach({
  step,
  onNext,
  onClose,
}: {
  step: number;
  onNext: () => void;
  onClose: () => void;
}) {
  const current = steps[step] ?? steps[0];
  const Icon = current.icon;
  return (
    <div className="onboarding-backdrop" role="dialog" aria-modal="true" aria-label="厨房新手引导">
      <div className="onboarding-card">
        <button type="button" className="onboarding-close" onClick={onClose} aria-label="关闭引导">
          <X size={17} />
        </button>
        <div className="onboarding-step">
          <span>{String(step + 1).padStart(2, "0")} / 03</span>
          <div className="onboarding-icon"><Icon size={28} /></div>
        </div>
        <h2>{current.title}</h2>
        <p>{current.body}</p>
        <div className="onboarding-progress">
          {steps.map((item, index) => (
            <i key={item.title} className={index <= step ? "is-on" : ""} />
          ))}
        </div>
        <button type="button" className="button button-primary" onClick={step >= 2 ? onClose : onNext}>
          {step >= 2 ? "开始实验" : "下一步"}
          <ArrowRight size={16} />
        </button>
      </div>
    </div>
  );
}
