type ApiLogEntry = {
  stream: "stdout" | "stderr";
  line: string;
  timestamp: number;
};
type LogForwarder = (entry: ApiLogEntry) => void;

type Empty = undefined | null;

export type { ApiLogEntry, LogForwarder, Empty };
