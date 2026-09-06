/**
 * NestJS's global ValidationPipe (`transform: true` + `enableImplicitConversion`)
 * casts every optional numeric query param through `+value`, including when the
 * param is entirely absent from the URL — so an omitted `?limit=` arrives at the
 * controller as `NaN`, not `undefined`. A JS default parameter downstream never
 * fires for `NaN`, so `take = 50` silently becomes `take = NaN` and reaches
 * Prisma as an invalid argument. Apply this at the controller boundary for every
 * optional numeric query param that feeds a paginated/limited query.
 */
export function withDefault(value: number | undefined, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}
