export async function loadP5() {
  return (await import("p5")).default;
}
