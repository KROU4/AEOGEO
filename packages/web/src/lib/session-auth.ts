import { useAuth, useClerk } from "@clerk/react";

const BYPASS_AUTH = import.meta.env.VITE_E2E_BYPASS_AUTH === "true";

export function isAuthBypassed(): boolean {
  return BYPASS_AUTH;
}

export function useSessionAuth() {
  if (BYPASS_AUTH) {
    return {
      isLoaded: true,
      isSignedIn: true,
      userId: "e2e-user",
      getToken: async () => "e2e-token",
    };
  }
  return useAuth();
}

export function useSessionClerk() {
  if (BYPASS_AUTH) {
    return {
      signOut: async (_opts?: { redirectUrl?: string }) => {},
    };
  }
  return useClerk();
}
