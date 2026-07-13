"use client";

export default function Footer() {
  return (
    <footer
      id="main-footer"
      style={{
        background: "var(--color-surface)",
        borderTop: "1px solid var(--color-border)",
        padding: "1rem 1.5rem",
        textAlign: "center",
      }}
    >
      <p
        style={{
          fontSize: "0.75rem",
          color: "var(--color-text-subtle)",
          margin: 0,
          lineHeight: 1.5,
        }}
      >
        Developed by{" "}
        <span style={{ color: "var(--color-text-muted)" }}>
          Department of Industrial Management, Faculty of Science, University of Kelaniya
        </span>
      </p>
    </footer>
  );
}
