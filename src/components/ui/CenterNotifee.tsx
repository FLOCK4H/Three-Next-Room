"use client";
import { useState } from "react";

type NotifyType = "info" | "success" | "warning" | "error";
type Props = {
  hidden?: boolean;
  onAccept: () => void;
  notifyType?: NotifyType;
  shown?: boolean;
};

export default function CenterNotifee({
  hidden,
  onAccept,
  notifyType = "info",
  shown = true,
}: Props) {
  const [hover, setHover] = useState(false);
  if (hidden || !shown) return null;

  const getTitle = () => {
    switch (notifyType) {
      case "success":
        return "Success";
      case "warning":
        return "Notice";
      case "error":
        return "Error";
      default:
        return "Welcome";
    }
  };

  const getBody = () => {
    switch (notifyType) {
      case "success":
        return (
          <>
            Your action was successful. Click <b>Accept</b> to continue.
          </>
        );
      case "warning":
        return (
          <>
            Please be aware of potential issues. Click <b>Accept</b> to continue.
          </>
        );
      case "error":
        return (
          <>
            There was a problem processing your action. Click <b>Accept</b> to try again.
          </>
        );
      default:
        return (
          <>
            You can interact with both screens. Click <b>Accept</b> to continue.
          </>
        );
    }
  };

  return (
    <div style={overlay}>
      <div style={card} role="dialog" aria-modal="true" aria-label={getTitle()}>
        <div style={title}>{getTitle()}</div>
        <p style={body}>{getBody()}</p>
        <button
          style={{
            ...btn,
            background: hover ? "rgba(255,255,255,0.9)" : "transparent",
            color: hover ? "#000" : "#fff",
            borderColor: hover
              ? "rgba(255,255,255,0.6)"
              : "rgba(255,255,255,0.35)",
          }}
          onMouseEnter={() => setHover(true)}
          onMouseLeave={() => setHover(false)}
          onFocus={() => setHover(true)}
          onBlur={() => setHover(false)}
          onClick={onAccept}
          autoFocus
        >
          Accept
        </button>
      </div>
    </div>
  );
}

const overlay: React.CSSProperties = {
  position: "fixed",
  inset: 0,
  display: "grid",
  placeItems: "center",
  zIndex: 50,
  background: "rgba(0,0,0,0.28)",
  backdropFilter: "blur(4px)",
  WebkitBackdropFilter: "blur(4px)",
  pointerEvents: "auto",
};

const card: React.CSSProperties = {
  width: "min(360px, 88vw)",
  padding: "16px 16px 14px",
  borderRadius: 12,
  background: "rgba(20,20,22,0.92)",
  color: "#fff",
  border: "1px solid rgba(255,255,255,0.16)",
  boxShadow: "0 10px 40px rgba(0,0,0,0.45)",
  display: "grid",
  gap: 10,
};

const title: React.CSSProperties = { fontSize: 18, fontWeight: 700 };
const body: React.CSSProperties = { margin: 0, lineHeight: 1.45, opacity: 0.92 };

const btn: React.CSSProperties = {
  justifySelf: "end",
  padding: "9px 14px",
  borderRadius: 10,
  border: "1px solid rgba(255,255,255,0.35)",
  background: "transparent",
  color: "#fff",
  fontWeight: 600,
  cursor: "pointer",
  transition: "background .2s, color .2s, border-color .2s",
};