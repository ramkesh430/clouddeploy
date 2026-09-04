export interface ResourcePreset {
  id: "nano" | "starter" | "developer" | "pro" | "custom";
  name: string;
  cpuCores: number;
  ramMb: number;
  diskMb: number;
  estimatedMonthlyUsd: number;
}

export const RESOURCE_PRESETS: ResourcePreset[] = [
  { id: "nano", name: "Nano", cpuCores: 0.25, ramMb: 256, diskMb: 1024, estimatedMonthlyUsd: 2 },
  { id: "starter", name: "Starter", cpuCores: 0.5, ramMb: 512, diskMb: 2048, estimatedMonthlyUsd: 5 },
  { id: "developer", name: "Developer", cpuCores: 1, ramMb: 1024, diskMb: 4096, estimatedMonthlyUsd: 10 },
  { id: "pro", name: "Pro", cpuCores: 2, ramMb: 4096, diskMb: 8192, estimatedMonthlyUsd: 25 },
];

export interface CustomResourceSpec {
  cpuCores: number;
  ramMb: number;
  diskMb: number;
}
