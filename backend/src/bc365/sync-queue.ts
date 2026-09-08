const pending = new Set<string>();
let timer: ReturnType<typeof setTimeout> | null = null;
let suppressCount = 0;

export function withoutBcPush<T>(fn: () => Promise<T>): Promise<T> {
  suppressCount += 1;
  return fn().finally(() => {
    suppressCount -= 1;
  });
}

export function scheduleBc365LoadSync(loadId: string | null | undefined): void {
  if (!loadId || suppressCount > 0) return;
  if (!process.env.BC_CLIENT_ID || !process.env.BC_TENANT_ID) return;
  pending.add(loadId);
  if (timer) return;
  timer = setTimeout(() => {
    timer = null;
    void flushBc365Queue();
  }, 400);
}

async function flushBc365Queue(): Promise<void> {
  const ids = Array.from(pending);
  pending.clear();
  if (!ids.length) return;
  const { pushLoadToBc } = await import("./sync-service");
  for (const id of ids) {
    await pushLoadToBc(id);
  }
}
