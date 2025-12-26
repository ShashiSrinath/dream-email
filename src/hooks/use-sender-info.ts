import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Sender } from "@/lib/store";

const senderCache = new Map<string, Sender>();
const pendingRequests = new Map<string, Promise<Sender | null>>();

export function useSenderInfo(address: string | undefined, manual: boolean = false) {
  const [sender, setSender] = useState<Sender | null>(
    address ? senderCache.get(address) || null : null
  );
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!address) {
      setSender(null);
      return;
    }

    // Only use cache if not manual, or if cache already has AI enrichment
    if (senderCache.has(address) && (!manual || senderCache.get(address)?.ai_last_enriched_at)) {
      setSender(senderCache.get(address)!);
      return;
    }

    const fetchSender = async () => {
      const cacheKey = `${address}:${manual}`;
      if (pendingRequests.has(cacheKey)) {
        const result = await pendingRequests.get(cacheKey);
        setSender(result || null);
        return;
      }

      setLoading(true);
      const promise = invoke<Sender | null>("get_sender_info", { 
        address, 
        manualTrigger: manual 
      });
      pendingRequests.set(cacheKey, promise);

      try {
        const result = await promise;
        if (result) {
          senderCache.set(address, result);
          setSender(result);
        }
      } catch (error) {
        console.error("Failed to fetch sender info:", error);
      } finally {
        pendingRequests.delete(cacheKey);
        setLoading(false);
      }
    };

    fetchSender();
  }, [address, manual]);

  return { sender, loading };
}
