import { processHypeMeter, initHypeMeter } from "./hypemeter"
import { sendChatMessage, startBot, type MessageData, type Options } from "./twitch"

const errorPanel = document.querySelector<HTMLDivElement>('.errorPanel')!

function processChatMessage(data: MessageData) {
  const message = data.payload.event.message.text.trim();
  const badges = data.payload.event.badges.map(badge => badge.set_id);
  processHypeMeter(message, data.payload.event.chatter_user_login, badges, data.payload.event.cheer?.bits);
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

    if (options.user_id && options.token && options.clientID && options.channel) {
      await startBot(options);
      initHypeMeter(sendChatMessage);
    } else {
      (window as any).chat = (message: string) => {
        processHypeMeter(message, 'username', ['moderator']);
      };
      initHypeMeter(console.log);
    }

  } catch (err) {
    console.log(err);
    errorPanel.textContent = `${err}`;
    errorPanel.style.display = 'block';
  }
}

main();
