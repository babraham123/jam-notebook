import { print as subPrint, printErr as subPrintErr } from "../shared/utils";
import { JS_VAR_REGEX } from "../shared/constants";
import { metrics } from "./tokens";
import { Code, Endpoint } from "../shared/types";

const TITLE_REGEX = /\/\/\s*title:\s*(.*)/;

export function printErr(msg: any) {
  subPrintErr("widget:", msg);
}

export function print(msg: any) {
  subPrint("widget:", msg);
}

interface FrameIO {
  inputs: Endpoint[];
  libraries: Code[];
  outputs: Endpoint[];
}

const TEXT_NODE_TYPES = [
  "TEXT",
  "STICKY",
  "SHAPE_WITH_TEXT",
  "CODE_BLOCK",
  "LINK_UNFURL",
  "EMBED",
];

function setTextValue(nodeId: string, value: string) {
  const node = figma.getNodeById(nodeId);
  switch (node?.type) {
    case "TEXT":
      node.characters = value;
      break;
    case "STICKY":
      node.text.characters = value;
      break;
    case "SHAPE_WITH_TEXT":
      node.text.characters = value;
      break;
    case "CODE_BLOCK":
      node.code = value;
      break;
    case "LINK_UNFURL":
      node.linkUnfurlData.url = value;
      break;
    case "EMBED":
      node.embedData.srcUrl = value;
      break;
  }
}

function getGroup(blockId: string): GroupNode | undefined {
  let group: GroupNode | undefined;
  if (!blockId) {
    return undefined;
  }
  figma.currentPage
    .findAllWithCriteria({ types: ["GROUP"] })
    .forEach((node) => {
      if (node.getPluginData("blockId") !== blockId) {
        group = node as GroupNode;
      }
    });
  return group;
}

export function adjustFrames(blockId: string) {
  if (!blockId) {
    return;
  }
  const block = figma.getNodeById(blockId) as CodeBlockNode;
  if (!block) {
    return;
  }
  let group = getGroup(blockId);
  if (!group) {
    group = figma.group([block], figma.currentPage);
    group.setPluginData("blockId", blockId);
  }

  const decls = new Set<number>();
  block.code.split("\n").forEach((line, i) => {
    if (JS_VAR_REGEX.test(line)) {
      decls.add(i);
    }
  });

  const existing = new Set<number>();
  group.children.forEach((child) => {
    if (child.type !== "FRAME") {
      return;
    }
    const frame = child as FrameNode;
    const str = frame.getPluginData("lineNum");
    if (!str) {
      return;
    }
    const lineNum = parseInt(str);
    if (!decls.has(lineNum)) {
      frame.remove();
      return;
    }
    existing.add(lineNum);
    if (frame.width !== block.width - 2 * metrics.textOffset) {
      frame.resize(block.width - 2 * metrics.textOffset, metrics.textHeight);
    }
  });

  const newDecls = new Set([...decls].filter((i) => !existing.has(i)));
  newDecls.forEach((lineNum) => {
    const frame = figma.createFrame();
    frame.x = block.x + metrics.textOffset;
    frame.y = block.y + (lineNum + 1) * metrics.textHeight;
    frame.resize(block.width - 2 * metrics.textOffset, metrics.textHeight);
    frame.setPluginData("lineNum", lineNum.toString());
    frame.setPluginData("blockId", block.id);
    // frame.visible = false;
    frame.fills = [];
    group?.appendChild(frame);
  });
}

