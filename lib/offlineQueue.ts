import AsyncStorage from "@react-native-async-storage/async-storage";
import { apiFetch } from "@/lib/api";

export const OFFLINE_QUEUE_KEY = "worktrace_offline_queue";
export const draftKey = (jobId: number) => `draft_job_${jobId}`;

export type QueuedDonePayload = {
  jobId: number;
  answers: { field_key: string; field_value: number }[];
  signature_url: string | null;
};

export async function enqueueOfflineDone(payload: QueuedDonePayload) {
  try {
    const raw = await AsyncStorage.getItem(OFFLINE_QUEUE_KEY);
    const queue: QueuedDonePayload[] = raw ? JSON.parse(raw) : [];
    const filtered = queue.filter((q) => q.jobId !== payload.jobId);
    filtered.push(payload);
    await AsyncStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(filtered));
  } catch (e) {
    console.error("enqueueOfflineDone error", e);
  }
}

export async function flushOfflineQueue() {
  try {
    const raw = await AsyncStorage.getItem(OFFLINE_QUEUE_KEY);
    if (!raw) return;
    const queue: QueuedDonePayload[] = JSON.parse(raw);
    if (!queue.length) return;

    const remaining: QueuedDonePayload[] = [];
    for (const payload of queue) {
      try {
        if (payload.signature_url) {
          await apiFetch(`/api/engineer/jobs/${payload.jobId}`, {
            method: "PATCH",
            body: JSON.stringify({ signature_url: payload.signature_url }),
          }).catch(() => {});
        }

        await apiFetch(`/api/engineer/jobs/${payload.jobId}/done`, {
          method: "PATCH",
          body: JSON.stringify({ answers: payload.answers }),
        });

        await AsyncStorage.removeItem(draftKey(payload.jobId));
        console.log(`[offline sync] job ${payload.jobId} synced`);
      } catch (e) {
        console.error(`[offline sync] failed for job ${payload.jobId}`, e);
        remaining.push(payload);
      }
    }

    if (remaining.length) {
      await AsyncStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(remaining));
    } else {
      await AsyncStorage.removeItem(OFFLINE_QUEUE_KEY);
    }
  } catch (e) {
    console.error("flushOfflineQueue error", e);
  }
}