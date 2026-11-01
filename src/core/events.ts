// Tiny typed event bus used to decouple gameplay systems from UI.

type Handler<T> = (payload: T) => void;

export interface GameEvents {
  toast: { text: string; color?: string };
  log: { text: string; color?: string };
  kill: { enemyId: string; zoneId: string; elite: boolean; boss: boolean; bountyTag?: string };
  itemGained: { itemId: string; qty: number };
  levelUp: { level: number };
  lifeLevelUp: { skill: string; level: number };
  questUpdate: Record<string, never>;
  zoneEnter: { zoneId: string };
  playerDied: Record<string, never>;
  ui: Record<string, never>;
}

class Bus {
  private handlers = new Map<string, Set<Handler<any>>>();
  on<K extends keyof GameEvents>(type: K, fn: Handler<GameEvents[K]>): () => void {
    let set = this.handlers.get(type);
    if (!set) this.handlers.set(type, (set = new Set()));
    set.add(fn);
    return () => set!.delete(fn);
  }
  emit<K extends keyof GameEvents>(type: K, payload: GameEvents[K]): void {
    const set = this.handlers.get(type);
    if (set) for (const fn of [...set]) fn(payload);
  }
}

export const bus = new Bus();
