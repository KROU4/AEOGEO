export type {
  EngineRun,
  EngineRunCreate as RunCreate,
  EngineRunProgress as RunProgress,
  Answer,
} from "./api";

export type RunStatus = import("./api").EngineRun["status"];
export type EngineName = string;
