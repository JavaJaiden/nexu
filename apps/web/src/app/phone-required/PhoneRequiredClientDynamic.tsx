"use client";

import dynamic from "next/dynamic";

const PhoneRequiredClient = dynamic(
  () => import("./PhoneRequiredClient"),
  { ssr: false }
);

export default PhoneRequiredClient;
