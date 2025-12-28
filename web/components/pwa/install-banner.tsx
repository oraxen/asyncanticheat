"use client";

import { useState, useEffect } from "react";
import { RiDownloadLine, RiCloseLine, RiRefreshLine, RiWifiOffLine } from "@remixicon/react";
import { usePWA } from "@/lib/use-pwa";

export function PWAInstallBanner() {
  const { isInstallable, isUpdateAvailable, isOffline, install, update } = usePWA();
  const [dismissed, setDismissed] = useState(false);
  const [showOfflineNotice, setShowOfflineNotice] = useState(false);

  // Check if banner was previously dismissed
  useEffect(() => {
    if (typeof window === "undefined") return;
    const wasDismissed = localStorage.getItem("pwa-banner-dismissed");
    if (wasDismissed) {
      const dismissedTime = parseInt(wasDismissed, 10);
      // Re-show after 7 days
      if (Date.now() - dismissedTime < 7 * 24 * 60 * 60 * 1000) {
        setDismissed(true);
      }
    }
  }, []);

  // Show offline notice briefly
  useEffect(() => {
    if (isOffline) {
      setShowOfflineNotice(true);
      const timer = setTimeout(() => setShowOfflineNotice(false), 5000);
      return () => clearTimeout(timer);
    }
  }, [isOffline]);

  const handleDismiss = () => {
    setDismissed(true);
    localStorage.setItem("pwa-banner-dismissed", Date.now().toString());
  };

  const handleInstall = async () => {
    const success = await install();
    if (success) {
      setDismissed(true);
    }
  };

  // Show update banner
  if (isUpdateAvailable) {
    return (
      <div className="fixed bottom-4 left-4 right-4 z-50 md:left-auto md:right-4 md:w-80 animate-fade-in">
        <div className="flex items-center gap-3 rounded-xl bg-indigo-500/90 backdrop-blur-lg px-4 py-3 shadow-xl border border-indigo-400/20">
          <RiRefreshLine className="h-5 w-5 text-white flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-white">Update available</p>
            <p className="text-xs text-white/70">Refresh to get the latest version</p>
          </div>
          <button
            onClick={update}
            className="px-3 py-1.5 rounded-lg bg-white/20 hover:bg-white/30 text-white text-xs font-medium transition-colors"
          >
            Update
          </button>
        </div>
      </div>
    );
  }

  // Show offline notice
  if (showOfflineNotice && isOffline) {
    return (
      <div className="fixed bottom-4 left-4 right-4 z-50 md:left-auto md:right-4 md:w-80 animate-fade-in">
        <div className="flex items-center gap-3 rounded-xl bg-amber-500/90 backdrop-blur-lg px-4 py-3 shadow-xl border border-amber-400/20">
          <RiWifiOffLine className="h-5 w-5 text-white flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-white">You&apos;re offline</p>
            <p className="text-xs text-white/70">Some features may be limited</p>
          </div>
        </div>
      </div>
    );
  }

  // Show install banner
  if (!isInstallable || dismissed) {
    return null;
  }

  return (
    <div className="fixed bottom-4 left-4 right-4 z-50 md:left-auto md:right-4 md:w-80 animate-fade-in">
      <div className="flex items-center gap-3 rounded-xl bg-[#1a1a1f]/95 backdrop-blur-lg px-4 py-3 shadow-xl border border-white/10">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-500/20 flex-shrink-0">
          <RiDownloadLine className="h-5 w-5 text-indigo-400" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-white">Install AsyncAC</p>
          <p className="text-xs text-white/50">Add to home screen for quick access</p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            onClick={handleInstall}
            className="px-3 py-1.5 rounded-lg bg-indigo-500 hover:bg-indigo-600 text-white text-xs font-medium transition-colors"
          >
            Install
          </button>
          <button
            onClick={handleDismiss}
            className="p-1.5 rounded-lg hover:bg-white/10 text-white/40 hover:text-white/70 transition-colors"
            aria-label="Dismiss"
          >
            <RiCloseLine className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
