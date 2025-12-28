interface SlideIndicatorProps {
  total: number;
  current: number;
  onGoTo: (index: number) => void;
}

export default function SlideIndicator({
  total,
  current,
  onGoTo,
}: SlideIndicatorProps) {
  return (
    <div className="absolute bottom-3 left-1/2 z-10 flex -translate-x-1/2 gap-1.5 sm:gap-2">
      {Array.from({ length: total }).map((_, i) => (
        <button
          key={i}
          onClick={() => onGoTo(i)}
          className={`
            h-1.5 rounded-full transition-all duration-300 ease-out
            ${
              i === current
                ? "w-6 bg-indigo-400 shadow-[0_0_10px_rgba(99,102,241,0.5)]"
                : "w-1.5 bg-white/30 hover:bg-white/50"
            }
          `}
          aria-label={`Go to slide ${i + 1}`}
        />
      ))}
    </div>
  );
}
