"use client";

/**
 * Web Push Notification utilities
 *
 * Note: Web Push requires:
 * 1. VAPID keys (generate with: npx web-push generate-vapid-keys)
 * 2. A backend endpoint to store push subscriptions
 * 3. A server-side push service to send notifications
 *
 * Environment variables needed:
 * - NEXT_PUBLIC_VAPID_PUBLIC_KEY: Public VAPID key for client subscription
 * - VAPID_PRIVATE_KEY: Private key for server-side push sending
 */

// Check if push notifications are supported
export function isPushSupported(): boolean {
  if (typeof window === "undefined") return false;
  return "PushManager" in window && "serviceWorker" in navigator;
}

// Get current push subscription
export async function getSubscription(): Promise<PushSubscription | null> {
  if (!isPushSupported()) return null;

  try {
    const registration = await navigator.serviceWorker.ready;
    return registration.pushManager.getSubscription();
  } catch (error) {
    console.error("[Notifications] Failed to get subscription:", error);
    return null;
  }
}

// Request notification permission
export async function requestPermission(): Promise<NotificationPermission> {
  if (!("Notification" in window)) {
    return "denied";
  }
  return Notification.requestPermission();
}

// Subscribe to push notifications
export async function subscribeToPush(): Promise<PushSubscription | null> {
  if (!isPushSupported()) {
    console.log("[Notifications] Push not supported");
    return null;
  }

  const permission = await requestPermission();
  if (permission !== "granted") {
    console.log("[Notifications] Permission not granted");
    return null;
  }

  const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  if (!vapidPublicKey) {
    console.error("[Notifications] VAPID public key not configured");
    return null;
  }

  try {
    const registration = await navigator.serviceWorker.ready;

    // Convert VAPID key from base64 to Uint8Array
    const applicationServerKey = urlBase64ToUint8Array(vapidPublicKey);

    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey,
    });

    console.log("[Notifications] Subscribed to push:", subscription);

    // TODO: Send subscription to backend
    // await fetch('/api/notifications/subscribe', {
    //   method: 'POST',
    //   body: JSON.stringify(subscription),
    //   headers: { 'Content-Type': 'application/json' },
    // });

    return subscription;
  } catch (error) {
    console.error("[Notifications] Failed to subscribe:", error);
    return null;
  }
}

// Unsubscribe from push notifications
export async function unsubscribeFromPush(): Promise<boolean> {
  try {
    const subscription = await getSubscription();
    if (!subscription) return true;

    await subscription.unsubscribe();

    // TODO: Remove subscription from backend
    // await fetch('/api/notifications/unsubscribe', {
    //   method: 'POST',
    //   body: JSON.stringify({ endpoint: subscription.endpoint }),
    //   headers: { 'Content-Type': 'application/json' },
    // });

    console.log("[Notifications] Unsubscribed from push");
    return true;
  } catch (error) {
    console.error("[Notifications] Failed to unsubscribe:", error);
    return false;
  }
}

// Show a local notification (for testing)
export async function showLocalNotification(
  title: string,
  options?: NotificationOptions
): Promise<void> {
  const permission = await requestPermission();
  if (permission !== "granted") return;

  const registration = await navigator.serviceWorker.ready;
  await registration.showNotification(title, {
    icon: "/icon-192.png",
    badge: "/icon-128.png",
    ...options,
  });
}

// Helper to convert VAPID key
function urlBase64ToUint8Array(base64String: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length) as Uint8Array<ArrayBuffer>;

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

// Notification types for the app
export interface AppNotification {
  type: "finding" | "alert" | "update" | "info";
  title: string;
  body: string;
  url?: string;
  severity?: "low" | "medium" | "high" | "critical";
}

// Format notification based on type
export function formatNotification(notification: AppNotification): NotificationOptions {
  const icons: Record<AppNotification["type"], string> = {
    finding: "/icon-192.png",
    alert: "/icon-192.png",
    update: "/icon-192.png",
    info: "/icon-192.png",
  };

  return {
    body: notification.body,
    icon: icons[notification.type],
    badge: "/icon-128.png",
    tag: `asyncac-${notification.type}`,
    data: {
      url: notification.url || "/dashboard",
      type: notification.type,
    },
  };
}
