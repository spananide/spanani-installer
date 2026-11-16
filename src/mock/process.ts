export async function relaunch(): Promise<void> {
  console.log("[Mock process] relaunch called");
  if (typeof window !== "undefined") {
    window.location.reload();
  }
}

export async function exit(code = 0): Promise<void> {
  console.log(`[Mock process] exit called with code ${code}`);
}
