import { Injectable, Logger } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

const RAW_RETENTION_HOURS = 24;
const HOURLY_RETENTION_DAYS = 30;
const DAILY_RETENTION_DAYS = 365;

/**
 * Bounds storage for the `Metric` table (raw per-service CPU/RAM samples)
 * by rolling old data up into coarser `MetricRollup` buckets and pruning
 * what's been superseded — raw samples roll up into hourly buckets, hourly
 * buckets roll up into daily buckets, each pruned once it's past its own
 * retention window and (for hourly) has already been folded into a daily
 * bucket. All three steps use real aggregate SQL over whatever rows exist;
 * nothing here fabricates data — if no raw samples exist yet (no metrics
 * collector is wired up to write them in this MVP), rollups simply stay
 * empty rather than showing synthetic numbers.
 */
@Injectable()
export class MetricsRetentionService {
  private readonly logger = new Logger("MetricsRetentionService");

  constructor(private readonly prisma: PrismaService) {}

  async run(): Promise<{ hourlyRolled: number; dailyRolled: number; rawPruned: number; hourlyPruned: number; dailyPruned: number }> {
    const hourlyRolled = await this.rollupHourly();
    const rawPruned = await this.pruneRaw();
    const dailyRolled = await this.rollupDaily();
    const hourlyPruned = await this.pruneHourlyRollups();
    const dailyPruned = await this.pruneDailyRollups();

    if (hourlyRolled || dailyRolled || rawPruned || hourlyPruned || dailyPruned) {
      this.logger.log(
        `Metric retention: rolled ${hourlyRolled} hourly + ${dailyRolled} daily buckets; pruned ${rawPruned} raw, ${hourlyPruned} hourly, ${dailyPruned} daily rows`,
      );
    }
    return { hourlyRolled, dailyRolled, rawPruned, hourlyPruned, dailyPruned };
  }

  /** Groups raw Metric rows older than one full hour into hourly buckets
   * (avg/max per service per hour), upserting so a bucket that already has
   * some samples rolled up gets topped up rather than duplicated. */
  private async rollupHourly(): Promise<number> {
    const cutoff = new Date(Date.now() - 60 * 60 * 1000);
    const rows = await this.prisma.$queryRaw<
      { serviceId: string; bucket: Date; avgCpu: number | null; maxCpu: number | null; avgRam: number | null; maxRam: number | null; count: bigint }[]
    >`
      SELECT "serviceId",
             date_trunc('hour', "timestamp") AS bucket,
             avg("cpuPct") AS "avgCpu", max("cpuPct") AS "maxCpu",
             avg("ramMb")::float AS "avgRam", max("ramMb") AS "maxRam",
             count(*) AS count
      FROM metrics
      WHERE "timestamp" < ${cutoff}
      GROUP BY "serviceId", bucket
    `;

    for (const row of rows) {
      await this.prisma.metricRollup.upsert({
        where: { serviceId_period_periodStart: { serviceId: row.serviceId, period: "HOURLY", periodStart: row.bucket } },
        create: {
          serviceId: row.serviceId,
          period: "HOURLY",
          periodStart: row.bucket,
          avgCpuPct: row.avgCpu,
          maxCpuPct: row.maxCpu,
          avgRamMb: row.avgRam,
          maxRamMb: row.maxRam,
          sampleCount: Number(row.count),
        },
        update: {
          avgCpuPct: row.avgCpu,
          maxCpuPct: row.maxCpu,
          avgRamMb: row.avgRam,
          maxRamMb: row.maxRam,
          sampleCount: Number(row.count),
        },
      });
    }
    return rows.length;
  }

  /** Deletes raw samples once they're past the full-resolution window —
   * safe to run every cycle since rollupHourly() always runs first and
   * only ever rolls up rows already older than that same one-hour cutoff. */
  private async pruneRaw(): Promise<number> {
    const cutoff = new Date(Date.now() - RAW_RETENTION_HOURS * 60 * 60 * 1000);
    const result = await this.prisma.metric.deleteMany({ where: { timestamp: { lt: cutoff } } });
    return result.count;
  }

  /** Folds hourly buckets older than the hourly retention window into daily
   * buckets. The daily average is an average of hourly averages (each
   * hour weighted equally) rather than a re-average of raw samples, which
   * is the standard rollup-of-rollup approach once raw data is gone. */
  private async rollupDaily(): Promise<number> {
    const cutoff = new Date(Date.now() - HOURLY_RETENTION_DAYS * 24 * 60 * 60 * 1000);
    const rows = await this.prisma.$queryRaw<
      { serviceId: string; bucket: Date; avgCpu: number | null; maxCpu: number | null; avgRam: number | null; maxRam: number | null; count: bigint }[]
    >`
      SELECT "serviceId",
             date_trunc('day', "periodStart") AS bucket,
             avg("avgCpuPct") AS "avgCpu", max("maxCpuPct") AS "maxCpu",
             avg("avgRamMb") AS "avgRam", max("maxRamMb") AS "maxRam",
             sum("sampleCount") AS count
      FROM metric_rollups
      WHERE period = 'HOURLY' AND "periodStart" < ${cutoff}
      GROUP BY "serviceId", bucket
    `;

    for (const row of rows) {
      await this.prisma.metricRollup.upsert({
        where: { serviceId_period_periodStart: { serviceId: row.serviceId, period: "DAILY", periodStart: row.bucket } },
        create: {
          serviceId: row.serviceId,
          period: "DAILY",
          periodStart: row.bucket,
          avgCpuPct: row.avgCpu,
          maxCpuPct: row.maxCpu,
          avgRamMb: row.avgRam,
          maxRamMb: row.maxRam,
          sampleCount: Number(row.count),
        },
        update: {
          avgCpuPct: row.avgCpu,
          maxCpuPct: row.maxCpu,
          avgRamMb: row.avgRam,
          maxRamMb: row.maxRam,
          sampleCount: Number(row.count),
        },
      });
    }
    return rows.length;
  }

  private async pruneHourlyRollups(): Promise<number> {
    const cutoff = new Date(Date.now() - HOURLY_RETENTION_DAYS * 24 * 60 * 60 * 1000);
    const result = await this.prisma.metricRollup.deleteMany({ where: { period: "HOURLY", periodStart: { lt: cutoff } } });
    return result.count;
  }

  private async pruneDailyRollups(): Promise<number> {
    const cutoff = new Date(Date.now() - DAILY_RETENTION_DAYS * 24 * 60 * 60 * 1000);
    const result = await this.prisma.metricRollup.deleteMany({ where: { period: "DAILY", periodStart: { lt: cutoff } } });
    return result.count;
  }
}
