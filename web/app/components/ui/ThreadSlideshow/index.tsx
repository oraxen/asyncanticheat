"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import { slides } from "@/app/data/slides";
import { getThemeStyles } from "@/app/data/themes";
import Slide from "./Slide";
import NavButton from "./NavButton";
import SlideIndicator from "./SlideIndicator";
import FullscreenButton from "./FullscreenButton";
import CloseButton from "./CloseButton";
import { CornerAccents, GlowOrbs, GrainOverlay } from "./Decorations";
import BrandBadge from "./BrandBadge";
import SlideCounter from "./SlideCounter";

export default function ThreadSlideshow() {
  const [currentSlide, setCurrentSlide] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [pressedKey, setPressedKey] = useState<"left" | "right" | null>(null);
  const [isHeroInView, setIsHeroInView] = useState(true);
  const containerRef = useRef<HTMLDivElement>(null);

  const totalSlides = slides.length;
  const isFirstSlide = currentSlide === 0;
  const isLastSlide = currentSlide === totalSlides - 1;

  const goNext = useCallback(() => {
    setCurrentSlide((prev) => (prev + 1) % totalSlides);
  }, [totalSlides]);

  const goPrev = useCallback(() => {
    setCurrentSlide((prev) => (prev - 1 + totalSlides) % totalSlides);
  }, [totalSlides]);

  const goTo = useCallback((index: number) => {
    setCurrentSlide(index);
  }, []);

  const openFullscreen = useCallback(() => {
    // Try native fullscreen first
    if (containerRef.current?.requestFullscreen) {
      containerRef.current.requestFullscreen().catch(() => {
        // Fallback to portal overlay
        setIsFullscreen(true);
      });
    } else {
      setIsFullscreen(true);
    }
  }, []);

  const closeFullscreen = useCallback(() => {
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {});
    }
    setIsFullscreen(false);
  }, []);

  // Handle native fullscreen change events
  useEffect(() => {
    const handleFullscreenChange = () => {
      if (!document.fullscreenElement) {
        setIsFullscreen(false);
      }
    };
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", handleFullscreenChange);
  }, []);

  // Track whether the hero is in view (so arrow keys don't hijack the page)
  useEffect(() => {
    const element = containerRef.current;
    if (!element) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        setIsHeroInView(entry.isIntersecting && entry.intersectionRatio >= 0.35);
      },
      { threshold: [0, 0.35, 1] }
    );

    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const isTypingTarget =
        target?.tagName === "INPUT" ||
        target?.tagName === "TEXTAREA" ||
        target?.isContentEditable === true;
      if (isTypingTarget) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (!isFullscreen && !isHeroInView) return;

      if (e.key === "Escape" && isFullscreen) {
        closeFullscreen();
        return;
      }

      if (e.key === "ArrowRight") {
        setPressedKey("right");
        goNext();
      } else if (e.key === "ArrowLeft") {
        setPressedKey("left");
        goPrev();
      }
    };

    const handleKeyUp = () => {
      setPressedKey(null);
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, [goNext, goPrev, isFullscreen, isHeroInView, closeFullscreen]);

  // Get current theme for decorations
  const currentThemeStyles = getThemeStyles(slides[currentSlide].theme);

  // Slideshow content (shared between embedded and fullscreen)
  const slideshowContent = (
    <div
      className="relative h-full w-full overflow-hidden bg-[#0a0510]"
      style={currentThemeStyles}
    >
      {/* Grain overlay */}
      <GrainOverlay />

      {/* Corner accents */}
      <CornerAccents />

      {/* Glow orbs */}
      <GlowOrbs />

      {/* Slides */}
      {slides.map((slide, index) => (
        <Slide
          key={slide.id}
          slide={slide}
          isActive={index === currentSlide}
          priority={index === 0}
        />
      ))}

      {/* Navigation buttons */}
      <NavButton
        direction="left"
        onClick={goPrev}
        visible={!isFirstSlide}
        pressed={pressedKey === "left"}
      />
      <NavButton
        direction="right"
        onClick={goNext}
        visible={!isLastSlide}
        pressed={pressedKey === "right"}
      />

      {/* Slide counter at top (hide on header slide) */}
      <SlideCounter current={currentSlide + 1} total={totalSlides} visible={!isFirstSlide} />

      {/* Slide indicator dots (hide on header slide) */}
      {!isFirstSlide && (
        <SlideIndicator total={totalSlides} current={currentSlide} onGoTo={goTo} />
      )}

      {/* Brand badge at bottom (hide on header slide) */}
      <BrandBadge visible={!isFirstSlide} />

      {/* Fullscreen button (only in embedded mode) */}
      {!isFullscreen && <FullscreenButton onClick={openFullscreen} />}

      {/* Close button (only in fullscreen mode) */}
      {isFullscreen && <CloseButton onClick={closeFullscreen} />}
    </div>
  );

  return (
    <>
      {/* Normal embedded view */}
      <div
        ref={containerRef}
        className="relative aspect-video w-full overflow-hidden rounded-xl"
      >
        {slideshowContent}
      </div>

      {/* Fullscreen overlay (portal to body) */}
      {isFullscreen &&
        typeof document !== "undefined" &&
        createPortal(
          <div className="fixed inset-0 z-[9999] bg-black">
            {slideshowContent}
          </div>,
          document.body
        )}
    </>
  );
}