// adjustFrames must be called before this
export async function processFrames(blockId: string): Promise<FrameIO> {
  const inputs: Endpoint[] = [];
  const outputs: Endpoint[] = [];
  let libraries: Code[] = [];
  if (!blockId) {
    return { inputs, libraries, outputs };
  }
  const block = figma.getNodeById(blockId) as CodeBlockNode;
  if (!block) {
    return { inputs, libraries, outputs };
  }
  libraries = getLibraries(block);

  const group = getGroup(blockId);
  if (!group) {
    return { inputs, libraries, outputs };
  }
  libraries = libraries.concat(getLibraries(block));

  // Connectors attached to frames
  for (const child of group.children) {
    if (child.type !== "FRAME") {
      continue;
    }
    const frame = child as FrameNode;
    const lineNum = parseInt(frame.getPluginData("lineNum"));

    for (const cNode of frame.attachedConnectors) {
      const start = cNode.connectorStart;
      const end = cNode.connectorEnd;
      if (!("endpointNodeId" in start)) {
        continue;
      }
      if (start.endpointNodeId === frame.id) {
        const output: Endpoint = {
          sourceId: blockId,
          lineNum,
        };
        if ("endpointNodeId" in end) {
          // update
          const node = figma.getNodeById(end.endpointNodeId) as SceneNode;
          if (node && TEXT_NODE_TYPES.indexOf(node.type) > -1) {
            output.shouldReturn = true;
          }
        } else {
          // create
          output.shouldReturn = true;
        }
        outputs.push(output);
        continue;
      }
      if ("endpointNodeId" in end && end.endpointNodeId === frame.id) {
        const node = figma.getNodeById(start.endpointNodeId) as SceneNode;
        if (!node) {
          continue;
        }
        if (node.type === "FRAME") {
          const sourceId = node.getPluginData("blockId");
          const inputLineNum = node.getPluginData("lineNum");
          if (sourceId && inputLineNum) {
            inputs.push({
              sourceId,
              lineNum: parseInt(inputLineNum),
              destLineNum: lineNum,
            });
            continue;
          }
        }
        const data = await node.exportAsync({
          format: "JSON_REST_V1",
        });
        inputs.push({
          sourceId: node.id,
          lineNum: 0,
          destLineNum: lineNum,
          node: data as any,
        });
      }
      printErr("Unknown connector");
    }
  }

  return { inputs, libraries, outputs };
}

export function getLibraries(node: SceneNode): Code[] {
  const libraries: Code[] = [];
  for (const cNode of node.attachedConnectors) {
    const start = cNode.connectorStart;
    const end = cNode.connectorEnd;
    if (
      !("endpointNodeId" in start) ||
      !("endpointNodeId" in end) ||
      end.endpointNodeId !== node.id
    ) {
      continue;
    }
    const srcNode = figma.getNodeById(start.endpointNodeId) as SceneNode;
    if (!srcNode) {
      continue;
    }
    if (srcNode.type === "CODE_BLOCK") {
      libraries.push({
        code: srcNode.code,
        language: `${srcNode.codeLanguage}`.toLowerCase(),
      });
    }
  }
  return libraries;
}

export function setOutputs(blockId: string, outputs?: Endpoint[]) {
  if (!outputs) {
    return;
  }
  const block = figma.getNodeById(blockId) as CodeBlockNode;
  if (!block) {
    return;
  }
  const group = getGroup(blockId);
  if (!group) {
    return;
  }

  // Connectors attached to frames
  for (const child of group.children) {
    if (child.type !== "FRAME") {
      continue;
    }
    const frame = child as FrameNode;
    const lineNum = parseInt(frame.getPluginData("lineNum"));
    let xOffset = block.x;

    for (const output of outputs) {
      if (!output.shouldReturn) {
        continue;
      }
      const value = JSON.stringify(output.node);

      let end: ConnectorEndpoint | undefined;
      let connector: ConnectorNode | undefined;
      for (const cNode of frame.attachedConnectors) {
        const start = cNode.connectorStart;
        end = cNode.connectorEnd;
        if (!("endpointNodeId" in start) || start.endpointNodeId !== frame.id) {
          continue;
        }
        if (output.lineNum === lineNum) {
          connector = cNode;
          break;
        }
      }
      if (!connector || !end) {
        continue;
      }
      if ("endpointNodeId" in end) {
        setTextValue(end.endpointNodeId, value);
      } else {
        const node = figma.createText();
        node.characters = value;
        node.x = xOffset + metrics.resultSpacing;
        node.y = frame.y;
        // node.resize(metrics.textBoxWidth, metrics.textBoxWidth);
        xOffset = node.x + node.width;
        // node.fills = [];
        figma.currentPage.appendChild(node);
        //figma.connect(node, cNode, figma.currentPage);
        const newEnd: ConnectorEndpointEndpointNodeIdAndMagnet = {
          endpointNodeId: node.id,
          magnet: "AUTO",
        };
        connector.connectorEnd = newEnd;
      }
    }
  }
}

export function extractTitle(code: string): string {
  const matches = code.match(TITLE_REGEX);
  if (!matches || matches.length < 2) {
    return "Jam Notebook";
  }
  return matches[1];
}

export async function addCodeBlock(
  nodeId: string,
  code: string,
  lang: string
): Promise<void> {
  if (!nodeId) {
    return;
  }
  const selection = figma.getNodeById(nodeId) as SceneNode;
  if (!selection) {
    return;
  }
  await loadFonts();
  const block = figma.createCodeBlock();
  block.code = code;
  block.codeLanguage = lang.toUpperCase() as CodeBlockNode["codeLanguage"];
  block.x = selection.x + selection.width + metrics.resultSpacing;
  block.y = selection.y;
  figma.currentPage.appendChild(block);
  figma.viewport.scrollAndZoomIntoView([selection, block]);
  figma.currentPage.selection = [block];
}

