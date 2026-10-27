
import { api } from "./api";

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding)
    .replace(/-/g, "+")
    .replace(/_/g, "/");

  const rawData = window.atob(base64);
  const output = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; i += 1) {
    output[i] = rawData.charCodeAt(i);
  }

  return output;
}

export async function enableDesktopPushNotifications(): Promise<string> {
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
    throw new Error("This browser does not support push notifications.");
  }

  if (!("Notification" in window)) {
    throw new Error("This browser does not support desktop notifications.");
  }

  if (Notification.permission === "denied") {
    throw new Error(
      "Notifications are blocked. Allow them in your browser site settings first."
    );
  }

  const permission = await Notification.requestPermission();

  if (permission !== "granted") {
    throw new Error("Notification permission was not granted.");
  }

  const registration = await navigator.serviceWorker.register("/sw.js");
  await navigator.serviceWorker.ready;

  let subscription = await registration.pushManager.getSubscription();

  if (!subscription) {
    const { publicKey } = await api.getPushNotificationPublicKey();

    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(publicKey) as BufferSource,
    });
  }

  const subscriptionJson = subscription.toJSON();

  await api.subscribeToPushNotifications(subscriptionJson as PushSubscriptionJSON);

  return "Desktop push notifications enabled.";
}

export async function disableDesktopPushNotifications(): Promise<string> {
  const registration = await navigator.serviceWorker.getRegistration();

  if (!registration) {
    return "No active push subscription was found.";
  }

  const subscription = await registration.pushManager.getSubscription();

  if (!subscription) {
    return "No active push subscription was found.";
  }

  await api.unsubscribeFromPushNotifications(subscription.endpoint);
  await subscription.unsubscribe();

  return "Desktop push notifications disabled.";
}
