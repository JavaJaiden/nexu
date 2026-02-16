"use client";

import { Suspense } from "react";
import PhoneRequiredClient from "./PhoneRequiredClient";

export default function PhoneRequiredPage() {
  return (
    <Suspense fallback={null}>
      <PhoneRequiredClient />
    </Suspense>
  );
}
