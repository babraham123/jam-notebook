import { print as subPrint, printErr as subPrintErr } from '../shared/utils';
import { metrics } from "./tokens";

export function printErr(msg: string) {
  subPrintErr(`widget: ${msg}`)
}

export function print(msg: string) {
  subPrint(`widget: ${msg}`)
}

async function addAdjacentCodeNotebook(widgetId: string) {
  const selection = figma.getNodeById(widgetId);
  if (!selection || selection.type !== "WIDGET") {
    return;
  }

  const newX = selection.x + selection.width + metrics.resultSpacing;
  const newY = selection.y;

  const position: [number, number] = [newX, newY];
  let adjacentPosition: [number, number] = position;

  const prevCodeBlock = getPrevCodeBlock(widgetId, position);
  if (prevCodeBlock) {
    adjacentPosition = [
      prevCodeBlock.x + prevCodeBlock.width + metrics.resultSpacing,
      prevCodeBlock.y,
    ];
  } else {
    const prevFrame = getPrevFrame(widgetId, position);
    if (prevFrame) {
      adjacentPosition = [
        prevFrame.x + prevFrame.width + metrics.resultSpacing,
        prevFrame.y,
      ];
    }
  }

  const node = selection.cloneWidget({
    code: "",
    running: false,
    lastRanBy: "",
    toggleNaming: false,
    naming: "",
    usedModules: Object.create(null),
    usedByModules: Object.create(null),
  });

  node.relativeTransform = [
    [1, 0, adjacentPosition[0]],
    [0, 1, adjacentPosition[1]],
  ];

  figma.currentPage.appendChild(node);
  figma.viewport.scrollAndZoomIntoView([node]);
  figma.currentPage.selection = [node];
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

export function serializeNode(
  node: BaseNode,
  recursive: boolean = false,
  parent: boolean = false
): any {
  const data: any = {
    id: node.id,
    type: node.type,
  };

  if (!recursive) {
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
