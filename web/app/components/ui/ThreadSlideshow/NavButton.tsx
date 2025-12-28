interface NavButtonProps {
  direction: "left" | "right";
  onClick: () => void;
  visible: boolean;
  pressed: boolean;
}

export default function NavButton({
  direction,
  onClick,
  visible,
  pressed,
}: NavButtonProps) {
  return (
    <button
      onClick={onClick}
      className={`
        group absolute top-1/2 z-10 -translate-y-1/2
        ${direction === "left" ? "left-2 sm:left-3" : "right-2 sm:right-3"}
        rounded-full p-2 sm:p-2.5
        bg-black/40 backdrop-blur-md
        border border-white/10
        text-white/70
        transition-all duration-200 ease-out
        hover:bg-black/60 hover:text-white hover:scale-110 hover:border-indigo-400/30
        active:scale-95
        ${pressed ? "scale-95 bg-indigo-500/30 text-white border-indigo-400/50" : ""}
        ${visible ? "opacity-100" : "pointer-events-none opacity-0"}
      `}
      aria-label={direction === "left" ? "Previous slide" : "Next slide"}
    >
      <svg
        className={`
          h-4 w-4 sm:h-5 sm:w-5 transition-transform duration-200
          ${pressed ? (direction === "left" ? "-translate-x-0.5" : "translate-x-0.5") : ""}
          group-hover:${direction === "left" ? "-translate-x-0.5" : "translate-x-0.5"}
        `}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {direction === "left" ? (
          <path d="M15 18l-6-6 6-6" />
        ) : (
          <path d="M9 18l6-6-6-6" />
        )}
      </svg>

      {/* Glow effect on hover */}
      <span
        className={`
          absolute inset-0 rounded-full opacity-0 transition-opacity duration-300
          group-hover:opacity-100
          ${direction === "left" ? "bg-gradient-to-r" : "bg-gradient-to-l"}
          from-indigo-400/20 to-transparent
        `}
      />
    </button>
  );
}
