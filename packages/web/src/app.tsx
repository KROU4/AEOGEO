import { ClerkProvider, useAuth } from "@clerk/react";
import { useQueryClient } from "@tanstack/react-query";
import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import { createSyncStoragePersister } from "@tanstack/query-sync-storage-persister";
import { useEffect, useState } from "react";
import { RouterProvider, createRouter } from "@tanstack/react-router";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/sonner";
import { setAccessTokenProvider, clearTokenCache } from "@/lib/auth";
import { isAuthBypassed } from "@/lib/session-auth";
import { initTolt } from "@/lib/tolt";
import { routeTree } from "./routeTree.gen";
import { createQueryClient } from "./lib/query-client";

const router = createRouter({ routeTree });

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}

const clerkPublishableKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY || "";
const authBypassEnabled = isAuthBypassed();

function ClerkSessionBridge() {
  const queryClient = useQueryClient();
  const { getToken, isLoaded, userId } = useAuth();

  useEffect(() => {
    if (!isLoaded) {
      return;
    }

    setAccessTokenProvider(async () => {
      const token = await getToken();
      return token ?? null;
    });

    return () => {
      setAccessTokenProvider(null);
    };
  }, [getToken, isLoaded, userId]);

  useEffect(() => {
    clearTokenCache();

    if (!isLoaded) {
      return;
    }

    if (!userId) {
      queryClient.clear();
      return;
    }

    queryClient.invalidateQueries({ queryKey: ["auth"] });
  }, [isLoaded, queryClient, userId]);

  return null;
}

const persister = createSyncStoragePersister({
  storage: window.localStorage,
  key: "aeogeo_query_cache",
});

export function App() {
  const [queryClient] = useState(() => createQueryClient());

  useEffect(() => {
    if (!authBypassEnabled) {
      return;
    }
    setAccessTokenProvider(async () => "e2e-token");
    return () => {
      setAccessTokenProvider(null);
    };
  }, []);

  useEffect(() => {
    initTolt();
  }, []);

  if (!authBypassEnabled && !clerkPublishableKey) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-6 text-center">
        <div className="max-w-md space-y-2">
          <h1 className="text-xl font-semibold text-foreground">
            Clerk is not configured
          </h1>
          <p className="text-sm text-muted-foreground">
            Set `VITE_CLERK_PUBLISHABLE_KEY` before starting the web app.
          </p>
        </div>
      </div>
    );
  }

  if (authBypassEnabled) {
    return (
      <PersistQueryClientProvider
        client={queryClient}
        persistOptions={{ persister, maxAge: 5 * 60 * 1000 }}
      >
        <TooltipProvider>
          <RouterProvider router={router} />
          <Toaster />
        </TooltipProvider>
      </PersistQueryClientProvider>
    );
  }

  return (
    <ClerkProvider publishableKey={clerkPublishableKey}>
      <PersistQueryClientProvider
        client={queryClient}
        persistOptions={{ persister, maxAge: 5 * 60 * 1000 }}
      >
        <ClerkSessionBridge />
        <TooltipProvider>
          <RouterProvider router={router} />
          <Toaster />
        </TooltipProvider>
      </PersistQueryClientProvider>
    </ClerkProvider>
  );
}
