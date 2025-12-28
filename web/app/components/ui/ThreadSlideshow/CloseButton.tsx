interface CloseButtonProps {
  onClick: () => void;
}

export default function CloseButton({ onClick }: CloseButtonProps) {
  return (
    <button
      onClick={onClick}
      className="
        group absolute right-4 top-4 z-10
        rounded-full p-2.5
        bg-black/50 backdrop-blur-md
        border border-white/10
        text-white/80
        transition-all duration-200 ease-out
        hover:bg-black/70 hover:text-white hover:scale-110 hover:border-indigo-400/30
        active:scale-95
      "
      aria-label="Close fullscreen"
    >
      <svg
        className="h-6 w-6"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
      >
        <path d="M18 6L6 18M6 6l12 12" />
      </svg>
    </button>
  );
}
