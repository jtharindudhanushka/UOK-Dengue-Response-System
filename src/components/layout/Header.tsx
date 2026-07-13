"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Map, Activity } from "lucide-react";

export default function Header() {
  const pathname = usePathname();
  const isDashboard = pathname?.startsWith("/dashboard");

  return (
    <header
      id="main-header"
      style={{
        position: "fixed",
        top: "16px",
        left: "16px",
        zIndex: 900,
        background: "var(--color-surface-card)",
        border: "1px solid var(--color-hairline)",
        borderRadius: "var(--rounded-pill)",
        padding: "0 20px",
        height: "56px",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: "24px",
        boxShadow: "0 4px 24px rgba(0,0,0,0.12)",
      }}
    >
      {/* Brand */}
      <Link
        href="/"
        id="header-brand"
        style={{
          display: "flex",
          alignItems: "center",
          gap: "12px",
          textDecoration: "none",
          flexShrink: 0,
        }}
      >
        <div
          style={{
            width: "36px",
            height: "36px",
            borderRadius: "50%",
            background: "#ffffff",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
            overflow: "hidden",
            boxShadow: "0 2px 8px rgba(0,0,0,0.08)"
          }}
        >
          <Image
            src="/KelaniyaLogo.png"
            alt="University of Kelaniya"
            width={28}
            height={28}
            style={{ objectFit: "contain" }}
            priority
          />
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
          <span
            style={{
              fontWeight: 800,
              fontSize: "15px",
              color: "var(--color-on-dark)",
              letterSpacing: "-0.3px",
              lineHeight: 1,
            }}
          >
            UOK Dengue Response
          </span>
        </div>
      </Link>

      {/* Nav */}
      <nav style={{ display: "flex", alignItems: "center", gap: "16px" }}>
        {isDashboard && (
          <Link href="/" id="header-map-btn" className="btn btn-ghost btn-sm" style={{ fontWeight: 500 }}>
            <Map size={14} />
            <span>Public Map</span>
          </Link>
        )}
      </nav>
    </header>
  );
}
