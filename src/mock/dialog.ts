export async function open(options?: {
  multiple?: boolean;
  filters?: Array<{ name: string; extensions: string[] }>;
}): Promise<string | string[] | null> {
  console.log("[Mock dialog] open called with options:", options);
  if (options?.multiple) {
    return ["C:\\apps\\example.ipa"];
  }
  return "C:\\apps\\example.ipa";
}

export async function save(options?: any): Promise<string | null> {
  console.log("[Mock dialog] save called with options:", options);
  return "C:\\apps\\pairing.plist";
}

export async function message(
  msg: string,
  _options?: any,
): Promise<void> {
  console.log("[Mock dialog] message:", msg);
}

export async function ask(
  msg: string,
  _options?: any,
): Promise<boolean> {
  console.log("[Mock dialog] ask:", msg);
  return true;
}

export async function confirm(
  msg: string,
  _options?: any,
): Promise<boolean> {
  console.log("[Mock dialog] confirm:", msg);
  return true;
}
