import { processHypeMeter, initHypeMeter } from "./hypemeter"
import { startBot, type MessageData } from "./twitch"

const errorPanel = document.querySelector<HTMLDivElement>('.errorPanel')!

function tierStringToLevel(tier: string): number {
  switch (tier) {
    case '1000':
      return 1;
    case '2000':
      return 2;
    case '3000':
      return 3;
    default:
      return 0;
  }
}

function processChatMessage(data: MessageData) {
  const message = data.payload.event.message.text.trim();
  const badges = data.payload.event.badges.map(badge => badge.set_id);
  const username = data.payload.event.chatter_user_login;
  const bits = data.payload.event.cheer?.bits;

  let subTier: number | undefined = undefined;
  let subCount: number | undefined = undefined;

  if (data.payload.event.resub) {
    subTier = tierStringToLevel(data.payload.event.resub.sub_tier);
    subCount = 1;
    console.log(`RESUB: ${subTier} ${subCount}`);
  } else if (data.payload.event.sub) {
    subTier = tierStringToLevel(data.payload.event.sub.sub_tier);
    subCount = 1;
    console.log(`SUB: ${subTier} ${subCount}`);
  } else if (data.payload.event.sub_gift) {
    subTier = tierStringToLevel(data.payload.event.sub_gift.sub_tier);
    subCount = data.payload.event.sub_gift.duration_months;
    console.log(`SUB GIFT: ${subTier} ${subCount}`);
  } else if (data.payload.event.community_sub_gift) {
    subTier = tierStringToLevel(data.payload.event.community_sub_gift.sub_tier);
    subCount = data.payload.event.community_sub_gift.total;
    console.log(`COMMUNITY SUB GIFT: ${subTier} ${subCount}`);
  } else if (data.payload.event.prime_paid_upgrade) {
    subTier = tierStringToLevel(data.payload.event.prime_paid_upgrade.sub_tier);
    subCount = 1;
    console.log(`PRIME PAID UPGRADE: ${subTier} ${subCount}`);
  }

  processHypeMeter(message, username, badges, bits, subTier, subCount);
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
