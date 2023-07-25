// Used by both widget and iframe modules

export interface ErrorLike {
  name: string;
  stack: string;
  message: string;
}

// export type Language = "typescript" | "javascript" | "python";

export interface Code {
  language: string;
  code: string;
}

export interface Endpoint {
  lineNum: number;
  sourceId: string;
  destLineNum?: number;
  node?: any;
  shouldReturn?: boolean;
}

export interface NodeQuery {
  selector: string;
  id?: string;
}

export type StatusType = "SUCCESS" | "FAILURE";

export type CommandType = "INITIATE" | "RUN" | "FORMAT" | "QUERY" | "CREATE";

export interface IFrameMessage {
  type: CommandType;
  status?: StatusType;
  code?: Code;
  inputs?: Endpoint[];
  libraries?: Code[];
  outputs?: Endpoint[];
  widgetId?: string;
  nodeQuery?: NodeQuery;
  nodes?: any[];
  error?: ErrorLike;
  debug?: string;
}
