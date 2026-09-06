/** A 5-color rotation for feature icon badges across the marketing pages —
 * purely decorative variety, not tied to any status meaning. */
export const TONE_CLASSES = [
  "bg-primary/10 text-primary",
  "bg-secondary/10 text-secondary",
  "bg-warning/10 text-warning",
  "bg-success/10 text-success",
  "bg-primary/10 text-primary",
];

export function toneClass(index: number): string {
  return TONE_CLASSES[index % TONE_CLASSES.length]!;
}
