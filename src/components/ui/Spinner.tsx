"use client";

type Props = { label?: string };

export default function Spinner({ label = "Loading…" }: Props) {
  return (
    <div style={wrapper}>
      <div style={ring} />
      <p style={text}>{label}</p>
    </div>
  );
}

const wrapper: React.CSSProperties = {
  position: "absolute",
  inset: 0,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  flexDirection: "column",
  gap: 10,
  pointerEvents: "none",
};

const ring: React.CSSProperties = {
  width: 48,
  height: 48,
  borderRadius: "50%",
  borderStyle: "solid",
  borderWidth: 3,
  borderColor: "rgba(0,0,0,.15)",
  borderTopColor: "rgba(0,0,0,.65)",
  animation: "spin .9s linear infinite",
};

const text: React.CSSProperties = { fontSize: 12, opacity: 0.8 };