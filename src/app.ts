import { sendChatMessage, startBot, type MessageData } from "./twitch"

const progressbar = document.querySelector<HTMLDivElement>('.progressbar')!
const label = document.querySelector<HTMLDivElement>('.label')!

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
  update(50);
  await startBot(processChatMessage);
}

main().catch(console.error);
