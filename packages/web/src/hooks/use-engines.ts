import { useQuery } from "@tanstack/react-query";
import { apiGet } from "@/lib/api-client";
import type { Engine } from "@/types/engine";

export function useEngines() {
  return useQuery({
    queryKey: ["engines"],
    queryFn: () => apiGet<Engine[]>("/engines/"),
  });
}
