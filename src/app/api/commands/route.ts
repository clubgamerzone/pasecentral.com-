import { NextResponse } from "next/server";
import { database } from "@/lib/db";
import { requireActor } from "@/lib/auth";
import { execute, rateLimit } from "@/lib/service";
import { originCheck, jsonBody, errorResponse } from "@/lib/http";
import { demoMode } from "@/lib/config";
import { deliver } from "@/lib/delivery";
export async function POST(req: Request) {
  try {
    originCheck(req);
    const a = await requireActor(),
      db = await database();
    await rateLimit(db, `command:${a.id}`, 120);
    const result = await execute(db, a, await jsonBody(req));
    if (demoMode()) await deliver(db);
    return NextResponse.json(result);
  } catch (e) {
    return errorResponse(e);
  }
}
