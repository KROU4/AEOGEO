import { apiPostPublic } from "@/lib/api-client";

const TOLT_PUBLIC_KEY = import.meta.env.VITE_TOLT_PUBLIC_KEY as string | undefined;

declare global {
  interface Window {
    tolt?: {
      signup?: (email: string) => void;
      referral?: string;
    };
  }
}

export function initTolt(): void {
  if (!TOLT_PUBLIC_KEY || typeof window === "undefined") {
    return;
  }

  if (document.getElementById("tolt-snippet")) {
    return;
  }

  const script = document.createElement("script");
  script.id = "tolt-snippet";
  script.async = true;
  script.src = "https://cdn.tolt.io/tolt.js";
  script.setAttribute("data-tolt", TOLT_PUBLIC_KEY);
  document.head.appendChild(script);
}

export async function trackReferralSignup(email: string): Promise<void> {
  const referralCode = window.tolt?.referral ?? null;

  if (window.tolt?.signup) {
    window.tolt.signup(email);
  }

  await apiPostPublic("/referral/track", {
    email,
    provider: "tolt",
    referral_code: referralCode,
    source: "complete-signup",
  });
}
