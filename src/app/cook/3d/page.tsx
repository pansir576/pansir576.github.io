"use client";

import Link from "next/link";
import { useEffect } from "react";

export default function LegacyKitchenRedirectPage() {
  useEffect(() => {
    window.location.replace("/cook/story/");
  }, []);

  return (
    <main
      style={{
        display: "grid",
        minHeight: "calc(100svh - 72px)",
        placeItems: "center",
        padding: 24,
        color: "#33463a",
        background: "#efe8db",
        textAlign: "center",
      }}
    >
      <section style={{ maxWidth: 560 }}>
        <span
          style={{
            color: "#a2643d",
            fontSize: 10,
            fontWeight: 800,
            letterSpacing: "0.14em",
          }}
        >
          KITCHEN UPGRADED
        </span>
        <h1 style={{ margin: "10px 0 12px", fontSize: 34 }}>
          3D模拟厨房已升级为【烹语剧场】2D互动版本
        </h1>
        <p style={{ color: "#677269", lineHeight: 1.8 }}>
          正在前往新的夏弥角色互动厨房。如果没有自动跳转，请点击下方入口。
        </p>
        <Link
          href="/cook/story/"
          style={{
            display: "inline-flex",
            marginTop: 10,
            padding: "12px 18px",
            borderRadius: 10,
            color: "#fffdf7",
            background: "#2d5d40",
            textDecoration: "none",
          }}
        >
          进入烹语剧场
        </Link>
      </section>
    </main>
  );
}
