import { pusherClient } from "./pusherClient";
import { getSessionByCode, getQuestions, getResponses } from "./clientDb";

export interface RealtimeEvent {
  type:
    | "question_live"
    | "response_submitted"
    | "session_status"
    | "responses_reset"
    | "questions_timer_start"
    | "questions_timer_pause"
    | "questions_timer_resume"
    | "leaderboard_updated"
    | "leaderboard-updated"
    | "presence_count";
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

      channel.bind("leaderboard-updated", (data: any) => {
        console.log("Pusher received 'leaderboard-updated' event:", data);
        onEvent({
          type: "leaderboard-updated",
          payload: {}
        });
      });

      channel.bind("leaderboard_updated", (data: any) => {
        console.log("Pusher received 'leaderboard_updated' event:", data);
        onEvent({
          type: "leaderboard-updated",
          payload: {}
        });
      });

      channel.bind("new-response-logged", (data: any) => {
        console.log("Pusher received 'new-response-logged' event:", data);
        onEvent({
          type: "leaderboard-updated",
          payload: {}
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

      // Presence Channel Support
      const presenceChannelName = `presence-session-${sessionCode}`;
      console.log(`Pusher subscribing to presence channel: ${presenceChannelName}`);
      const presenceChannel: any = client.subscribe(presenceChannelName);

      presenceChannel.bind("pusher:subscription_succeeded", (members: any) => {
        onEvent({
          type: "presence_count",
          payload: { count: members.count }
        });
      });

      presenceChannel.bind("pusher:member_added", (member: any) => {
        onEvent({
          type: "presence_count",
          payload: { count: presenceChannel.members.count }
        });
      });

      presenceChannel.bind("pusher:member_removed", (member: any) => {
        onEvent({
          type: "presence_count",
          payload: { count: presenceChannel.members.count }
        });
      });

      return {
        unsubscribe: () => {
          console.log(`Pusher unsubscribing from channels: ${channelName} and ${presenceChannelName}`);
          channel.unbind_all();
          client.unsubscribe(channelName);
          presenceChannel.unbind_all();
          client.unsubscribe(presenceChannelName);
        }
      };
    } catch (e) {
      console.error("Failed to initialize Pusher Realtime channel, falling back:", e);
    }
  }

  // --- LOCAL FALLBACK REALTIME SYNC (BroadcastChannel + Micro-polling) ---
  
  const tabId = typeof window !== "undefined" ? Math.random().toString(36).substring(2, 9) : "";
  const activeTabs = new Map<string, number>();

  let broadcastChannel: BroadcastChannel | null = null;
  let heartbeatInterval: NodeJS.Timeout | null = null;
  let cleanupInterval: NodeJS.Timeout | null = null;
  let initialHeartbeatTimeout: NodeJS.Timeout | null = null;

  if (typeof window !== "undefined") {
    broadcastChannel = new BroadcastChannel(`pulseboard-${channelName}`);
    
    // Add ourselves initially
    activeTabs.set(tabId, Date.now());
    
    broadcastChannel.onmessage = (event) => {
      const data = event.data;
      if (data && data.type === "presence_heartbeat") {
        const senderTabId = data.payload.tabId;
        const prevSize = activeTabs.size;
        
        activeTabs.set(senderTabId, Date.now());
        
        // Notify if a new tab joined
        if (activeTabs.size !== prevSize) {
          onEvent({
            type: "presence_count",
            payload: { count: activeTabs.size }
          });
        }
      } else {
        onEvent(data as RealtimeEvent);
      }
    };

    // Broadcast our heartbeat every 1.5 seconds
    heartbeatInterval = setInterval(() => {
      try {
        if (broadcastChannel) {
          broadcastChannel.postMessage({
            type: "presence_heartbeat",
            payload: { tabId }
          });
        }
      } catch (e) {
        // Safe check for closed channels
      }
    }, 1500);

    // Periodically clean up offline tabs (no heartbeat in 4.5 seconds)
    cleanupInterval = setInterval(() => {
      const now = Date.now();
      let changed = false;
      for (const [tId, lastSeen] of activeTabs.entries()) {
        if (now - lastSeen > 4500 && tId !== tabId) {
          activeTabs.delete(tId);
          changed = true;
        }
      }
      if (changed) {
        onEvent({
          type: "presence_count",
          payload: { count: activeTabs.size }
        });
      }
    }, 2000);
    
    // Broadcast initial heartbeat right away to announce our arrival
    initialHeartbeatTimeout = setTimeout(() => {
      try {
        if (broadcastChannel) {
          broadcastChannel.postMessage({
            type: "presence_heartbeat",
            payload: { tabId }
          });
        }
      } catch (e) {
        // Safe check for closed channels
      }
    }, 200);
  }

  // 2. Micro-polling to support multi-device/multi-session sync
  let pollInterval: NodeJS.Timeout | null = null;
  let lastStateString = "";

  const pollState = async () => {
    try {
      const session = await getSessionByCode(sessionCode);
      if (!session) {
        console.log(`[realtime pollState] session not found for code: ${sessionCode}`);
        return;
      }

      const questions = await getQuestions(session.id);

      // Hash the live state (live question ID, session status, response counts)
      const liveQuestion = questions.find((q: any) => q.is_live);
      let stateString = `${session.status}-${liveQuestion?.id ?? "none"}`;

      if (liveQuestion) {
        const resps = await getResponses(liveQuestion.id);
        stateString += `-${resps.length}-${JSON.stringify(resps.map((r: any) => r.value).sort())}`;
      }

      console.log(`[realtime pollState] code=${sessionCode} stateString=${stateString} lastStateString=${lastStateString}`);

      if (lastStateString !== "" && lastStateString !== stateString) {
        console.log(`[realtime pollState] State changed! Triggering UI update event.`);
        // Trigger a generic update event to wake up the subscriber UI
        onEvent({
          type: "question_live",
          payload: { triggerPoll: true }
        });
      }
      lastStateString = stateString;
    } catch (e: any) {
      console.error(`[realtime pollState] Error polling state for code ${sessionCode}:`, e.message || e);
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
      if (initialHeartbeatTimeout) {
        clearTimeout(initialHeartbeatTimeout);
      }
      if (broadcastChannel) {
        try {
          broadcastChannel.close();
        } catch (e) {
          // Safe check
        }
        broadcastChannel = null;
      }
      if (pollInterval) {
        clearInterval(pollInterval);
      }
      if (heartbeatInterval) {
        clearInterval(heartbeatInterval);
      }
      if (cleanupInterval) {
        clearInterval(cleanupInterval);
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
    try {
      const broadcastChannel = new BroadcastChannel(`pulseboard-${channelName}`);
      broadcastChannel.postMessage(event);
      broadcastChannel.close();
    } catch (e) {
      // Safe check
    }
  }
}
