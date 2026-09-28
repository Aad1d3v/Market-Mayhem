export function levelFromXp(xp: number): number {
  let level = 1;
  let need = 250;
  let acc = 0;
  while (xp >= acc + need) {
    acc += need;
    level += 1;
    need += 100;
  }
  return level;
}
