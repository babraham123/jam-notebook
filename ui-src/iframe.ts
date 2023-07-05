import { handleMessage, initiate } from "./messages";

window.onmessage = (event: MessageEvent) => {
  if (!event.data?.type) {
    return;
  }
  handleMessage(event.data);
};

initiate();
