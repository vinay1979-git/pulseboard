import { NextRequest, NextResponse } from "next/server";
import * as db from "@/lib/db";
import { QuestionType, SessionStatus } from "@/lib/schema";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action, ...args } = body;

    switch (action) {
      case "getSessions":
        return NextResponse.json(await db.getSessions(args.userId));
      case "getSessionByCode":
        return NextResponse.json(await db.getSessionByCode(args.code));
      case "createSession":
        return NextResponse.json(await db.createSession(args.userId, args.title));
      case "updateSessionStatus":
        await db.updateSessionStatus(args.sessionId, args.status as SessionStatus);
        return NextResponse.json({ success: true });
      case "deleteSession":
        await db.deleteSession(args.sessionId);
        return NextResponse.json({ success: true });
      case "getQuestions":
        return NextResponse.json(await db.getQuestions(args.sessionId));
      case "createQuestion":
        return NextResponse.json(
          await db.createQuestion(args.sessionId, args.type as QuestionType, args.promptText, args.options)
        );
      case "deleteQuestion":
        await db.deleteQuestion(args.questionId);
        return NextResponse.json({ success: true });
      case "setQuestionLive":
        await db.setQuestionLive(args.sessionId, args.questionId);
        return NextResponse.json({ success: true });
      case "setQuestionsLive":
        await db.setQuestionsLive(args.sessionId, args.questionIds);
        return NextResponse.json({ success: true });
      case "updateSessionTitle":
        await db.updateSessionTitle(args.sessionId, args.title);
        return NextResponse.json({ success: true });
      case "reorderQuestions":
        await db.reorderQuestions(args.sessionId, args.questionIds);
        return NextResponse.json({ success: true });
      case "getResponses":
        return NextResponse.json(await db.getResponses(args.questionId));
      case "submitResponse":
        return NextResponse.json(await db.submitResponse(args.questionId, args.participantId, args.value));
      case "resetResponses":
        await db.resetResponses(args.questionId);
        return NextResponse.json({ success: true });
      case "syncUserProfile":
        return NextResponse.json(await db.syncUserProfile(args.userId, args.email));
      case "getAllUsers":
        return NextResponse.json(await db.getAllUsers());
      case "approveUser":
        await db.approveUser(args.userId);
        return NextResponse.json({ success: true });
      case "manuallyAddUser":
        return NextResponse.json(await db.manuallyAddUser(args.email));
      default:
        return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
    }
  } catch (error: any) {
    console.error("API error:", error);
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 });
  }
}
