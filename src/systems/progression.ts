// Experience rules. Re-cleared areas are worth less, and enemies that are far
// below the player's level eventually give no experience at all.

export function levelDiffMult(playerLevel: number, enemyLevel: number): number {
  const diff = playerLevel - enemyLevel;
  if (diff <= 0) return Math.min(1.5, 1 + 0.1 * -diff);
  return Math.max(0, 1 - 0.2 * diff);
}

/** Each full clear of a zone (followed by a trip back to town) reduces its experience. */
export function fatigueMult(timesCleared: number): number {
  return Math.max(0.5, Math.pow(0.85, timesCleared));
}

export function xpForKill(baseXp: number, enemyLevel: number, playerLevel: number, timesCleared: number, elite: boolean): number {
  const scaled = baseXp * (1 + 0.5 * (enemyLevel - 1));
  return Math.round(scaled * levelDiffMult(playerLevel, enemyLevel) * fatigueMult(timesCleared) * (elite ? 3 : 1));
}
