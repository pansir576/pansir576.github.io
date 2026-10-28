"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { Component, useEffect, useState, type ReactNode } from "react";
import { LoaderCircle, MonitorX } from "lucide-react";
import styles from "./three-d-kitchen.module.css";

const ThreeDKitchenExperience = dynamic(
  () =>
    import("./three-d-kitchen-experience").then(
      (module) => module.ThreeDKitchenExperience,
    ),
  {
    ssr: false,
    loading: () => (
      <div className={styles.fullLoading}>
        <LoaderCircle size={24} />
        正在加载 3D 厨房…
      </div>
    ),
  },
);

class WebGLErrorBoundary extends Component<
  { children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  render() {
    if (this.state.failed) {
      return <ThreeDFallback reason="3D 渲染器初始化失败。" />;
    }
    return this.props.children;
  }
}

function ThreeDFallback({ reason }: { reason: string }) {
  return (
    <div className={styles.fallback}>
      <MonitorX size={38} />
      <span>WEBGL FALLBACK</span>
      <h1>这台设备暂时无法运行 3D 厨房</h1>
      <p>
        {reason} 经典一人称厨房包含完整的食材处理、火候、调味和 AI
        指导，可以继续使用。
      </p>
      <Link href="/cook/classic/">进入经典厨房</Link>
    </div>
  );
}

export function ThreeDKitchenEntry() {
  const [support, setSupport] = useState<"checking" | "yes" | "no">(
    "checking",
  );

  useEffect(() => {
    try {
      const canvas = document.createElement("canvas");
      const context =
        canvas.getContext("webgl2") ?? canvas.getContext("webgl");
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSupport(context ? "yes" : "no");
    } catch {
      setSupport("no");
    }
  }, []);

  if (support === "checking") {
    return (
      <div className={styles.fullLoading}>
        <LoaderCircle size={24} />
        正在检查 3D 能力…
      </div>
    );
  }
  if (support === "no") {
    return <ThreeDFallback reason="浏览器没有可用的 WebGL 上下文。" />;
  }
  return (
    <WebGLErrorBoundary>
      <ThreeDKitchenExperience />
    </WebGLErrorBoundary>
  );
}
