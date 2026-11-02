"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X } from "lucide-react";
import { useState } from "react";

const navigation = [
  { href: "/", label: "首页" },
  { href: "/cook/", label: "菜谱实训" },
  { href: "/principles/", label: "原理库" },
  { href: "/ingredients/", label: "食材图鉴" },
  { href: "/kitchen/", label: "自由实验" },
  { href: "/cook/story/", label: "烹语剧场" },
];

export function SiteHeader() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  const isActive = (href: string) => {
    const normalized = href.replace(/\/$/, "") || "/";
    if (normalized === "/") return pathname === "/";
    if (normalized === "/cook") return pathname.replace(/\/$/, "") === "/cook";
    return pathname.startsWith(normalized);
  };

  return (
    <header className="site-header">
      <div className="site-shell header-inner">
        <Link className="brand" href="/" aria-label="SIMULATING-COOK 首页">
          <span className="brand-mark" aria-hidden="true">
            <span className="brand-dot" />
            <span className="brand-wave" />
          </span>
          <span className="brand-copy">
            <span className="brand-name">SIMULATING-COOK</span>
            <span className="brand-tagline">烹饪原理实验室</span>
          </span>
        </Link>

        <nav className="desktop-nav" aria-label="主要导航">
          {navigation.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={isActive(item.href) ? "nav-link is-active" : "nav-link"}
              aria-current={isActive(item.href) ? "page" : undefined}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <Link className="header-cta" href="/cook/story/">
          进入剧场
        </Link>

        <button
          type="button"
          className="mobile-menu-trigger"
          onClick={() => setOpen((value) => !value)}
          aria-expanded={open}
          aria-controls="mobile-navigation"
          aria-label={open ? "关闭导航" : "打开导航"}
        >
          {open ? <X size={21} /> : <Menu size={21} />}
        </button>
      </div>

      {open && (
        <nav id="mobile-navigation" className="mobile-nav" aria-label="移动端导航">
          {navigation.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={isActive(item.href) ? "nav-link is-active" : "nav-link"}
              onClick={() => setOpen(false)}
            >
              {item.label}
            </Link>
          ))}
        </nav>
      )}
    </header>
  );
}
