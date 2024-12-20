import { sendChatMessage, type MessageData } from "./twitch";

const progressbar = document.querySelector<HTMLDivElement>('.progressbar')!
const label = document.querySelector<HTMLDivElement>('.label')!

type MeterConfig = {
  value: number,
  max: number,
  bitsRate: number,
  subTier1Rate: number,
  subTier2Rate: number,
  subTier3Rate: number
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
}

const meter = { ...defaults };

function saveData() {
  localStorage.setItem('hypemeter', JSON.stringify(meter));
}

function loadData() {
  try {
    const json = localStorage.getItem('hypemeter');
    if (json) {
      const data = JSON.parse(json) as MeterConfig;
      Object.assign(meter, data);
    }
  } catch (err) {
    console.error(err);
  }
}

function updateHypeMeter() {
  const percent = meter.value / meter.max * 100;
  progressbar.style.width = `${percent}%`;
  label.textContent = `$${meter.value.toFixed(2)} / $${meter.max.toFixed(2)}`;
}

function setHypeMeter(value: number, max?: number) {
  meter.value = value;
  if (max !== undefined) {
    meter.max = max;
  }
  saveData();
  updateHypeMeter();
}

export function initHypeMeter() {
  loadData();
  updateHypeMeter();
}

function applySubs(count: number, tier: number) {
  const rate = tier === 1 ? meter.subTier1Rate : tier === 2 ? meter.subTier2Rate : meter.subTier3Rate;
  const val = Math.min(meter.value + rate * count, meter.max);
  setHypeMeter(val);
  saveData();
  sendChatMessage('Hype meter set to $' + val.toFixed(2));
}

function applyBits(bits: number) {
  const val = Math.min(meter.value + meter.bitsRate * bits, meter.max);
  setHypeMeter(val);
  saveData();
  sendChatMessage('Hype meter set to $' + val.toFixed(2));
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
      const max = args[1] ? parseFloat(args[1]) : meter.max;
      if (val >= 0 && val <= max) {
        setHypeMeter(val, max);
        sendChatMessage('Hype meter set to $' + val.toFixed(2));
      }
    }
    else if (command === '!hm') {
      const subCommand = args[0];
      const subArgs = args.slice(1);
      switch (subCommand) {

        case 'set':
          if (subArgs[0]) {
            const val = parseFloat(subArgs[0]);
            const max = subArgs[1] ? parseFloat(subArgs[1]) : meter.max;
            if (val >= 0 && val <= max) {
              setHypeMeter(val, max);
              sendChatMessage('Hype meter set to $' + val.toFixed(2));
            }
          }
          break;

        case 'reload':
          location.reload();
          break;

        case 'bitsrate':
          if (subArgs[0]) {
            const val = parseFloat(subArgs[0]);
            if (val > 0) {
              meter.bitsRate = val;
              saveData();
              sendChatMessage('Hype meter bits rate set to $' + val.toFixed(2));
            }
          }
          break;

        case 'subrate1':
          if (subArgs[0]) {
            const val = parseFloat(subArgs[0]);
            if (val > 0) {
              meter.subTier1Rate = val;
              saveData();
              sendChatMessage('Hype meter sub tier 1 rate set to $' + val.toFixed(2));
            }
          }
          break;

        case 'subrate2':
          if (subArgs[0]) {
            const val = parseFloat(subArgs[0]);
            if (val > 0) {
              meter.subTier2Rate = val;
              saveData();
              sendChatMessage('Hype meter sub tier 2 rate set to $' + val.toFixed(2));
            }
          }
          break;

        case 'subrate3':
          if (subArgs[0]) {
            const val = parseFloat(subArgs[0]);
            if (val > 0) {
              meter.subTier3Rate = val;
              saveData();
              sendChatMessage('Hype meter sub tier 3 rate set to $' + val.toFixed(2));
            }
          }
          break;

        case 'config':
          sendChatMessage(`Hype meter bits rate: $${meter.bitsRate}, sub tier 1 rate: $${meter.subTier1Rate}, sub tier 2 rate: $${meter.subTier2Rate}, sub tier 3 rate: $${meter.subTier3Rate}`);
          break;

        case 'reset':
          Object.assign(meter, defaults);
          updateHypeMeter();
          saveData();
          sendChatMessage('Hype meter reset');
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
      }
    }
  }
}
