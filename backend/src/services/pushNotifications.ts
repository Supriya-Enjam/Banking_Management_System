
import webpush from "web-push";

const publicKey = process.env.VAPID_PUBLIC_KEY;
const privateKey = process.env.VAPID_PRIVATE_KEY;
const subject = process.env.VAPID_SUBJECT;

const pushConfigured = Boolean(publicKey && privateKey && subject);

if (pushConfigured) {
  webpush.setVapidDetails(subject!, publicKey!, privateKey!);
}

export interface BrowserPushSubscription {
  endpoint: string;
  expirationTime?: number | null;
  keys: {
    p256dh: string;
    auth: string;
  };
}

export interface ChatPushPayload {
  title: string;
  body: string;
  url?: string;
}

export async function sendPushNotification(
  subscription: BrowserPushSubscription,
  payload: ChatPushPayload,
): Promise<boolean> {
  if (!pushConfigured) {
    console.warn("Web Push is not configured. Check the backend .env file.");
    return false;
  }

  try {
    await webpush.sendNotification(
      subscription,
      JSON.stringify({
        title: payload.title,
        body: payload.body,
        url: payload.url ?? "/",
      }),
      {
        TTL: 60 * 60,
      },
    );

    return true;
  } catch (error: unknown) {
    const statusCode =
      typeof error === "object" &&
      error !== null &&
      "statusCode" in error
        ? (error as { statusCode?: number }).statusCode
        : undefined;

    if (statusCode === 404 || statusCode === 410) {
      console.warn("Push subscription has expired or is no longer valid.");
    } else {
      console.error("Failed to send browser push notification:", error);
    }

    return false;
  }
}

export function getVapidPublicKey(): string | null {
  return publicKey ?? null;
}
