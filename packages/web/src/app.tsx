import { ClerkProvider, useAuth } from "@clerk/react";
import { useQueryClient } from "@tanstack/react-query";
import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import { createSyncStoragePersister } from "@tanstack/query-sync-storage-persister";
import { useEffect, useState } from "react";
import { RouterProvider, createRouter } from "@tanstack/react-router";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/sonner";
import { setAccessTokenProvider, clearTokenCache } from "@/lib/auth";
import { routeTree } from "./routeTree.gen";
import { createQueryClient } from "./lib/query-client";

const router = createRouter({ routeTree });

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}

const clerkPublishableKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY || "";

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

  if (!clerkPublishableKey) {
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
