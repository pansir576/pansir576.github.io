"use client";

import { Check, Circle, MoveRight, Sparkles } from "lucide-react";
import type { KitchenTask } from "@/lib/types";

export function DynamicTaskList({
  tasks,
  onTaskClick,
}: {
  tasks: KitchenTask[];
  onTaskClick: (task: KitchenTask) => void;
}) {
  return (
    <section className="dynamic-task-panel" aria-label="推荐操作任务">
      <div className="dynamic-task-heading">
        <div>
          <span className="mini-label">GUIDED FLOW</span>
          <h2>建议下一步</h2>
        </div>
        <Sparkles size={18} />
      </div>
      <div className="dynamic-task-list">
        {tasks.map((task, index) => (
          <button
            type="button"
            key={task.id}
            className={[
              "dynamic-task",
              task.completed ? "is-complete" : "",
              task.active ? "is-active" : "",
            ].join(" ")}
            onClick={() => onTaskClick(task)}
            aria-current={task.active ? "step" : undefined}
          >
            <span className="task-check">
              {task.completed ? <Check size={14} /> : <Circle size={12} />}
            </span>
            <span className="task-number">{String(index + 1).padStart(2, "0")}</span>
            <span className="task-copy">
              <strong>{task.title}</strong>
              <small>{task.description}</small>
            </span>
            {task.optional && <i>可选</i>}
            {task.active && <MoveRight size={15} />}
          </button>
        ))}
      </div>
      <p>任务只提供建议。你可以跳过或改用其他处理；锅为空时仍不能点火。</p>
    </section>
  );
}
