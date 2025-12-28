"use client";

import { useState, useEffect, useCallback, useRef } from "react";

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{
    outcome: "accepted" | "dismissed";
    platform: string;
  }>;
  prompt(): Promise<void>;
}

declare global {
  interface WindowEventMap {
    beforeinstallprompt: BeforeInstallPromptEvent;
  }
}

export interface PWAState {
  isInstallable: boolean;
  isInstalled: boolean;
  isOffline: boolean;
  isUpdateAvailable: boolean;
}

export interface PWAActions {
  install: () => Promise<boolean>;
  update: () => void;
}

export function usePWA(): PWAState & PWAActions {
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isOffline, setIsOffline] = useState(false);
  const [isUpdateAvailable, setIsUpdateAvailable] = useState(false);
  const [registration, setRegistration] = useState<ServiceWorkerRegistration | null>(null);
  const controllerChangeListenerRef = useRef<(() => void) | null>(null);

  // Check if app is installed
  useEffect(() => {
    if (typeof window === "undefined") return;

    // Check display mode (standalone = installed)
    const isStandalone = window.matchMedia("(display-mode: standalone)").matches;
    setIsInstalled(isStandalone);

    // Listen for display mode changes
    const mediaQuery = window.matchMedia("(display-mode: standalone)");
    const handler = (e: MediaQueryListEvent) => setIsInstalled(e.matches);
    mediaQuery.addEventListener("change", handler);

    return () => mediaQuery.removeEventListener("change", handler);
  }, []);

  // Track online/offline status
  useEffect(() => {
    if (typeof window === "undefined") return;

    setIsOffline(!navigator.onLine);

    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  // Capture install prompt
  useEffect(() => {
    if (typeof window === "undefined") return;

    const handler = (e: BeforeInstallPromptEvent) => {
      e.preventDefault();
      setInstallPrompt(e);
    };

    window.addEventListener("beforeinstallprompt", handler);

    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  // Register service worker
  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;

    // Don't register in development
    if (process.env.NODE_ENV === "development") {
      console.log("[PWA] Service worker disabled in development");
      return;
    }

    navigator.serviceWorker
      .register("/sw.js")
      .then((reg) => {
        console.log("[PWA] Service worker registered");
        setRegistration(reg);

        // Check for updates
        reg.addEventListener("updatefound", () => {
          const newWorker = reg.installing;
          if (!newWorker) return;

          newWorker.addEventListener("statechange", () => {
            if (newWorker.state === "installed" && navigator.serviceWorker.controller) {
              console.log("[PWA] Update available");
              setIsUpdateAvailable(true);
            }
          });
        });
      })
      .catch((err) => {
        console.error("[PWA] Service worker registration failed:", err);
      });

    // Handle controller change (new SW activated)
    navigator.serviceWorker.addEventListener("controllerchange", () => {
      console.log("[PWA] New service worker activated");
    });
  }, []);

  // Install app
  const install = useCallback(async () => {
    if (!installPrompt) return false;

    try {
      await installPrompt.prompt();
      const { outcome } = await installPrompt.userChoice;

      if (outcome === "accepted") {
        console.log("[PWA] App installed");
        setInstallPrompt(null);
        return true;
      }
    } catch (error) {
      console.error("[PWA] Install failed:", error);
    }

    return false;
  }, [installPrompt]);

  // Update app
  const update = useCallback(() => {
    if (!registration?.waiting) return;

    // Tell waiting SW to skip waiting
    registration.waiting.postMessage({ type: "SKIP_WAITING" });

    // Only add listener if not already added
    if (!controllerChangeListenerRef.current) {
      const handleControllerChange = () => {
        window.location.reload();
      };
      controllerChangeListenerRef.current = handleControllerChange;
      navigator.serviceWorker.addEventListener("controllerchange", handleControllerChange);
    }
  }, [registration]);

  return {
    isInstallable: !!installPrompt && !isInstalled,
    isInstalled,
    isOffline,
    isUpdateAvailable,
    install,
    update,
  };
}
