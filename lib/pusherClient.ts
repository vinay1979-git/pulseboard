import PusherClient from "pusher-js";

const key = process.env.NEXT_PUBLIC_PUSHER_KEY || "";
const cluster = process.env.NEXT_PUBLIC_PUSHER_CLUSTER || "us2";

let pusherClientInstance: PusherClient | null = null;

if (key && typeof window !== "undefined") {
  try {
    pusherClientInstance = new PusherClient(key, {
      cluster,
      forceTLS: true,
      authEndpoint: "/api/pusher/auth",
    });
  } catch (e) {
    console.error("Failed to initialize Pusher Client SDK:", e);
  }
} else if (typeof window !== "undefined") {
  console.warn("Pusher Client key is missing. Real-time updates will use simulation / fallback mode.");
}

export const pusherClient = pusherClientInstance;
