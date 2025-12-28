import Image from "next/image";
import type { SlideData } from "@/app/data/slides";
import { getThemeStyles, themes } from "@/app/data/themes";
import SlideContent from "./SlideContent";

interface SlideProps {
  slide: SlideData;
  isActive: boolean;
  priority?: boolean;
}

export default function Slide({ slide, isActive, priority = false }: SlideProps) {
  const themeStyles = getThemeStyles(slide.theme);
  const themeValues = themes[slide.theme];
  const isHeaderSlide = !slide.chapter && !slide.title;

  return (
    <div
      className={`
        absolute inset-0
        transition-all duration-500 ease-out
        ${isActive ? "visible opacity-100" : "invisible opacity-0"}
      `}
      style={themeStyles}
      data-slide={slide.id}
    >
      {/* Background image */}
      <div className="absolute inset-0">
        <Image
          src={slide.background}
          alt=""
          fill
          priority={priority}
          loading={priority ? "eager" : "lazy"}
          className="object-cover"
          style={{
            filter: isHeaderSlide
              ? "brightness(1)"
              : `brightness(${themeValues.bgBrightness})`,
          }}
          sizes="100vw"
        />

        {/* Vignette overlay */}
        {!isHeaderSlide && (
          <div
            className="pointer-events-none absolute inset-0 z-[1]"
            style={{
              background: `
                radial-gradient(circle at 50% 50%, rgba(0, 0, 0, 0) 45%, rgba(0, 0, 0, ${themeValues.vignetteStrength}) 100%),
                linear-gradient(to right, rgba(0, 0, 0, ${themeValues.vignetteStrength * 0.4}) 0%, rgba(0, 0, 0, 0) 25%, rgba(0, 0, 0, 0) 75%, rgba(0, 0, 0, ${themeValues.vignetteStrength * 0.4}) 100%)
              `,
            }}
          />
        )}
      </div>

      {/* Decorative frame border */}
      <div
        className="pointer-events-none absolute inset-0 z-50 border-[3px]"
        style={{ borderColor: "var(--slide-accent-soft)" }}
      />

      {/* Content panel */}
      <SlideContent slide={slide} isActive={isActive} />
    </div>
  );
}
