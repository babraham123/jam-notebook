// Used by both widget and iframe modules

export type ObjType =
  | "TEXT"
  | "JSON"
  | "CSV"
  | "SVG"
  | "BINARY"
  | "ERROR"
  | "UNDEFINED";
// BINARY = base64 encoded
// ERROR = formatted msg and stack

export interface Obj {
  type: ObjType;
  data: string;
}

export interface ErrorLike {
  name: string;
  stack: string;
  message: string;
}

export interface Result {
  output: Obj;
  inputsHash: string;
  codeHash: string;
}

export type Language = "javascript" | "python" | "wasm";

export interface Code {
  language: Language;
  code: string;
  testCode: string;
}

export interface NodeQuery {
  selector: string;
  id?: string;
}

export interface Dimension {
  height: number;
  width: number;
}

export interface AppState {
  title: string;
  codeWindow: Dimension;
  previewWindow: Dimension;
}

export type StatusType = "SUCCESS" | "FAILURE";

export type CommandType =
  | "INITIATE"
  | "SAVE"
  | "RUN"
  | "FORMAT"
  | "TEST"
  | "QUERY"
  | "CLOSE";
// future: 'INTROSPECT'

export interface IFrameMessage {
  type: CommandType;
  status?: StatusType;
  code?: Code;
  inputs?: Obj[];
  result?: Result;
  appState?: AppState;
  nodeQuery?: NodeQuery;
  nodes?: any[];
  debug?: string;
}
