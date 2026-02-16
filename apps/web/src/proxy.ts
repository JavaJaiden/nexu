import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

// Define public routes that don't require authentication
const isPublicRoute = createRouteMatcher([
  "/",
  "/sign-in",
  "/sign-up",
  "/phone-required",
  "/api/webhook(.*)",
]);

const isPhoneSetupRoute = createRouteMatcher([
  "/phone-required(.*)",
  "/settings/profile(.*)",
  "/api/settings/profile(.*)",
]);

function hasPhoneNumber(claims: unknown) {
  if (!claims || typeof claims !== "object") return false;
  const typed = claims as Record<string, unknown>;
  const phone = typed.phone_number;
  const primaryPhone = typed.primary_phone_number;
  return (
    (typeof phone === "string" && phone.trim().length > 0) ||
    (typeof primaryPhone === "string" && primaryPhone.trim().length > 0)
  );
}

export default clerkMiddleware(async (auth, request) => {
  // Protect all routes except public ones
  if (!isPublicRoute(request)) {
    await auth.protect();
  }

  const state = await auth();
  if (!state.userId || isPublicRoute(request) || isPhoneSetupRoute(request)) {
    return NextResponse.next();
  }

  if (hasPhoneNumber(state.sessionClaims)) {
    return NextResponse.next();
  }

  if (request.nextUrl.pathname.startsWith("/api/")) {
    return NextResponse.json(
      {
        error:
          "Phone number required. Please add and verify your phone number first.",
      },
      { status: 403 }
    );
  }

  const nextUrl = request.nextUrl.clone();
  const returnTo = `${request.nextUrl.pathname}${request.nextUrl.search}`;
  nextUrl.pathname = "/phone-required";
  nextUrl.searchParams.set("returnTo", returnTo);
  return NextResponse.redirect(nextUrl);
});

export const config = {
  matcher: ["/((?!.+\.[\w]+$|_next).*)", "/", "/(api|trpc)(.*)"],
};
