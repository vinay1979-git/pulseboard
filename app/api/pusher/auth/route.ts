import { NextRequest, NextResponse } from "next/server";
import { pusherServer } from "@/lib/pusherServer";

export async function POST(req: NextRequest) {
  try {
    const text = await req.text();
    const params = new URLSearchParams(text);
    const socketId = params.get("socket_id");
    const channelName = params.get("channel_name");

    if (!socketId || !channelName) {
      return NextResponse.json({ error: "Missing socket_id or channel_name" }, { status: 400 });
    }

    if (!pusherServer) {
      return NextResponse.json({ error: "Pusher server is not configured" }, { status: 500 });
    }

    // Generate a secure random user ID for the presence channel
    const userId = `user-${Math.random().toString(36).substring(2, 11)}`;
    const presenceData = {
      user_id: userId,
      user_info: { name: "Guest", joinedAt: new Date().toISOString() }
    };

    const authResponse = pusherServer.authorizeChannel(socketId, channelName, presenceData);
    return NextResponse.json(authResponse);
  } catch (error: any) {
    console.error("Pusher authorization error:", error);
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 });
  }
}
