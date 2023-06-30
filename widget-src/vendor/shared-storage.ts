import { Obj, Result } from "../../shared/types";

export function getInputs(widgetId: string): Obj[] {
  const selection = figma.getNodeById(widgetId);
  if (!selection || selection.type !== "WIDGET") {
    return [];
  }

  // TODO: Search ConnectorNodes
  return [];
}

export function setResult(res: Result) {
  // TODO: Write to shared plugin data
}