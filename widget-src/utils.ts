import { print as subPrint, printErr as subPrintErr } from "../shared/utils";
import { metrics } from "./tokens";
import { Endpoint, Obj } from "../shared/types";

const TITLE_REGEX = /\/\/\s*title:\s*(.*)/;

export function printErr(msg: string) {
  subPrintErr(`widget: ${msg}`);
}

export function print(msg: string) {
  subPrint(`widget: ${msg}`);
}

interface FrameIO {
  inputs: Endpoint[];
  outputs: Endpoint[];
}

export async function adjustAndProcessFrames(nodeId: string): Promise<FrameIO> {
  const inputs: Endpoint[] = [];
  const outputs: Endpoint[] = [];
  const rootNode = figma.getNodeById(nodeId) as SceneNode;
  if (!rootNode) {
    return { inputs, outputs };
  }
  // const connectorNodes = rootNode.attachedConnectors;
  // for (const cNode of connectorNodes) {
  //   cNode.remove();
  // }

  const frames = figma.currentPage
    .findAllWithCriteria({ types: ["FRAME"] })
    .filter((node) => {
      if (node.getPluginData("parentId") !== nodeId) {
        return false;
      }
      return true;
    })
    .sort((a, b) => {
      return a.y - b.y;
    });
  let offset = 0;
  for (let i = 0; i < frames.length; i++) {
    const frame = frames[i];
    offset = metrics.textHeight * i;
    if (offset >= rootNode.height) {
      frame.remove();
      continue;
    }
    frame.y = rootNode.y + offset;
    frame.x = rootNode.x;
    if (frame.width !== rootNode.width) {
      frame.resize(rootNode.width, metrics.textHeight);
    }
    frame.setPluginData("lineNum", i.toString());

    const connectorNodes = frame.attachedConnectors;
    for (const cNode of connectorNodes) {
      const start = cNode.connectorStart;
      const end = cNode.connectorEnd;
      if (!("endpointNodeId" in start)) {
        frame.remove();
        continue;
      }
      if (start.endpointNodeId === frame.id) {
        outputs.push({
          sourceId: nodeId,
          lineNum: i,
        });
        continue;
      }
      if ("endpointNodeId" in end && end.endpointNodeId === frame.id) {
        const node = figma.getNodeById(start.endpointNodeId) as SceneNode;
        if (!node) {
          continue;
        }
        if (node.type === "FRAME") {
          const sourceId = node.getPluginData("parentId");
          const lineNum = node.getPluginData("lineNum");
          if (sourceId && lineNum) {
            inputs.push({
              sourceId,
              lineNum: parseInt(lineNum),
              destLineNum: i,
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
          destLineNum: i,
          node: data as any,
        });
      }
      // Unknown connector
    }
  }
  // add missing frames
  let j = frames.length;
  while (offset < rootNode.height) {
    const frame = figma.createFrame();
    frame.y = rootNode.y + offset;
    frame.x = rootNode.x;
    frame.resize(rootNode.width, metrics.textHeight);
    frame.setPluginData("lineNum", j.toString());
    frame.setPluginData("parentId", nodeId);
    figma.currentPage.appendChild(frame);
    offset += metrics.textHeight;
    j++;
  }
  
  return { inputs, outputs };
}

export function removeOutputs(nodeId: string) {
  const rootNode = figma.getNodeById(nodeId) as SceneNode;
  if (!rootNode) {
    return;
  }
  // const connectorNodes = rootNode.attachedConnectors;
  // for (const cNode of connectorNodes) {
  //   cNode.remove();
  // }
  const frames = figma.currentPage
    .findAllWithCriteria({ types: ["FRAME"] })
    .filter((node) => {
      if (node.getPluginData("parentId") !== nodeId) {
        return false;
      }
      return true;
    });
  for (const frame of frames) {
    const connectorNodes = frame.attachedConnectors;
    for (const cNode of connectorNodes) {
      const start = cNode.connectorStart;
      const end = cNode.connectorEnd;
      if (!("endpointNodeId" in start) || !("endpointNodeId" in end)) {
        continue;
      }
      if (start.endpointNodeId !== frame.id) {
        continue;
      }
      const node = figma.getNodeById(end.endpointNodeId) as SceneNode;
      node.remove();
    }
  }
}

export function extractTitle(code: string): string {
  const matches = code.match(TITLE_REGEX);
  if (!matches || matches.length < 2) {
    return "untitled";
  }
  return matches[1];
}

export async function addCodeBlock(
  widgetId: string,
  code: string,
  lang: string
): Promise<void> {
  const selection = figma.getNodeById(widgetId);
  if (!selection || selection.type !== "WIDGET") {
    return;
  }
  const newX = selection.x + selection.width + metrics.resultSpacing;
  const newY = selection.y;
  await figma.loadFontAsync({ family: "Source Code Pro", style: "Medium" });
  const block = figma.createCodeBlock();
  block.code = code;
  block.codeLanguage = lang.toUpperCase() as CodeBlockNode["codeLanguage"];
  figma.currentPage.appendChild(block);
  // figma.viewport.scrollAndZoomIntoView([block]);
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

function extractObjFromNode(node: BaseNode): Obj {
  switch (node.type) {
    case "WIDGET":
      return {
        type: "TEXT",
        data: `${figma.currentPage.id}_${node.id}`,
      };
    case "TEXT":
      return {
        type: "TEXT",
        data: (node as TextNode).characters,
      };
    case "SHAPE_WITH_TEXT":
      return {
        type: "TEXT",
        data: (node as ShapeWithTextNode).text.characters,
      };
    case "CODE_BLOCK":
      return {
        type: "TEXT",
        data: (node as CodeBlockNode).code,
      };
    case "LINK_UNFURL":
      return {
        type: "TEXT",
        data: (node as LinkUnfurlNode).linkUnfurlData.url,
      };
    case "EMBED":
      return {
        type: "TEXT",
        data: (node as EmbedNode).embedData.srcUrl,
      };
    case "MEDIA":
    // TODO: Export correct format
  }
  return {
    type: "UNDEFINED",
    data: "",
  };
}
