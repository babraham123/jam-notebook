// This widget will open an Iframe window with buttons to show a toast message and close the window.

const { widget } = figma;
const {
  AutoLayout,
  Rectangle,
  Text,
  useEffect,
  usePropertyMenu,
  useStickable,
  useSyncedState,
  useWidgetId,
} = widget;

import * as FigmaSelector from "./vendor/figma-selector";
import {
  print,
  printErr,
  extractTitle,
  adjustAndProcessFrames,
  addCodeBlock,
  parseNode,
  removeOutputs,
} from "./utils";
import { metrics, colors, badges } from "./tokens";
import { Button } from "./components/Button";
import { IFrameMessage, CommandType } from "../shared/types";
import { DEFAULT_CODE, DEFAULT_TITLE } from "../shared/constants";

type ResultStatus = "EMPTY" | "RUNNING" | "FORMATTING" | "SUCCESS" | "ERROR";

async function ignoreHandler(
  msg: IFrameMessage
): Promise<IFrameMessage | undefined> {
  console.log(JSON.stringify(msg));
  return undefined;
}

function Widget() {
  const widgetId = useWidgetId();

  const [title, setTitle] = useSyncedState<string>("title", DEFAULT_TITLE);
  const [codeBlockId, setCodeBlockId] = useSyncedState<string>(
    "codeBlockId",
    ""
  );
  // const [inputNodeIds, setInputNodeIds] = useSyncedState<string[]>("inputNodeIds", []);
  const [resultStatus, setResultStatus] = useSyncedState<ResultStatus>(
    "resultStatus",
    "EMPTY"
  );

  useStickable(() => {
    const node = figma.getNodeById(widgetId);
    if (
      !node ||
      !("stuckTo" in node) ||
      !node.stuckTo ||
      node.stuckTo.type !== "CODE_BLOCK"
    ) {
      setCodeBlockId("");
      setTitle(DEFAULT_TITLE);
      return;
    }
    setCodeBlockId(node.stuckTo.id);
    setTitle(extractTitle(node.stuckTo.code));
  });

  const HANDLERS: Record<
    CommandType,
    (msg: IFrameMessage) => Promise<IFrameMessage | undefined>
  > = {
    INITIATE: isReadyHandler,
    RUN: runHandler,
    FORMAT: formatHandler,
    QUERY: queryHandler,
    CLEAR: clearHandler,
    CREATE: ignoreHandler,
  };

  useEffect(() => {
    const handleMsg = async (event: any, props: OnMessageProperties) => {
      if (!event?.data?.type) {
        return;
      }
      const msg = event.data as IFrameMessage;
      if (msg.debug) {
        print(`msg ${msg.type}, origin: ${props.origin}, debug: ${msg.debug}`);
      }
      const resp = await HANDLERS[msg.type as CommandType](msg);
      if (resp) {
        figma.ui.postMessage(resp);
      }
    };
    figma.ui.on("message", handleMsg);
    return () => figma.ui.off("message", handleMsg);
  });

  async function isReadyHandler(
    msg: IFrameMessage
  ): Promise<IFrameMessage | undefined> {
    if (codeBlockId === "") {
      closeIFrame();
      figma.notify("Please attached to a code block.");
      return undefined;
    }
    const block = figma.getNodeById(codeBlockId) as CodeBlockNode;
    if (!block) {
      closeIFrame();
      figma.notify("Please attached to a code block.");
      return undefined;
    }

    setTitle(extractTitle(block.code));
    if (resultStatus === "FORMATTING") {
      return {
        type: "FORMAT",
        code: {
          language: `${block.codeLanguage}`.toLowerCase(),
          code: block.code,
        },
      };
    } else if (resultStatus === "RUNNING") {
      const io = await adjustAndProcessFrames(codeBlockId);
      return {
        type: "RUN",
        code: {
          language: `${block.codeLanguage}`.toLowerCase(),
          code: block.code,
        },
        inputs: io.inputs,
        outputs: io.outputs,
      };
    }
    closeIFrame();
    printErr(`Unexpected result status: ${resultStatus}`);
    return undefined;
  }

  async function formatHandler(
    msg: IFrameMessage
  ): Promise<IFrameMessage | undefined> {
    if (msg?.code && codeBlockId !== "") {
      const block = figma.getNodeById(codeBlockId) as CodeBlockNode;
      if (block) {
        block.code = msg.code.code;
      }
    }
    return undefined;
  }

  async function runHandler(
    msg: IFrameMessage
  ): Promise<IFrameMessage | undefined> {
    if (msg?.status) {
      if (msg.status === "SUCCESS") {
        setResultStatus("SUCCESS");
      } else {
        setResultStatus("ERROR");
        if (msg.error) {
          figma.notify(msg.error.name + ": " + msg.error.message);
        }
      }
    }
    return undefined;
  }

  async function queryHandler(
    msg: IFrameMessage
  ): Promise<IFrameMessage | undefined> {
    if (msg?.nodes) {
      printErr(`Incorrectly sent nodes from iframe: ${msg.nodes.length}`);
    }
    let serializedNodes: any[] = [];
    if (msg?.nodeQuery) {
      const { selector, id } = msg.nodeQuery;
      const rootNode = !id
        ? figma.currentPage
        : figma.getNodeById(id) ?? undefined;
      const nodes = FigmaSelector.parse(selector, rootNode);
      serializedNodes = nodes.map(async (node) => await parseNode(node));
    }
    return {
      type: "QUERY",
      nodeQuery: msg.nodeQuery,
      nodes: serializedNodes,
    };
  }

  async function closeHandler(
    msg: IFrameMessage
  ): Promise<IFrameMessage | undefined> {
    closeIFrame();
    return undefined;
  }

  async function clearHandler(
    msg: IFrameMessage
  ): Promise<IFrameMessage | undefined> {
    if (codeBlockId === "") {
      return undefined;
    }
    removeOutputs(codeBlockId);
    return undefined;
  }

  function closeIFrame(): void {
    figma.ui.close();
    figma.closePlugin();
    if (resultStatus === "RUNNING" || resultStatus === "FORMATTING") {
      // TODO: revert to last result
      setResultStatus("EMPTY");
    }
  }

  async function handlePlayBtn(): Promise<void> {
    setResultStatus("RUNNING");
    await startIFrame();
  }

  async function handleFormatBtn(): Promise<void> {
    setResultStatus("FORMATTING");
    await startIFrame();
  }

  async function handleAddBlockBtn(): Promise<void> {
    await addCodeBlock(widgetId, DEFAULT_CODE.code, DEFAULT_CODE.language);
  }

  function startIFrame(): Promise<void> {
    return new Promise((resolve) => {
      figma.showUI(__html__, {
        visible: false,
        title: "Code runner",
      });
    });
  }

  usePropertyMenu(
    [
      {
        itemType: "action",
        tooltip: "Play",
        propertyName: "play",
      },
      {
        itemType: "action",
        tooltip: "Format",
        propertyName: "format",
      },
      {
        itemType: "action",
        tooltip: "+",
        propertyName: "addBlock",
      },
    ],
    ({ propertyName, propertyValue }) => {
      if (propertyName === "play") {
        if (resultStatus !== "RUNNING") {
          return handlePlayBtn();
        }
      } else if (propertyName === "format") {
        return handleFormatBtn();
      } else if (propertyName === "addBlock") {
        return handleAddBlockBtn();
      }
    }
  );

  return (
    <AutoLayout
      direction="vertical"
      cornerRadius={metrics.cornerRadius}
      fill={colors.bg}
      stroke={colors.stroke}
      strokeWidth={1}
    >
      <Text fontSize={32} horizontalAlignText="center">
        {title}
      </Text>
      <Rectangle width="fill-parent" height={1} stroke={colors.stroke} />
      <AutoLayout
        direction="horizontal"
        padding={metrics.detailPadding}
        width="fill-parent"
        verticalAlignItems="center"
        spacing={metrics.padding}
      >
        {resultStatus === "RUNNING" ? (
          <Button name="pause" onClick={closeIFrame} enabled={true}></Button>
        ) : (
          <Button
            name="play"
            onClick={handlePlayBtn}
            enabled={resultStatus !== "FORMATTING"}
          ></Button>
        )}
        {resultStatus === "FORMATTING" ? (
          <Button name="pause" onClick={closeIFrame} enabled={true}></Button>
        ) : (
          <Button
            name="format"
            onClick={handleFormatBtn}
            enabled={resultStatus !== "RUNNING"}
          ></Button>
        )}
        {resultStatus !== "EMPTY" && (
          <AutoLayout
            padding={metrics.buttonPadding}
            fill={badges[resultStatus].fill}
            cornerRadius={metrics.cornerRadius}
          >
            <Text fill={badges[resultStatus].textFill}>{resultStatus}</Text>
          </AutoLayout>
        )}
      </AutoLayout>
    </AutoLayout>
  );
}

widget.register(Widget);