export function findWidgetsOfTypeWithWidgetId<T extends NodeType>(
  type: T,
  widgetId: string
): ({ type: T } & SceneNode)[] {
  return figma.currentPage
    .findAllWithCriteria({ types: [type] })
    .filter((node) => {
      if (node.getPluginData("widgetId") !== widgetId) {
        return false;
      }
      return true;
    });
}

export function getPrevCodeBlock(
  widgetId: string,
  position: [number, number]
): CodeBlockNode | null {
  // Try to find our code block first by the plugin data widgetId, then by the
  // relative position.
  const prevCodeBlocks = findWidgetsOfTypeWithWidgetId(
    "CODE_BLOCK",
    widgetId
  ).filter((node) => node.x === position[0] && node.y === position[1]);

  if (prevCodeBlocks.length > 0) {
    return prevCodeBlocks[0];
  }

  return null;
}

export function insertCodeBlock(
  widgetId: string,
  position: [number, number],
  code: string
) {
  const codeBlock = figma.createCodeBlock();
  codeBlock.code = code;
  codeBlock.codeLanguage = "JSON";

  codeBlock.x = position[0];
  codeBlock.y = position[1];
  figma.currentPage.appendChild(codeBlock);

  return codeBlock;
}

export function getPrevFrame(
  widgetId: string,
  position: [number, number]
): FrameNode | null {
  // Try to find our code block first by the plugin data widgetId, then by the
  // relative position.
  const prevFrames = findWidgetsOfTypeWithWidgetId("FRAME", widgetId).filter(
    (node) => node.x === position[0] && node.y === position[1]
  );

  if (prevFrames.length > 0) {
    return prevFrames[0];
  }

  return null;
}

export function insertFrame(
  widgetId: string,
  position: [number, number],
  node: SceneNode
) {
  const frame = figma.createFrame();

  frame.cornerRadius = metrics.cornerRadius;
  frame.x = position[0];
  frame.y = position[1];

  frame.resize(
    node.width + 2 * metrics.framePadding,
    node.height + 2 * metrics.framePadding
  );

  node.relativeTransform = [
    [1, 0, metrics.framePadding],
    [0, 1, metrics.framePadding],
  ];

  frame.appendChild(node);
  figma.currentPage.appendChild(frame);

  return frame;
}

export type NamedCanvasNodeImports = Record<
  string,
  { code: string; node: SceneNode }
>;

export function getNamedNodeModules(): NamedCanvasNodeImports {
  const modules: NamedCanvasNodeImports = {};
  const nodes = figma.currentPage.findAllWithCriteria({ types: ["WIDGET"] });

  for (const node of nodes) {
    // We can't read the synced state if it's not ours!
    const { code, naming, toggleNaming } = node.widgetSyncedState;
    if (!toggleNaming || !naming) {
      continue;
    }

    modules[naming] = { code, node };
  }

  return modules;
}

export async function parseNode(node: SceneNode): Promise<Object> {
  return await node.exportAsync({
    format: "JSON_REST_V1",
  });
}

export function serializeNode(
  node: BaseNode,
  recursive: boolean = false,
  parent: boolean = false
): any {
  const data: any = {
    id: node.id,
    type: node.type,
  };

  if (!recursive && node.parent) {
    data.parent = serializeNode(node.parent, true, true);
  }

  if (!parent) {
    if ("children" in node) {
      data.children = [];
      for (const child of node.children) {
        data.children.push(serializeNode(child, true));
      }
    }

    if ("stuckNodes" in node) {
      data.stuckNodes = [];
      for (const stuckNode of node.stuckNodes) {
        data.stuckNodes.push(serializeNode(stuckNode, true));
      }
    }
  }

  if ("name" in node) {
    data.name = node.name;
  }

  return data;
}

// TODO: Support MEDIA (png, gif) and FRAME (svg) output nodes
// createImage -> createGif, createNodeFromSvg

export async function loadFonts() {
  const styles = ["Medium", "Medium Italic", "Regular", "Italic"];
  for (const style of styles) {
    await figma.loadFontAsync({ family: "Source Code Pro", style });
  }
}

// export function getFileId(): string {
//   const found = document.location.pathname.match(FILE_ID_REGEX);
//   if (!found || !found[0]) {
//     return "0";
//   }
//   return found[0];
// }
