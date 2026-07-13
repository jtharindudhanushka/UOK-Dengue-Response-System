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
        top: 0,
        left: 0,
        right: 0,
        zIndex: 900,
        background: "var(--color-canvas)",
        borderBottom: "1px solid var(--color-hairline)",
        padding: "0 24px",
        height: "64px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
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
            width: "32px",
            height: "32px",
            borderRadius: "var(--rounded-md)",
            background: "#ffffff",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
            overflow: "hidden"
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
              fontWeight: 700,
              fontSize: "14px",
              color: "var(--color-on-dark)",
              letterSpacing: "-0.5px",
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
