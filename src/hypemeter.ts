import { sendChatMessage } from "./twitch"

const progress = document.querySelector<HTMLDivElement>('.progress')!
const label = document.querySelector<HTMLDivElement>('.label')!

type MeterConfig = {
  value: number,
  max: number,
  bitsRate: number,
  subTier1Rate: number,
  subTier2Rate: number,
  subTier3Rate: number,
  optionalMessages: boolean,
  subDetectType: 'event' | 'message',
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
  subDetectType: 'event',
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
  const displayValue = Math.min(config.value, config.max);
  const displayPercent = displayValue / config.max * 100;
  progress.style.width = `calc(${displayPercent}% - 16px)`;
  const realPercent = config.value / config.max * 100;
  label.textContent = `${Math.round(realPercent)}%`;
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
  
  (window as any).chat = (message: string) => {
    processHypeMeter(message, 'username', ['moderator']);
  };
}

function sendOptionalMessage(message: string) {
  if (config.optionalMessages) {
    sendChatMessage(message);
  }
}

function applySubs(count: number, tier: number) {
  const rate = tier === 1 ? config.subTier1Rate : tier === 2 ? config.subTier2Rate : config.subTier3Rate;
  const val = config.value + rate * count;
  setHypeMeter(val);
  saveData();
  sendOptionalMessage('Hype meter increased to ' + val.toFixed(2) + ` for ${count} tier ${tier} subs`);
}

function applyBits(bits: number) {
  const val = config.value + config.bitsRate * bits;
  setHypeMeter(val);
  saveData();
  sendOptionalMessage('Hype meter increased to ' + val.toFixed(2) + ` for ${bits} bits`);
}

// export function processHypeMeter(data: MessageData) {
export function processHypeMeter(message: string, username: string, badges: string[], bits?: number, subTier?: number, subCount?: number) {
  const isModerator = badges.includes('moderator') || badges.includes('broadcaster');

  const [command, ...args] = message.split(' ');

  if (bits) {
    applyBits(bits);
  }

  if (config.subDetectType === 'message') {
    if (username === 'streamlabs') {
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
  } else if (config.subDetectType === 'event') {
    if (subTier && subCount) {
      applySubs(subCount, subTier);
    }
  }

  if (isModerator) {
    if ((command === '!sethypemeter' || command === '!sethm') && args[0]) {
      const val = parseFloat(args[0]);
      const max = args[1] ? parseFloat(args[1]) : config.max;
      if (val >= 0) {
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
            if (val >= 0) {
              setHypeMeter(val, max);
              sendOptionalMessage('Hype meter set to ' + val.toFixed(2));
            }
          }
          break;

        case 'add':
          if (subArgs[0]) {
            const val = parseFloat(subArgs[0]);
            if (!isNaN(val)) {
              const newVal = config.value + val;
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
          sendOptionalMessage('Hype meter reset to default values');
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

        case 'subdetect':
          if (subArgs[0] === 'event') {
            config.subDetectType = 'event';
            saveData();
            sendOptionalMessage('Sub detection set to event');
          } else if (subArgs[0] === 'message') {
            config.subDetectType = 'message';            
            saveData();
            sendOptionalMessage('Sub detection set to message');
          }
          break;

        case 'complete':
          const val = config.value % config.max;
          const max = subArgs[0] ? parseFloat(subArgs[0]) : config.max;
          setHypeMeter(val, max);
          break;
      }
    }
  }
}
