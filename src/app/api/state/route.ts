import { NextResponse } from "next/server";
import { database } from "@/lib/db";
import { currentActor } from "@/lib/auth";
import { state } from "@/lib/state";
import { errorResponse } from "@/lib/http";
export const dynamic = "force-dynamic";
export async function GET() {
  try {
    return NextResponse.json(
      await state(await database(), await currentActor()),
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (e) {
    return errorResponse(e);
  }
}
