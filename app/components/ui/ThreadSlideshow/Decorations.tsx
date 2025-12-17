/** Corner accent decorations */
export function CornerAccents() {
  return (
    <>
      <div className="corner-accent pointer-events-none absolute left-[15px] top-[15px] z-[60] h-20 w-20">
        <div
          className="absolute left-0 top-0 h-[3px] w-[60px]"
          style={{ background: "linear-gradient(90deg, var(--slide-accent), transparent)" }}
        />
        <div
          className="absolute left-0 top-0 h-[60px] w-[3px]"
          style={{ background: "linear-gradient(180deg, var(--slide-accent), transparent)" }}
        />
      </div>
      <div className="corner-accent pointer-events-none absolute right-[15px] top-[15px] z-[60] h-20 w-20">
        <div
          className="absolute right-0 top-0 h-[3px] w-[60px]"
          style={{ background: "linear-gradient(-90deg, var(--slide-accent), transparent)" }}
        />
        <div
          className="absolute right-0 top-0 h-[60px] w-[3px]"
          style={{ background: "linear-gradient(180deg, var(--slide-accent), transparent)" }}
        />
      </div>
      <div className="corner-accent pointer-events-none absolute bottom-[15px] left-[15px] z-[60] h-20 w-20">
        <div
          className="absolute bottom-0 left-0 h-[3px] w-[60px]"
          style={{ background: "linear-gradient(90deg, var(--slide-accent), transparent)" }}
        />
        <div
          className="absolute bottom-0 left-0 h-[60px] w-[3px]"
          style={{ background: "linear-gradient(0deg, var(--slide-accent), transparent)" }}
        />
      </div>
      <div className="corner-accent pointer-events-none absolute bottom-[15px] right-[15px] z-[60] h-20 w-20">
        <div
          className="absolute bottom-0 right-0 h-[3px] w-[60px]"
          style={{ background: "linear-gradient(-90deg, var(--slide-accent), transparent)" }}
        />
        <div
          className="absolute bottom-0 right-0 h-[60px] w-[3px]"
          style={{ background: "linear-gradient(0deg, var(--slide-accent), transparent)" }}
        />
      </div>
    </>
  );
}

/** Glowing orb decorations */
export function GlowOrbs() {
  return (
    <>
      <div
        className="pointer-events-none absolute -top-[100px] right-[30%] z-[5] h-[300px] w-[300px] rounded-full"
        style={{
          background: "radial-gradient(circle, rgba(99, 102, 241, 0.08) 0%, transparent 70%)",
        }}
      />
      <div
        className="pointer-events-none absolute bottom-[10%] left-[10%] z-[5] h-[200px] w-[200px] rounded-full"
        style={{
          background: "radial-gradient(circle, rgba(129, 140, 248, 0.06) 0%, transparent 70%)",
        }}
      />
    </>
  );
}

/** Subtle grain texture overlay */
export function GrainOverlay() {
  return (
    <div
      className="pointer-events-none absolute inset-0 z-[200] opacity-[0.03]"
      style={{
        backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`,
      }}
    />
  );
}
