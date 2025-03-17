import { getClips, getClipStreamURL, getUserId, sendChatMessage, type MessageData } from "./twitch";

const clipPanel = document.querySelector<HTMLDivElement>('.clip')!
const clipVideo = document.querySelector<HTMLVideoElement>('.clipVideo')!

let hideTimer: Timer | null = null;
let channelId: string;

export function initClip(_channelId: string) {
  channelId = _channelId;
  clipPanel.style.display = 'block';

  clipVideo.onended = () => {
    clipVideo.src = '';
  }

  (window as any).chat = (message: string) => {
    processChatCommand(message, ['moderator']);
  };
}

function getClipIdFromUrl(url: string) {
  // Twitch clip links can be of two formats, e.g.:
  // https://www.twitch.tv/kmrkle/clip/ConcernedObedientLobsterPastaThat-Z0PBQy-JhuWWYsTF
  // https://clips.twitch.tv/ConcernedObedientLobsterPastaThat-Z0PBQy-JhuWWYsTF

  const match = /^https:\/\/clips\.twitch\.tv\/(.*)$/i.exec(url);
  if (match) {
    return match[1];
  }

  const match2 = /^https:\/\/www\.twitch\.tv\/.*?\/clip\/(.*)$/i.exec(url);
  if (match2) {
    return match2[1];
  }

  return '';
}

const clipCache: {
  [username: string]: any[]
} = {};

async function getClipIdFromUserId(userId: string) {
  console.log(`Getting clip for user ${userId}`);
  if (!clipCache[userId]) {
    clipCache[userId] = await getClips(userId);
  }
  const clips = clipCache[userId];
  const randomIndex = Math.floor(Math.random() * clips.length);
  return clips[randomIndex].id;
}

async function processChatCommand(message: string, badges: string[]) {
  const isModerator = badges.includes('moderator') || badges.includes('broadcaster');
  const [command, ...args] = message.split(' ');
  let isUrl = false;
  if (command === '!showclip' && isModerator) {
    let clipId: string | null = null;
    if (args[0]) {
      clipId = getClipIdFromUrl(args[0]);
      if (clipId) {
        isUrl = true;
      } else {
        let username = args[0];
        if (username.startsWith('@')) {
          username = username.slice(1);
        }
        const userId = await getUserId(username);
        if (userId) {
          clipId = await getClipIdFromUserId(userId);
        }
      }
    } else {
      clipId = await getClipIdFromUserId(channelId);
    }
    if (clipId) {
      if (!isUrl) {
        console.log('Clip ID:', clipId);
        const clipUrl = `https://clips.twitch.tv/${clipId}`;
        console.log(clipUrl);
        await sendChatMessage(`Playing clip: ${clipUrl}`);
      }
      const videoUrl = await getClipStreamURL(clipId);
      clipVideo.src = videoUrl;
    }
  }
}

export function processClipChatMessage(data: MessageData) {
  const message = data.payload.event.message.text.trim();
  const badges = data.payload.event.badges.map(badge => badge.set_id);
  processChatCommand(message, badges);
}
