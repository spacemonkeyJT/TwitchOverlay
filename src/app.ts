import { initHypeMeter, processHypeMeterChatMessage } from "./hypemeter"
import { initClip, processClipChatMessage } from "./clip";
import { startBot, type MessageData } from "./twitch"

const errorPanel = document.querySelector<HTMLDivElement>('.errorPanel')!

async function main() {
  try {
    const params = new URLSearchParams(window.location.search);

    const user_id = params.get('user_id');
    const channel = params.get('channel') ?? user_id;
    const token = params.get('token');
    const clientID = params.get('client_id');
    const widget = params.get('widget') ?? 'hypemeter';

    let processChatMessage: ((data: MessageData) => unknown) | undefined = undefined;

    if (widget === 'hypemeter') {
      initHypeMeter();
      processChatMessage = processHypeMeterChatMessage;
    } else if (widget === 'clip' && channel) {
      initClip(channel);
      processChatMessage = processClipChatMessage;
    }

    if (channel && user_id && token && clientID && processChatMessage) {
      await startBot({ processChatMessage, channel, user_id, token, clientID });
    } else {
      console.error('Invalid parameters. Chat bot will not start.');
    }
  } catch (err) {
    console.log(err);
    errorPanel.textContent = `${err}`;
    errorPanel.style.display = 'block';
  }
}

main();
