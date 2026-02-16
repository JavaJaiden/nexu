"use client";

import { UserProfile, useAuth } from "@clerk/nextjs";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState, useRef } from "react";

// Use standard React elements instead of Tamagui to avoid SSR issues
export default function PhoneRequiredClient() {
  const { isLoaded, userId } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const containerRef = useRef<HTMLDivElement>(null);
  
  const nextPath = useMemo(() => {
    const returnTo = searchParams.get("returnTo");
    return typeof returnTo === "string" && returnTo.startsWith("/")
      ? returnTo
      : "/dashboard";
  }, [searchParams]);

  useEffect(() => {
    if (!isLoaded) return;
    if (!userId) {
      router.replace("/sign-in");
    }
  }, [isLoaded, userId, router]);

  // Apply Tamagui theme classes to match the rest of the app
  useEffect(() => {
    if (containerRef.current) {
      const theme = document.documentElement.dataset.theme || "light";
      containerRef.current.className = `t_${theme}`;
    }
  }, []);

  if (!isLoaded || !userId) {
    return null;
  }

  return (
    <div
      ref={containerRef}
      style={{
        display: "flex",
        flexDirection: "column",
        flex: 1,
        minHeight: "100vh",
        backgroundColor: "var(--background, #ffffff)",
        alignItems: "center",
        justifyContent: "center",
        padding: "24px",
        gap: "16px",
      }}
    >
      <h1
        style={{
          fontSize: "24px",
          fontWeight: 700,
          color: "var(--color, #000000)",
          margin: 0,
        }}
      >
        Phone Number Required
      </h1>
      <p
        style={{
          fontSize: "14px",
          color: "var(--textMuted, #666666)",
          maxWidth: "680px",
          textAlign: "center",
          margin: 0,
        }}
      >
        Add and verify a phone number to continue using Nexu.
      </p>

      <div
        style={{
          width: "100%",
          maxWidth: "820px",
          borderWidth: "1px",
          borderStyle: "solid",
          borderColor: "var(--border, #e5e5e5)",
          borderRadius: "10px",
          overflow: "hidden",
        }}
      >
        <UserProfile />
      </div>

      <Link
        href={nextPath}
        style={{
          padding: "12px 24px",
          backgroundColor: "var(--color, #000000)",
          color: "var(--background, #ffffff)",
          borderRadius: "8px",
          textDecoration: "none",
          fontSize: "16px",
          fontWeight: 500,
          cursor: "pointer",
          border: "none",
        }}
      >
        Continue
      </Link>
    </div>
  );
}
