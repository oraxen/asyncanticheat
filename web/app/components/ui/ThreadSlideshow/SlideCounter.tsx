interface SlideCounterProps {
  current: number;
  total: number;
  visible: boolean;
}

export default function SlideCounter({ current, total, visible }: SlideCounterProps) {
  return (
    <div
      className="absolute left-1/2 top-6 z-[100] flex -translate-x-1/2 items-center gap-2 rounded border px-5 py-2 backdrop-blur-[10px] transition-opacity duration-300"
      style={{
        background: "rgba(20, 18, 44, 0.92)",
        borderColor: "rgba(99, 102, 241, 0.5)",
        opacity: visible ? 1 : 0,
      }}
    >
      <span
        className="font-[family-name:var(--font-cinzel)] text-[0.75rem] tracking-[2px]"
        style={{
          color: "#818cf8",
          textShadow: "0 0 10px rgba(99, 102, 241, 0.6)",
        }}
      >
        {current}
      </span>
      <span
        className="font-[family-name:var(--font-cinzel)] text-[0.75rem] tracking-[2px]"
        style={{ color: "rgba(99, 102, 241, 0.5)" }}
      >
        /
      </span>
      <span
        className="font-[family-name:var(--font-cinzel)] text-[0.75rem] font-bold tracking-[3px]"
        style={{
          color: "#ffd700",
          textShadow: "0 0 10px rgba(99, 102, 241, 0.6), 0 0 12px rgba(255, 215, 0, 0.35)",
        }}
      >
        {total}
      </span>
    </div>
  );
}
