import { processHypeMeter, initHypeMeter } from "./hypemeter"
import { startBot, type MessageData, type Options } from "./twitch"

const errorPanel = document.querySelector<HTMLDivElement>('.errorPanel')!

function processChatMessage(data: MessageData) {
  processHypeMeter(data);
}

async function main() {
  try {
    const params = new URLSearchParams(window.location.search);

    const options: Options = {
      processChatMessage,
      channel: params.get('channel')!,
      user_id: params.get('user_id')!,
      token: params.get('token')!,
      clientID: params.get('client_id')!,
    };

    if (!options.user_id) throw Error('Missing user_id parameter.');
    if (!options.token) throw Error('Missing token parameter.');
    if (!options.clientID) throw Error('Missing client_id parameter.');
    if (!options.channel) throw Error('Missing channel parameter.');

    await startBot(options);

    initHypeMeter();
  } catch (err) {
    console.log(err);
    errorPanel.textContent = `${err}`;
    errorPanel.style.display = 'block';
  }
}

main();
