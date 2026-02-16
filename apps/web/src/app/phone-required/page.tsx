import { Suspense } from "react";
import PhoneRequiredClientDynamic from "./PhoneRequiredClientDynamic";

export default function PhoneRequiredPage() {
  return (
    <Suspense fallback={null}>
      <PhoneRequiredClientDynamic />
    </Suspense>
  );
}
