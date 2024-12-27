import { sendChatMessage, type MessageData } from "./twitch";

const progressend = document.querySelector<HTMLDivElement>('.progressend')!
const label = document.querySelector<HTMLDivElement>('.label')!

type MeterConfig = {
  value: number,
  max: number,
  bitsRate: number,
  subTier1Rate: number,
  subTier2Rate: number,
  subTier3Rate: number,
  optionalMessages: boolean
}

const defaults: MeterConfig = {
  value: 50,
  max: 300,

  // Set assuming that 100 bits cost $1.40, and streamers receive 80% of it.
  bitsRate: 0.0112,

  // Set assuming subs cost $5 for T1, $10 for T2, $25 for T3, and streamers receive 70% of it (at level 2 of plus program)
  subTier1Rate: 3.5,
  subTier2Rate: 7,
  subTier3Rate: 17.5,

  optionalMessages: false,
}

const config = { ...defaults };

function saveData() {
  localStorage.setItem('hypemeter', JSON.stringify(config));
}

function loadData() {
  try {
    const json = localStorage.getItem('hypemeter');
    if (json) {
      const data = JSON.parse(json) as MeterConfig;
      Object.assign(config, data);
    }
  } catch (err) {
    console.error(err);
  }
}

function updateHypeMeter() {
  const percent = config.value / config.max * 100;
  progressend.style.width = `calc(${100-percent}% - 4px)`;
  label.textContent = `${Math.round(percent)}%`;
}

function setHypeMeter(value: number, max?: number) {
  config.value = value;
  if (max !== undefined) {
    config.max = max;
  }
  saveData();
  updateHypeMeter();
}

export function initHypeMeter() {
  loadData();
  updateHypeMeter();
}

function sendOptionalMessage(message: string) {
  if (config.optionalMessages) {
    sendChatMessage(message);
  }
}

function applySubs(count: number, tier: number) {
  const rate = tier === 1 ? config.subTier1Rate : tier === 2 ? config.subTier2Rate : config.subTier3Rate;
  const val = Math.min(config.value + rate * count, config.max);
  setHypeMeter(val);
  saveData();
  sendOptionalMessage('Hype meter set to ' + val.toFixed(2));
}

function applyBits(bits: number) {
  const val = Math.min(config.value + config.bitsRate * bits, config.max);
  setHypeMeter(val);
  saveData();
  sendOptionalMessage('Hype meter set to ' + val.toFixed(2));
}

export function processHypeMeter(data: MessageData) {
  const message = data.payload.event.message.text.trim();

  const badges = data.payload.event.badges.map(badge => badge.set_id);
  const isModerator = badges.includes('moderator') || badges.includes('broadcaster');

  const [command, ...args] = message.split(' ');

  const { cheer } = data.payload.event;;

  const { chatter_user_login } = data.payload.event;

  if (cheer) {
    applyBits(cheer.bits);
  }

  if (chatter_user_login === 'streamlabs') {
    let match: RegExpExecArray | null;
    if (match = /^(.*) just gifted (\d+) Tier (\d+) subscriptions!$/.exec(message)) {
      const count = parseInt(match[2]);
      const tier = parseInt(match[3]);
      applySubs(count, tier);
    } else if (match = /^(.*) just subscribed with Twitch Prime!$/.exec(message)) {
      applySubs(1, 1);
    } else if (match = /^(.*) just subscribed with Tier (\d+)!$/.exec(message)) {
      applySubs(1, parseInt(match[2]));
    }
  }

  if (isModerator) {
    if ((command === '!sethypemeter' || command === '!sethm') && args[0]) {
      const val = parseFloat(args[0]);
      const max = args[1] ? parseFloat(args[1]) : config.max;
      if (val >= 0 && val <= max) {
        setHypeMeter(val, max);
        sendOptionalMessage('Hype meter set to ' + val.toFixed(2));
      }
    }
    else if (command === '!hm') {
      const subCommand = args[0];
      const subArgs = args.slice(1);
      switch (subCommand) {

        case 'set':
          if (subArgs[0]) {
            const val = parseFloat(subArgs[0]);
            const max = subArgs[1] ? parseFloat(subArgs[1]) : config.max;
            if (val >= 0 && val <= max) {
              setHypeMeter(val, max);
              sendOptionalMessage('Hype meter set to ' + val.toFixed(2));
            }
          }
          break;

        case 'add':
          if (subArgs[0]) {
            const val = parseFloat(subArgs[0]);
            if (val >= 0) {
              const newVal = Math.min(config.value + val, config.max);
              setHypeMeter(newVal);
              sendOptionalMessage('Hype meter set to ' + val.toFixed(2));
            }
          }
          break;

        case 'get':
          sendChatMessage(`Hype meter is at ${config.value.toFixed(2)} / ${config.max.toFixed(2)}`);
          break;

        case 'reload':
          location.reload();
          break;

        case 'bitsrate':
          if (subArgs[0]) {
            const val = parseFloat(subArgs[0]);
            if (val > 0) {
              config.bitsRate = val;
              saveData();
              sendOptionalMessage('Hype meter bits rate set to ' + val.toFixed(2));
            }
          }
          break;

        case 'subrate1':
          if (subArgs[0]) {
            const val = parseFloat(subArgs[0]);
            if (val > 0) {
              config.subTier1Rate = val;
              saveData();
              sendOptionalMessage('Hype meter sub tier 1 rate set to ' + val.toFixed(2));
            }
          }
          break;

        case 'subrate2':
          if (subArgs[0]) {
            const val = parseFloat(subArgs[0]);
            if (val > 0) {
              config.subTier2Rate = val;
              saveData();
              sendOptionalMessage('Hype meter sub tier 2 rate set to ' + val.toFixed(2));
            }
          }
          break;

        case 'subrate3':
          if (subArgs[0]) {
            const val = parseFloat(subArgs[0]);
            if (val > 0) {
              config.subTier3Rate = val;
              saveData();
              sendOptionalMessage('Hype meter sub tier 3 rate set to ' + val.toFixed(2));
            }
          }
          break;

        case 'config':
          sendChatMessage(`Hype meter bits rate: ${config.bitsRate}, sub tier 1 rate: ${config.subTier1Rate}, sub tier 2 rate: ${config.subTier2Rate}, sub tier 3 rate: ${config.subTier3Rate}`);
          break;

        case 'reset':
          Object.assign(config, defaults);
          updateHypeMeter();
          saveData();
          sendOptionalMessage('Hype meter reset');
          break;

        case 'simbits':
          if (subArgs[0]) {
            const val = parseFloat(subArgs[0]);
            if (val > 0) {
              applyBits(val);
            }
          }
          break;
          
        case 'simsubs':
          if (subArgs[0]) {
            const count = parseInt(subArgs[0]);
            const tier = subArgs[1] ? parseInt(subArgs[1]) : 1;
            applySubs(count, tier);
          }
          break;

        case 'messages':
          if (subArgs[0] === 'enable') {
            config.optionalMessages = true;
            saveData();
            sendOptionalMessage('Optional messages enabled');
          } else if (subArgs[0] === 'disable') {
            config.optionalMessages = false;
            saveData();
          }
          break;
      }
    }
  }
}
