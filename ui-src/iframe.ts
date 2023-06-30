import { handleMessage } from './messages';
import { PLUGIN_ID } from '../shared/constants';
import { printErr } from './utils';

function setupHeadlessRunner() {
  window.onmessage = (event: MessageEvent) => {
    if (!event.data?.type) {
      return;
    }
    handleMessage(event.data);
  };
  // Send 'ready' msg to the plugin.
  parent.postMessage({ type: 'INITIATE' }, PLUGIN_ID);
}

switch (import.meta.env.VITE_TARGET) {
  case 'run':
    setupHeadlessRunner();
    break;
  default:
    printErr(`Unknown build target '${import.meta.env.VITE_TARGET}'`);
}
