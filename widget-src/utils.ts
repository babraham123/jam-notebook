import {
  print as subPrint,
  printErr as subPrintErr,
  anyToStr,
} from "../shared/utils";
import { JS_VAR_REGEX, PY_VAR_REGEX } from "../shared/constants";
import { Code, Endpoint } from "../shared/types";
import { metrics } from "./tokens";
import {
  findNodesOfTypeWithBlockId,
  setNodeValue,
  exportNode,
  getNodeValue,
  getLang,
  isConnected,
  createDataNode,
  TEXT_NODE_TYPES,
} from "./nodes";

const TITLE_REGEX = /(?:\/\/|#)\s*title:\s*(.*)/;

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

function getGroup(blockId?: string): GroupNode | undefined {
  const groups = findNodesOfTypeWithBlockId("GROUP", blockId);
  return groups.length > 0 ? groups[0] : undefined;
}

export function adjustFrames(blockId: string, widgetId: string) {
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
  const language = getLang(block);
  block.code.split("\n").forEach((line, i) => {
    if (language === "javascript" && JS_VAR_REGEX.test(line)) {
      decls.add(i + 1);
    }
    if (language === "python" && PY_VAR_REGEX.test(line)) {
      decls.add(i + 1);
    }
  });

  const childIds = new Set<string>();
  group.children.forEach((child) => {
    if (child.type === "FRAME") {
      childIds.add(child.id);
    }
  });

  const existingDecls = new Set<number>();
  const frames = findNodesOfTypeWithBlockId("FRAME", blockId);
  frames.forEach((frame) => {
    const lineNum = parseInt(frame.getPluginData("lineNum"));
    if (!lineNum) {
      frame.remove();
      return;
    }
    if (!decls.has(lineNum)) {
      frame.remove();
      return;
    }
    if (!childIds.has(frame.id)) {
      group?.appendChild(frame);
    }
    existingDecls.add(lineNum);
    // In case code block was moved
    updateFrame(frame, block, lineNum);
  });

  const newDecls = new Set([...decls].filter((i) => !existingDecls.has(i)));
  newDecls.forEach((lineNum) => {
    const frame = figma.createFrame();
    frame.setPluginData("lineNum", lineNum.toString());
    frame.setPluginData("blockId", blockId);
    // frame.visible = false;
    frame.fills = [];
    updateFrame(frame, block, lineNum);
    group?.appendChild(frame);
  });
  // Keep these on top
  group.appendChild(block);
  const widget = figma.getNodeById(widgetId) as WidgetNode;
  if (widget) {
    group.appendChild(widget);
  }
}

function updateFrame(frame: FrameNode, block: CodeBlockNode, lineNum: number) {
  frame.resize(block.width - 2 * metrics.textOffset, metrics.textHeight);
  frame.x = block.x + metrics.textOffset;
  frame.y = block.y + lineNum * metrics.textHeight;
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
  if (group) {
    libraries = libraries.concat(getLibraries(group));
  }

  // Connectors attached to frames
  const frames = findNodesOfTypeWithBlockId("FRAME", blockId);
  for (const frame of frames) {
    const lineNum = parseInt(frame.getPluginData("lineNum"));
    if (!lineNum) {
      continue;
    }

    for (const cNode of frame.attachedConnectors) {
      const start = cNode.connectorStart;
      const end = cNode.connectorEnd;
      if (!("endpointNodeId" in start) || !isConnected(start)) {
        continue;
      }
      // output connector
      if (start.endpointNodeId === frame.id) {
        const output: Endpoint = {
          sourceId: blockId,
          srcLineNum: lineNum,
        };
        if ("endpointNodeId" in end && isConnected(end)) {
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
      // input connector
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
              srcLineNum: parseInt(inputLineNum),
              destLineNum: lineNum,
            });
            continue;
          } // else fall through
        }
        let value: any;
        if (TEXT_NODE_TYPES.indexOf(node.type) > -1) {
          value = getNodeValue(node);
        } else {
          value = await exportNode(node);
        }
        inputs.push({
          sourceId: node.id,
          srcLineNum: 0,
          destLineNum: lineNum,
          node: value,
        });
        continue;
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
      end.endpointNodeId !== node.id ||
      start.endpointNodeId === node.id
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

export async function setOutputs(blockId: string, outputs?: Endpoint[]) {
  if (!outputs) {
    return;
  }
  const block = figma.getNodeById(blockId) as CodeBlockNode;
  if (!block) {
    return;
  }

  // Connectors attached to frames
  const frames = findNodesOfTypeWithBlockId("FRAME", blockId);
  for (const frame of frames) {
    const lineNum = parseInt(frame.getPluginData("lineNum"));

    for (const output of outputs) {
      if (!output.shouldReturn) {
        continue;
      }
      if (output.srcLineNum !== lineNum) {
        continue;
      }

      for (const cNode of frame.attachedConnectors) {
        const start = cNode.connectorStart;
        const end = cNode.connectorEnd;
        if (!("endpointNodeId" in start) || start.endpointNodeId !== frame.id) {
          continue;
        }
        // Write output value
        if ("endpointNodeId" in end && isConnected(end)) {
          await setNodeValue(end.endpointNodeId, output.node);
        } else {
          const node = await createDataNode(output.node);
          if ("position" in end) {
            node.x = end.position.x;
            node.y = end.position.y - node.height / 2;
          } else {
            node.x = block.x + metrics.resultSpacing;
            node.y = frame.y;
          }
          // node.resize(metrics.textBoxWidth, metrics.textBoxWidth);
          // node.fills = [];
          figma.currentPage.appendChild(node);
          // figma.connect(node, cNode, figma.currentPage);
          const newEnd: ConnectorEndpointEndpointNodeIdAndMagnet = {
            endpointNodeId: node.id,
            magnet: "LEFT",
          };
          cNode.connectorEnd = newEnd;
        }
      }
    }
  }
}

export function extractTitle(code: string): string {
  const matches = code.match(TITLE_REGEX);
  if (!matches || matches.length < 2) {
    return "Jam Notebook";
  }
  const title = matches[1];
  if (title.length > 25) {
    return title.substring(0, 25) + "...";
  }
  return title;
}

export type NotebookNodes = Record<string, { title: string; node: SceneNode }>;

export function getNotebookNodes(): NotebookNodes {
  const modules: NotebookNodes = {};
  const nodes = figma.currentPage.findAllWithCriteria({ types: ["WIDGET"] });

  for (const node of nodes) {
    // We can't read the synced state if it's not ours!
    const { title, codeBlockId } = node.widgetSyncedState;
    if (!title || !codeBlockId) {
      continue;
    }
    modules[codeBlockId] = { title, node };
  }
  return modules;
}

export async function doAfter(f: () => void, delayMs: number): Promise<void> {
  await new Promise<void>((resolve) => {
    setTimeout(() => {
      f();
      resolve();
    }, delayMs);
  });
}
