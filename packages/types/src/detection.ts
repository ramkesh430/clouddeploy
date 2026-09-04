import { Framework, Runtime, ServiceType } from "./enums";

/** Result of scanning a repository (or a subdirectory of one) for a deployable service. */
export interface DetectedService {
  name: string;
  type: ServiceType;
  runtime: Runtime;
  framework: Framework;
  rootDirectory: string;
  buildCommand: string | null;
  startCommand: string | null;
  installCommand: string | null;
  port: number | null;
  runtimeVersion: string | null;
  confidence: number;
}

export interface DetectedDatabaseRequirement {
  engine: "POSTGRESQL" | "MYSQL" | "MARIADB";
  reason: string;
}

export interface DetectedRedisRequirement {
  reason: string;
}

export interface RepositoryDetectionResult {
  repositoryFullName: string;
  defaultBranch: string;
  services: DetectedService[];
  database: DetectedDatabaseRequirement | null;
  redis: DetectedRedisRequirement | null;
  usesDockerfile: boolean;
}
