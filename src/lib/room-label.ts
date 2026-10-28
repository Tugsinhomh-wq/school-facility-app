/** "ห้องประชุมภูมินทร์" → "ภูมินทร์": the short name for tiles and buttons. A name that is only the prefix stays whole. */
export function shortRoomName(name: string) {
  const rest = name.replace(/^ห้องประชุม\s*/, "").trim();
  return rest || name;
}
