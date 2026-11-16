type EventHandler<T = any> = (event: {
  event: string;
  payload: T;
  id: number;
}) => void;

const listeners = new Map<string, Set<EventHandler>>();
let eventIdCounter = 1;

export async function listen<T = any>(
  eventName: string,
  handler: EventHandler<T>,
): Promise<() => void> {
  if (!listeners.has(eventName)) {
    listeners.set(eventName, new Set());
  }
  listeners.get(eventName)!.add(handler);

  return () => {
    listeners.get(eventName)?.delete(handler);
  };
}

export async function once<T = any>(
  eventName: string,
  handler: EventHandler<T>,
): Promise<() => void> {
  const unlisten = await listen<T>(eventName, (event) => {
    unlisten();
    handler(event);
  });
  return unlisten;
}

export async function emit(eventName: string, payload?: any): Promise<void> {
  const handlers = listeners.get(eventName);
  if (handlers) {
    const eventObj = {
      event: eventName,
      payload,
      id: eventIdCounter++,
    };
    for (const handler of Array.from(handlers)) {
      try {
        handler(eventObj);
      } catch (e) {
        console.error(`[Mock event] Error in handler for ${eventName}:`, e);
      }
    }
  }
}
