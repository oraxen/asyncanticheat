import { Suspense } from "react";
import { LoginContent } from "./login-content";

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen surface-0 flex items-center justify-center">
          <div className="w-8 h-8 border-2 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin" />
        </div>
      }
    >
      <LoginContent />
    </Suspense>
  );
}
