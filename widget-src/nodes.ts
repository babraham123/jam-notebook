import { anyToStr } from "../shared/utils";
import { NULL_ID, NAMESPACE } from "../shared/constants";
import { metrics } from "./tokens";

export const TEXT_NODE_TYPES = [
  "TEXT",
  "STICKY",
  "SHAPE_WITH_TEXT",
  "CODE_BLOCK",
  "LINK_UNFURL",
  "EMBED",
  "TABLE",
];

// Formats data into a table if possible, otherwise undefined.
function formatTableData(data: any): any[][] | undefined {
  const tableData = [];
  if (Array.isArray(data)) {
    for (const row of data) {
      if (Array.isArray(row)) {
        tableData.push(row.map(anyToStr));
      } else {
        // TODO: support list of dicts
        return undefined;
      }
    }
  } else if (data instanceof Object) {
    const tableData = [];
    const colKeys = Object.getOwnPropertyNames(data);
    tableData.push(colKeys);
    let numRows = 1;
    for (let i = 0; i < colKeys.length; i++) {
      const col = data[colKeys[i]];
      if (!Array.isArray(col)) {
        // TODO: support dict of dicts
        return undefined;
      }
      if (i === 0) {
        for (const row of col) {
          tableData.push([anyToStr(row)]);
        }
        numRows = col.length + 1;
      } else {
        // truncate or pad rows on mismatch sizes
        for (let j = 1; j < numRows; j++) {
          if (j - 1 < col.length) {
            tableData[j].push(anyToStr(col[j - 1]));
          } else {
            tableData[j].push("");
          }
        }
      }
    }
  } else {
    return undefined;
  }

  if (tableData.length === 0) {
    return undefined;
  }
  if (tableData[0].length === 0) {
    return undefined;
  }
  return tableData;
}

export async function setNodeValue(nodeId: string, data: any) {
  const node = figma.getNodeById(nodeId);
  const value = anyToStr(data);
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
      await loadFonts("Source Code Pro");
      node.code = value;
      if (typeof data === "object") {
        node.codeLanguage = "JSON";
      } else {
        node.codeLanguage = "PLAINTEXT";
      }
      break;
    case "LINK_UNFURL":
      node.linkUnfurlData.url = value;
      break;
    case "EMBED":
      node.embedData.srcUrl = value;
      break;
    case "TABLE":
      await loadFonts("Inter");
      const tableData = formatTableData(data);
      if (!tableData) {
        return;
      }
      // resize table
      const numRows = tableData.length;
      if (numRows === 0) {
        return;
      }
      for (let i = node.numRows; i < numRows; i++) {
        node.insertRow(0);
      }
      for (let i = numRows; i < node.numRows; i++) {
        node.removeRow(0);
      }
      const numCols = tableData[0].length;
      if (numCols === 0) {
        return;
      }
      for (let i = node.numColumns; i < numCols; i++) {
        node.insertColumn(0);
      }
      for (let i = numCols; i < node.numColumns; i++) {
        node.removeColumn(0);
      }
      // set table values
      for (let i = 0; i < numRows; i++) {
        for (let j = 0; j < numCols; j++) {
          const cell = node.cellAt(i, j);
          if (cell) {
            cell.text.characters = tableData[i][j];
          }
        }
      }
      break;
  }
}

export function getNodeValue(node: SceneNode): any {
  switch (node.type) {
    case "TEXT":
      return node.characters;
    case "STICKY":
      return node.text.characters;
    case "SHAPE_WITH_TEXT":
      return node.text.characters;
    case "CODE_BLOCK":
      return {
        code: node.code,
        language: getLang(node),
      };
    case "LINK_UNFURL":
      return node.linkUnfurlData.url;
    case "EMBED":
      return node.embedData.srcUrl;
    case "TABLE":
      const tableData = [];
      for (let i = 0; i < node.numRows; i++) {
        const tableRow = [];
        for (let j = 0; j < node.numColumns; j++) {
          const cell = node.cellAt(i, j);
          if (cell) {
            tableRow.push(cell.text.characters);
          }
        }
        tableData.push(tableRow);
      }
      return tableData;
    default:
      throw new Error(`Unsupported node type: ${node.type}`);
  }
}

export async function createDataNode(data: any): Promise<SceneNode> {
  await loadFonts("Inter");
  let tableData = formatTableData(data);
  if (tableData) {
    const numRows = tableData.length; // guaranteed to be > 0
    const numCols = tableData[0].length;
    const node = figma.createTable(numRows, numCols);
    for (let i = 0; i < numRows; i++) {
      for (let j = 0; j < numCols; j++) {
        const cell = node.cellAt(i, j);
        if (cell) {
          cell.text.characters = anyToStr(tableData[i][j]);
        }
      }
    }
    return node;
  }
  const node = figma.createText();
  node.characters = anyToStr(data);
  return node;
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
  await loadFonts("Source Code Pro");
  const block = figma.createCodeBlock();
  block.code = code;
  block.codeLanguage = lang.toUpperCase() as CodeBlockNode["codeLanguage"];
  block.x = selection.x + selection.width + metrics.resultSpacing;
  block.y = selection.y;
  figma.currentPage.appendChild(block);
  figma.viewport.scrollAndZoomIntoView([selection, block]);
  figma.currentPage.selection = [block];
}

export function findNodesOfTypeWithBlockId<T extends NodeType>(
  type: T,
  blockId?: string
): ({ type: T } & SceneNode)[] {
  if (!blockId) {
    return [];
  }
  return figma.currentPage
    .findAllWithCriteria({ types: [type] })
    .filter((node) => node.getSharedPluginData(NAMESPACE, "blockId") === blockId);
}

export async function exportNode(node: SceneNode): Promise<any> {
  const obj = await node.exportAsync({
    format: "JSON_REST_V1",
  });
  if ("document" in obj) {
    return obj.document;
  }
  return obj;
}

// TODO: Support MEDIA (png, gif) and FRAME (svg) output nodes
// createImage -> createGif, createNodeFromSvg

export async function loadFonts(family: string) {
  const styles = ["Medium", "Medium Italic", "Regular", "Italic", "Bold"];
  for (const style of styles) {
    await figma.loadFontAsync({ family, style });
  }
}

export function getLang(block: CodeBlockNode): string {
  return `${block.codeLanguage}`.toLowerCase();
}

export function isConnected(endpoint: ConnectorEndpoint): boolean {
  if (!("endpointNodeId" in endpoint)) {
    return false;
  }
  if (endpoint.endpointNodeId === NULL_ID) {
    return false;
  }
  if ("magnet" in endpoint && endpoint.magnet === "NONE") {
    return false;
  }
  if (!figma.getNodeById(endpoint.endpointNodeId)) {
    return false;
  }
  return true;
}
