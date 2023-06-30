import { Obj, Result } from "../../shared/types";

export function getInputs(widgetId: string): Obj[] {
  const selection = figma.getNodeById(widgetId);
  if (!selection || selection.type !== "WIDGET") {
    return [];
  }

  // Search ConnectorNodes
}

export function setResult(res: Result) {
  // Write to shared plugin data
}

export async function showResult(
  widgetId: string,
  code: string,
  type: CodeTypes
) {
  const selection = figma.getNodeById(widgetId);
  if (!selection || selection.type !== "WIDGET") {
    return;
  }

  const newX = selection.x + selection.width + metrics.resultSpacing;
  const newY = selection.y;
  const position: [number, number] = [newX, newY];

  const prevCodeBlock = getPrevCodeBlock(widgetId, position);
  const prevFrame = getPrevFrame(widgetId, position);

  if (type !== "PLAINTEXT" && type !== "JSON") {
    prevCodeBlock?.remove();
  }

  // It's simpler just to remove the previous SVG frame and replace it with a new one.
  prevFrame?.remove();

  // Mark new node to add plugin data to.
  let newNode: SceneNode | null = null;

  switch (type) {
    case "PLAINTEXT":
    case "JSON":
      // Load font for codeblocks (it'll yell otherwise)
      await figma.loadFontAsync({ family: "Source Code Pro", style: "Medium" });

      if (prevCodeBlock) {
        prevCodeBlock.code = code;
        // TODO: Once a plaintext syntax coloring is added, add it here.
        prevCodeBlock.codeLanguage = type === "JSON" ? "JSON" : "TYPESCRIPT";
      } else {
        newNode = insertCodeBlock(widgetId, position, code);
      }
      break;
    case "SVG":
      newNode = insertFrame(widgetId, position, figma.createNodeFromSvg(code));
      break;
  }

  // If the newNode isn't null, set plugin data to it for 'findWidgetsOfTypeWithWidgetId'.
  newNode?.setPluginData("widgetId", widgetId);
}
