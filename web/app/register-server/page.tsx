import { Suspense } from "react";
import { RegisterServerContent } from "./register-server-content";

export default function RegisterServerPage() {
  return (
    <Suspense
      fallback={<div className="min-h-screen surface-0 flex items-center justify-center text-white/60">Loading…</div>}
    >
      <RegisterServerContent />
    </Suspense>
  );
}

