import { useQuery } from "@tanstack/react-query";
import { api } from "@/api";

/**
 * Whether donations are open (DONATIONS_ENABLED on the server). Until the answer arrives, or if it
 * cannot be loaded, donations are shown as open: the server refuses them anyway when closed.
 */
export function useSiteStatus() {
  const { data } = useQuery({
    queryKey: ["site-status"],
    queryFn: api.getSiteStatus,
    staleTime: 5 * 60_000,
    retry: 1,
  });
  return { donationsEnabled: data?.donations_enabled ?? true, loaded: data !== undefined, platformFee: data?.platform_fee_percent ?? null };
}
