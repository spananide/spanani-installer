export async function openUrl(url: string): Promise<void> {
  console.log("[Mock opener] openUrl:", url);
  if (typeof window !== "undefined") {
    window.open(url, "_blank");
  }
}
