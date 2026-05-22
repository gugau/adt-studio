export interface ApiLogEntry {
  stream: "stdout" | "stderr";
  line: string;
  timestamp: number;
}

export type LogForwarder = (entry: ApiLogEntry) => void;
