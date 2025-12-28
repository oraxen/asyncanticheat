interface FullscreenButtonProps {
  onClick: () => void;
}

export default function FullscreenButton({ onClick }: FullscreenButtonProps) {
  return (
    <button
      onClick={onClick}
      className="
        group absolute bottom-3 right-3 z-10
        rounded-lg p-1.5 sm:p-2
        bg-black/40 backdrop-blur-md
        border border-white/10
        text-white/70
        transition-all duration-200 ease-out
        hover:bg-black/60 hover:text-white hover:scale-105 hover:border-indigo-400/30
        active:scale-95
      "
      aria-label="View fullscreen"
    >
      <svg
        className="h-4 w-4 sm:h-5 sm:w-5"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
      >
        <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3" />
      </svg>
      {/* Subtle glow */}
      <span className="absolute inset-0 rounded-lg bg-gradient-to-t from-indigo-400/20 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
    </button>
  );
}
