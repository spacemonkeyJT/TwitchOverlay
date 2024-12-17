import { sendChatMessage, startBot, type MessageData, type Options } from "./twitch"

const progressbar = document.querySelector<HTMLDivElement>('.progressbar')!
const label = document.querySelector<HTMLDivElement>('.label')!
const errorPanel = document.querySelector<HTMLDivElement>('.errorPanel')!

function update(percentComplete: number) {
  progressbar.style.width = `${percentComplete}%`
  label.textContent = `${percentComplete}%`
}

function processChatMessage(data: MessageData) {
  const message = data.payload.event.message.text.trim();

  let match: RegExpExecArray | null = null;

  if (match = /^!sethypemeter\s+(\d+(?:\.\d+)?)$/i.exec(message)) {
    const hypemeterValue = parseFloat(match[1]);
    update(hypemeterValue);
    sendChatMessage('Hype meter set to ' + hypemeterValue);
  }
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

    update(50);
  } catch (err) {
    console.log(err);
    errorPanel.textContent = `${err}`;
    errorPanel.style.display = 'block';
  }
}

main();
