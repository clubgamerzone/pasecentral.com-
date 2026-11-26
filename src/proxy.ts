import { NextResponse, type NextRequest } from "next/server";

export function proxy(request: NextRequest) {
  const origin = process.env.APP_URL;
  const previousHosts =
    origin === "https://pasecentral.app"
      ? [
          "pasecentral.vercel.app",
          "pasecentral-demo.vercel.app",
          "www.pasecentral.app",
        ]
      : origin === "https://pasecentral.vercel.app"
        ? ["pasecentral-demo.vercel.app"]
        : [];
  // Preserve old emailed links without redirecting signed provider POSTs.
  if (
    previousHosts.includes(request.nextUrl.hostname) &&
    ["GET", "HEAD"].includes(request.method) &&
    !request.nextUrl.pathname.startsWith("/api/")
  ) {
    const destination = new URL(origin!);
    destination.pathname = request.nextUrl.pathname;
    destination.search = request.nextUrl.search;
    return NextResponse.redirect(destination, 308);
  }
  return NextResponse.next();
}
