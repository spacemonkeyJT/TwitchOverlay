import { sendChatMessage, type MessageData } from "./twitch";

const progressbar = document.querySelector<HTMLDivElement>('.progressbar')!
const label = document.querySelector<HTMLDivElement>('.label')!

const meter = {
  value: 50,
  max: 300,
  bitsRate: 0.1
}

function saveData() {
  localStorage.setItem('hypemeter', JSON.stringify(meter));
}

function loadData() {
  const json = localStorage.getItem('hypemeter');
  if (json) {
    const data = JSON.parse(json);
    meter.value = data.value;
    meter.max = data.max;
  }
}

function updateHypeMeter() {
  const percent = meter.value / meter.max * 100;
  progressbar.style.width = `${percent}%`;
  label.textContent = `${meter.value}/${meter.max}`;
}

function setHypeMeter(value: number, max: number) {
  meter.value = value;
  meter.max = max;
  saveData();
  updateHypeMeter();
}

export function initHypeMeter() {
  loadData();
  updateHypeMeter();
}

export function processHypeMeter(data: MessageData) {  
  const message = data.payload.event.message.text.trim();

  const badges = data.payload.event.badges.map(badge => badge.set_id);
  const isModerator = badges.includes('moderator') || badges.includes('broadcaster');

  const [command, ...args] = message.split(' ');

  if (isModerator) {
    if ((command === '!sethypemeter' || command === '!sethm') && args[0]) {
      const val = parseFloat(args[0]);
      const max = args[1] ? parseFloat(args[1]) : meter.max;
      if (val >= 0 && val <= max) {
        setHypeMeter(val, max);
        sendChatMessage('Hype meter set to ' + val);
      }
    }
    if (command === '!reloadhypemeter' || command === '!reloadhm') {
      location.reload();
    }
  }
}
