export class Store {
  private values: Map<string, any>;

  constructor(initialValues?: Record<string, any>) {
    this.values = new Map(Object.entries(initialValues || {}));
  }

  async get<T>(key: string): Promise<T | null> {
    return this.values.has(key) ? (this.values.get(key) as T) : null;
  }

  async set(key: string, value: any): Promise<void> {
    this.values.set(key, value);
  }

  async save(): Promise<void> {
    // In-memory mock save
  }

  async keys(): Promise<string[]> {
    return Array.from(this.values.keys());
  }

  async delete(key: string): Promise<boolean> {
    return this.values.delete(key);
  }

  async clear(): Promise<void> {
    this.values.clear();
  }
}

const stores = new Map<string, Store>();

export async function load(name: string): Promise<Store> {
  if (!stores.has(name)) {
    const defaults =
      name === "preferences.json"
        ? {
            "anisetteServer3-1": "mac-ani.jkcoxson.com",
            overrideKeyring: false,
            lang: "de",
          }
        : name === "data.json"
          ? {
              ids: ["matti@spanani.de"],
            }
          : {};
    stores.set(name, new Store(defaults));
  }
  return stores.get(name)!;
}
