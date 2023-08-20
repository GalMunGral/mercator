export function dist(a: Touch, b: Touch) {
  return Math.sqrt((a.clientX - b.clientX) ** 2 + (a.clientY - b.clientY) ** 2);
}
