import { getClip, getClips, getClipStreamURL, getUserId, sendChatMessage, type MessageData } from "./twitch";

const clipPanel = document.querySelector<HTMLDivElement>('.clip')!
const clipVideo = document.querySelector<HTMLVideoElement>('.clipVideo')!
const clipTitle = document.querySelector<HTMLDivElement>('.clipTitle')!

let channelId: string;

export function initClip(_channelId: string) {
  channelId = _channelId;

  clipVideo.onended = () => {
    clipVideo.src = '';
    clipPanel.style.display = 'none';
  }

  (window as any).chat = (message: string) => {
    processChatCommand(message, ['moderator']);
  };
}

async function getClipFromUrl(url: string) {
  // Twitch clip links can be of two formats, e.g.:
  // https://www.twitch.tv/kmrkle/clip/ConcernedObedientLobsterPastaThat-Z0PBQy-JhuWWYsTF
  // https://clips.twitch.tv/ConcernedObedientLobsterPastaThat-Z0PBQy-JhuWWYsTF

  let clipId: string | null = null;

  const match = /^https:\/\/clips\.twitch\.tv\/(.*)$/i.exec(url);
  if (match) {
    clipId = match[1];
  } else {
    const match2 = /^https:\/\/www\.twitch\.tv\/.*?\/clip\/(.*)$/i.exec(url);
    if (match2) {
      clipId = match2[1];
    }
  }

  if (clipId) {
    return await getClip(clipId);
  }

  return null;
}

const clipCache: {
  [username: string]: any[]
} = {};

async function getRandomClipForUser(userId: string) {
  console.log(`Getting clip for user ${userId}`);
  if (!clipCache[userId]) {
    console.log('Fetching all clips');
    clipCache[userId] = await getClips(userId);
  }
  const clips = clipCache[userId];
  const randomIndex = Math.floor(Math.random() * clips.length);
  return clips[randomIndex];
}

async function processChatCommand(message: string, badges: string[]) {
  const isModerator = badges.includes('moderator') || badges.includes('broadcaster');
  const [command, ...args] = message.split(' ');
  let isUrl = false;
  if (command === '!showclip' && isModerator) {
    let clip: any = null;
    if (args[0]) {
      clip = await getClipFromUrl(args[0]);
      if (clip) {
        isUrl = true;
      } else {
        let username = args[0];
        if (username.startsWith('@')) {
          username = username.slice(1);
        }
        const userId = await getUserId(username);
        if (userId) {
          clip = await getRandomClipForUser(userId);
        }
      }
    } else {
      clip = await getRandomClipForUser(channelId);
    }
    if (clip) {
      console.log(clip);
      if (!isUrl) {
        const clipUrl = `https://clips.twitch.tv/${clip.id}`;
        await sendChatMessage(`Playing clip: ${clipUrl}`);
      }
      const videoUrl = await getClipStreamURL(clip.id);
      clipVideo.src = videoUrl;
      clipTitle.innerText = `${clip.title} - clipped by ${clip.creator_name}`;
      clipPanel.style.display = 'block';
    }
  }
}

export function processClipChatMessage(data: MessageData) {
  const message = data.payload.event.message.text.trim();
  const badges = data.payload.event.badges.map(badge => badge.set_id);
  processChatCommand(message, badges);
}
