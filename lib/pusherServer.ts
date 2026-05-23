import Pusher from "pusher";

const appId = process.env.PUSHER_APP_ID || "";
const key = process.env.PUSHER_KEY || process.env.NEXT_PUBLIC_PUSHER_KEY || "";
const secret = process.env.PUSHER_SECRET || "";
const cluster = process.env.PUSHER_CLUSTER || process.env.NEXT_PUBLIC_PUSHER_CLUSTER || "us2";

let pusherServerInstance: Pusher | null = null;

if (appId && key && secret) {
  try {
    pusherServerInstance = new Pusher({
      appId,
      key,
      secret,
      cluster,
      useTLS: true,
    });
  } catch (e) {
    console.error("Failed to initialize Pusher Server SDK:", e);
  }
} else {
  console.warn("Pusher Server environment variables are missing. Direct real-time broadcasts will fall back to simulation.");
}

export const pusherServer = pusherServerInstance;
