import { useState, useEffect, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { Sender } from "@/lib/store";

const senderCache = new Map<string, Sender>();
const pendingRequests = new Map<string, { manual: boolean; promise: Promise<Sender | null> }>();

export function useSenderInfo(address: string | undefined, manual: boolean = false) {
  const [sender, setSender] = useState<Sender | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchSender = useCallback(async (addr: string, isManual: boolean, skipCache = false) => {
    const cached = senderCache.get(addr);
    
    // Only use cache if not manual, or if cache already has AI enrichment, and not skipping cache
    if (!skipCache && !isManual && cached) {
      setSender(cached);
      return;
    }
    
    // If it's manual but we already have AI data, we can also use cache
    if (!skipCache && isManual && cached?.ai_last_enriched_at) {
      setSender(cached);
      return;
    }

    // Check if there's already a pending request for this address
    const pending = pendingRequests.get(addr);
    if (pending) {
      // If the pending request is already manual, or we don't need manual, just wait for it
      if (pending.manual || !isManual) {
        const result = await pending.promise;
        setSender(result || null);
        return;
      }
      // If we need manual but pending is not manual, we should probably wait for it 
      // and THEN if it didn't give us what we want (AI info), trigger manual.
      // But for simplicity, let's just let them be separate if manual flags differ, 
      // or just wait.
    }

    setLoading(true);
    const promise = invoke<Sender | null>("get_sender_info", { 
      address: addr, 
      manualTrigger: isManual 
    });
    pendingRequests.set(addr, { manual: isManual, promise });

    try {
      const result = await promise;
      if (result) {
        senderCache.set(addr, result);
        setSender(result);
      }
    } catch (error) {
      console.error("Failed to fetch sender info:", error);
    } finally {
      // Only delete if it's the same promise we started
      if (pendingRequests.get(addr)?.promise === promise) {
        pendingRequests.delete(addr);
      }
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!address) {
      setSender(null);
      setLoading(false);
      return;
    }

    // Reset state for new address
    setSender(senderCache.get(address) || null);
    setLoading(false);

    fetchSender(address, manual);

    // Listen for updates to this sender
    const unlistenPromise = listen<string>("sender-updated", (event) => {
      if (event.payload === address) {
        fetchSender(address, manual, true);
      }
    });

    return () => {
      unlistenPromise.then(unlisten => unlisten());
    };
  }, [address, manual, fetchSender]);

  return { sender, loading };
}
