import { NextResponse } from "next/server";
import { database } from "@/lib/db";
import { deliver } from "@/lib/delivery";
import { required } from "@/lib/config";
import { equal } from "@/lib/crypto";
import { fail } from "@/lib/service";
import { errorResponse } from "@/lib/http";
export async function POST(req: Request) {
  try {
    if (
      !equal(
        req.headers.get("authorization") ?? "",
        `Bearer ${required("WORKER_SECRET")}`,
      )
    )
      fail("No autorizado", 401);
    return NextResponse.json(await deliver(await database()));
  } catch (e) {
    return errorResponse(e);
  }
}
