import { processHypeMeter, initHypeMeter } from "./hypemeter"
import { startBot, type MessageData } from "./twitch"

const errorPanel = document.querySelector<HTMLDivElement>('.errorPanel')!

function processChatMessage(data: MessageData) {
  const message = data.payload.event.message.text.trim();
  const badges = data.payload.event.badges.map(badge => badge.set_id);
  processHypeMeter(message, data.payload.event.chatter_user_login, badges, data.payload.event.cheer?.bits);
}

async function main() {
  try {
    const params = new URLSearchParams(window.location.search);

    const channel = params.get('channel');
    const user_id = params.get('user_id');
    const token = params.get('token');
    const clientID = params.get('client_id');

    initHypeMeter();

    if (channel && user_id && token && clientID) {
      await startBot({ processChatMessage, channel, user_id, token, clientID });
    } else {
      console.error('Invalid parameters. Chat bot will not start.');
    }

    console.log('For development, use: chat(\'!hm ...\');');
  } catch (err) {
    console.log(err);
    errorPanel.textContent = `${err}`;
    errorPanel.style.display = 'block';
  }
}

main();
