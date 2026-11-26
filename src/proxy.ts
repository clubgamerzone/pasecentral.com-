import { NextResponse, type NextRequest } from "next/server";

export function proxy(request: NextRequest) {
  // Preserve old emailed links without redirecting signed provider POSTs.
  if (
    process.env.APP_URL === "https://pasecentral.vercel.app" &&
    request.nextUrl.hostname === "pasecentral-demo.vercel.app" &&
    ["GET", "HEAD"].includes(request.method) &&
    !request.nextUrl.pathname.startsWith("/api/")
  ) {
    const destination = new URL("https://pasecentral.vercel.app");
    destination.pathname = request.nextUrl.pathname;
    destination.search = request.nextUrl.search;
    return NextResponse.redirect(destination, 308);
  }
  return NextResponse.next();
}
