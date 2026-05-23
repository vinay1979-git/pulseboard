import { pusherClient } from "./pusherClient";

export interface RealtimeEvent {
  type: "question_live" | "response_submitted" | "session_status" | "responses_reset";
  payload: any;
}

export interface RealtimeSubscription {
  unsubscribe: () => void;
}

/**
 * Subscribes to real-time updates for a given session code.
 * Uses Pusher for production-grade WebSocket pushes, and falls back to
 * a premium BroadcastChannel + micro-polling simulation in developer local setup if keys are missing.
 */
export function subscribeToSession(
  sessionCode: string,
  onEvent: (event: RealtimeEvent) => void
): RealtimeSubscription {
  const channelName = `session-${sessionCode}`;
  
  if (pusherClient) {
    try {
      console.log(`Pusher subscribing to channel: ${channelName}`);
      const client = pusherClient;
      const channel = client.subscribe(channelName);
      
      // Bind to Pusher events and map them to unified RealtimeEvents
      channel.bind("questions-live", (data: any) => {
        console.log("Pusher received 'questions-live' event:", data);
        onEvent({
          type: "question_live",
          payload: { questionId: data.questionId }
        });
      });

      channel.bind("session-status", (data: any) => {
        console.log("Pusher received 'session-status' event:", data);
        onEvent({
          type: "session_status",
          payload: { status: data.status }
        });
      });

      channel.bind("session-activated", (data: any) => {
        console.log("Pusher received 'session-activated' event:", data);
        onEvent({
          type: "session_status",
          payload: { status: "active" }
        });
      });

      channel.bind("session-deactivated", (data: any) => {
        console.log("Pusher received 'session-deactivated' event:", data);
        onEvent({
          type: "session_status",
          payload: { status: "inactive" }
        });
      });

      channel.bind("new-vote", (data: any) => {
        console.log("Pusher received 'new-vote' event:", data);
        onEvent({
          type: "response_submitted",
          payload: {
            questionId: data.questionId,
            response: data.response
          }
        });
      });

      channel.bind("responses-reset", (data: any) => {
        console.log("Pusher received 'responses-reset' event:", data);
        onEvent({
          type: "responses_reset",
          payload: { questionId: data.questionId }
        });
      });

      return {
        unsubscribe: () => {
          console.log(`Pusher unsubscribing from channel: ${channelName}`);
          channel.unbind_all();
          client.unsubscribe(channelName);
        }
      };
    } catch (e) {
      console.error("Failed to initialize Pusher Realtime channel, falling back:", e);
    }
  }

  // --- LOCAL FALLBACK REALTIME SYNC (BroadcastChannel + Micro-polling) ---
  
  // 1. Cross-tab instant communication via BroadcastChannel
  let broadcastChannel: BroadcastChannel | null = null;
  if (typeof window !== "undefined") {
    broadcastChannel = new BroadcastChannel(`pulseboard-${channelName}`);
    broadcastChannel.onmessage = (event) => {
      onEvent(event.data as RealtimeEvent);
    };
  }

  // 2. Micro-polling to support multi-device/multi-session sync
  let pollInterval: NodeJS.Timeout | null = null;
  let lastStateString = "";

  const pollState = async () => {
    try {
      const response = await fetch("/api/db", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "getSessionByCode", code: sessionCode }),
      });
      if (!response.ok) return;
      const session = await response.json();
      if (!session) return;

      const questionsResponse = await fetch("/api/db", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "getQuestions", sessionId: session.id }),
      });
      if (!questionsResponse.ok) return;
      const questions = await questionsResponse.json();

      // Hash the live state (live question ID, session status, response counts)
      const liveQuestion = questions.find((q: any) => q.is_live);
      let stateString = `${session.status}-${liveQuestion?.id ?? "none"}`;

      if (liveQuestion) {
        const resResponse = await fetch("/api/db", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "getResponses", questionId: liveQuestion.id }),
        });
        if (resResponse.ok) {
          const resps = await resResponse.json();
          stateString += `-${resps.length}-${JSON.stringify(resps.map((r: any) => r.value).sort())}`;
        }
      }

      if (lastStateString !== "" && lastStateString !== stateString) {
        // Trigger a generic update event to wake up the subscriber UI
        onEvent({
          type: "question_live",
          payload: { triggerPoll: true }
        });
      }
      lastStateString = stateString;
    } catch (e) {
      // Quiet fail to avoid polluting console
    }
  };

  // Poll state every 1.5 seconds for multi-device sync
  if (typeof window !== "undefined") {
    pollInterval = setInterval(() => {
      void pollState();
    }, 1500);
  }

  return {
    unsubscribe: () => {
      if (broadcastChannel) {
        broadcastChannel.close();
      }
      if (pollInterval) {
        clearInterval(pollInterval);
      }
    }
  };
}

/**
 * Broadcasts a real-time event to all active subscribers of a session (local cross-tab fallback).
 */
export async function broadcastSessionEvent(
  sessionCode: string,
  event: RealtimeEvent
): Promise<void> {
  const channelName = `session-${sessionCode}`;

  // Local Broadcast fallback for same-machine instant sync
  if (typeof window !== "undefined") {
    const broadcastChannel = new BroadcastChannel(`pulseboard-${channelName}`);
    broadcastChannel.postMessage(event);
    broadcastChannel.close();
  }
}
