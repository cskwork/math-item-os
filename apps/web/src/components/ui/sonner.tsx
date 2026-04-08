"use client";

import { Toaster as SonnerToaster } from "sonner";

/** 전역 Toast 컨테이너 - layout.tsx에서 한 번만 마운트 */
export function Toaster() {
  return (
    <SonnerToaster
      position="top-right"
      toastOptions={{
        className: "text-sm",
        duration: 3000,
      }}
      richColors
      closeButton
    />
  );
}
