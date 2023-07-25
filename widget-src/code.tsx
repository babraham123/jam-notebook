// This widget will open an Iframe window with buttons to show a toast message and close the window.

const { widget } = figma;
const {
  AutoLayout,
  Rectangle,
  SVG,
  Text,
  useEffect,
  usePropertyMenu,
  useStickable,
  useSyncedState,
  useWidgetId,
} = widget;

import * as FigmaSelector from "./vendor/figma-selector";
import {
  addCodeBlock,
  adjustFrames,
  extractTitle,
  loadFonts,
  parseNode,
  print,
  printErr,
  processFrames,
  setOutputs,
} from "./utils";
import { metrics, colors, badges } from "./tokens";
import { Button } from "./components/Button";
import { IFrameMessage, CommandType } from "../shared/types";
import {
  DEFAULT_CODE,
  DEFAULT_TITLE,
  IFRAME_URL,
  INFO_URL,
} from "../shared/constants";
import { icons } from "../shared/icons";

type ResultStatus = "EMPTY" | "RUNNING" | "FORMATTING" | "SUCCESS" | "ERROR";

async function ignoreHandler(
  msg: IFrameMessage
): Promise<IFrameMessage | undefined> {
  printErr(msg);
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
    if (node && "stuckTo" in node && node.stuckTo) {
      let group: GroupNode | undefined;
      if (
        node.stuckTo.type === "FRAME" &&
        node.stuckTo.parent?.type === "GROUP"
      ) {
        group = node.stuckTo.parent;
      }
      if (node.stuckTo.type === "GROUP") {
        group = node.stuckTo;
      }
      if (group) {
        const block = figma.getNodeById(group.getPluginData("blockId"));
        if (block && block.type === "CODE_BLOCK") {
          setCodeBlockId(block.id);
          setTitle(extractTitle(block.code));
          adjustFrames(block.id);
          return;
        }
      }
      if (node.stuckTo.type === "CODE_BLOCK") {
        setCodeBlockId(node.stuckTo.id);
        setTitle(extractTitle(node.stuckTo.code));
        adjustFrames(node.stuckTo.id);
        return;
      }
    }
    setCodeBlockId("");
    setTitle(DEFAULT_TITLE);
  });

  const HANDLERS: Record<
    CommandType,
    (msg: IFrameMessage) => Promise<IFrameMessage | undefined>
  > = {
    INITIATE: isReadyHandler,
    RUN: runHandler,
    FORMAT: formatHandler,
    QUERY: queryHandler,
    CREATE: ignoreHandler,
  };

  useEffect(() => {
    const handleMsg = async (data: any, props: OnMessageProperties) => {
      if (!data?.type || Object.keys(HANDLERS).indexOf(data.type) < 0) {
        return;
      }
      const msg = data as IFrameMessage;
      if (msg.debug) {
        print(`msg ${msg.type}, origin: ${props.origin}, debug: ${msg.debug}`);
      }
      const resp = await HANDLERS[msg.type as CommandType](msg);
      if (resp) {
        figma.ui.postMessage(resp, { origin: IFRAME_URL });
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
      // removeOutputs(codeBlockId);
      adjustFrames(codeBlockId);
      const io = await processFrames(codeBlockId);
      return {
        type: "RUN",
        code: {
          language: `${block.codeLanguage}`.toLowerCase(),
          code: block.code,
        },
        inputs: io.inputs,
        libraries: io.libraries,
        outputs: io.outputs,
        widgetId,
      };
    }

    closeIFrame();
    printErr(`Unexpected result status: ${resultStatus}`);
    return undefined;
  }

  async function formatHandler(
    msg: IFrameMessage
  ): Promise<IFrameMessage | undefined> {
    closeIFrame();
    if (msg?.code && codeBlockId) {
      await loadFonts();
      const block = figma.getNodeById(codeBlockId) as CodeBlockNode;
      if (block) {
        block.code = msg.code.code;
        adjustFrames(codeBlockId);
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
        if (msg.outputs) {
          setOutputs(codeBlockId, msg.outputs);
        }
      } else {
        setResultStatus("ERROR");
        if (msg.error) {
          const err = msg.error.name + ": " + msg.error.message;
          figma.notify(err);
          console.error(err + "\n" + msg.error.stack);
        }
      }
    }
    setTimeout(function () {
      closeIFrame();
    }, 1000);
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

  function closeIFrame(): void {
    figma.closePlugin();
    // figma.ui.close();
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
    let id = widgetId;
    if (codeBlockId) {
      id = codeBlockId;
    }
    await addCodeBlock(id, DEFAULT_CODE.code, DEFAULT_CODE.language);
  }

  function startIFrame(): Promise<void> {
    return new Promise((resolve) => {
      // const url = `${IFRAME_URL}?source=${encodeURIComponent( // @ts-expect-error
      //   document.location.origin
      // )}`;
      figma.showUI(`<script>window.location.href = "${IFRAME_URL}"</script>`, {
        visible: false,
        title: "Code runner",
      });
    });
  }

  function openLink(url: string): Promise<void> {
    return new Promise((resolve) => {
      figma.showUI(`<script>window.open('${url}','_blank');</script>`, {
        visible: false,
      });
      setTimeout(function () {
        figma.closePlugin();
        resolve();
      }, 1000);
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
    async ({ propertyName, propertyValue }) => {
      if (propertyName === "play") {
        if (resultStatus !== "RUNNING") {
          return await handlePlayBtn();
        }
      } else if (propertyName === "format") {
        return await handleFormatBtn();
      } else if (propertyName === "addBlock") {
        return await handleAddBlockBtn();
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
      <AutoLayout
        direction="horizontal"
        padding={metrics.headerPadding}
        width="fill-parent"
        verticalAlignItems="start"
        spacing={metrics.padding}
      >
        <Text fontSize={16} horizontalAlignText="center">
          {title}
          {}
        </Text>
        <SVG
          src={icons["info"]}
          width={metrics.infoIconSize}
          height={metrics.infoIconSize}
          onClick={async () => await openLink(INFO_URL)}
        />
      </AutoLayout>
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
      </AutoLayout>
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
  );
}

widget.register(Widget);
