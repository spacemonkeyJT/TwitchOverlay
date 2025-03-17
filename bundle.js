// src/twitch.ts
var EVENTSUB_WEBSOCKET_URL = "wss://eventsub.wss.twitch.tv/ws";
var websocketSessionID;
var websocketClient;
var options;
async function startBot(_options) {
  options = _options;
  await getAuth();
  websocketClient = startWebSocketClient();
}
async function getAuth() {
  let response = await fetch("https://id.twitch.tv/oauth2/validate", {
    method: "GET",
    headers: {
      Authorization: "OAuth " + options.token
    }
  });
  if (response.status != 200) {
    let data = await response.json();
    console.error("Token is not valid. /oauth2/validate returned status code " + response.status);
    throw Error(data);
  }
  console.log("Validated token.");
}
function startWebSocketClient() {
  let websocketClient2 = new WebSocket(EVENTSUB_WEBSOCKET_URL);
  console.log(websocketClient2);
  websocketClient2.addEventListener("error", console.error);
  websocketClient2.addEventListener("open", () => {
    console.log("WebSocket connection opened to " + EVENTSUB_WEBSOCKET_URL);
  });
  websocketClient2.addEventListener("message", (msg) => {
    handleWebSocketMessage(JSON.parse(msg.data.toString()));
  });
  return websocketClient2;
}
function handleWebSocketMessage(data) {
  switch (data.metadata.message_type) {
    case "session_welcome":
      websocketSessionID = data.payload.session.id;
      registerEventSubListeners();
      break;
    case "notification":
      console.log("notification:", data.metadata.subscription_type, data);
      switch (data.metadata.subscription_type) {
        case "channel.chat.message":
          console.log(`MSG #${data.payload.event.broadcaster_user_login} <${data.payload.event.chatter_user_login}> ${data.payload.event.message.text}`);
          options.processChatMessage(data);
          break;
        case "channel.chat.notification":
          console.log("NOTIFICATION");
          options.processChatMessage(data);
          break;
      }
      break;
  }
}
async function sendChatMessage(chatMessage) {
  if (options) {
    let response = await fetch("https://api.twitch.tv/helix/chat/messages", {
      method: "POST",
      headers: {
        Authorization: "Bearer " + options.token,
        "Client-Id": options.clientID,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        broadcaster_id: options.channel,
        sender_id: options.user_id,
        message: chatMessage
      })
    });
    if (response.status != 200) {
      let data = await response.json();
      console.error("Failed to send chat message");
      console.error(data);
    } else {
      console.log("Sent chat message: " + chatMessage);
    }
  } else {
    console.log(chatMessage);
  }
}
async function registerEventSubListeners() {
  let response = await fetch("https://api.twitch.tv/helix/eventsub/subscriptions", {
    method: "POST",
    headers: {
      Authorization: "Bearer " + options.token,
      "Client-Id": options.clientID,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      type: "channel.chat.message",
      version: "1",
      condition: {
        broadcaster_user_id: options.channel,
        user_id: options.user_id
      },
      transport: {
        method: "websocket",
        session_id: websocketSessionID
      }
    })
  });
  if (response.status != 202) {
    let data = await response.json();
    console.error("Failed to subscribe to channel.chat.message. API call returned status code " + response.status);
    throw data;
  } else {
    const data = await response.json();
    console.log(`Subscribed to channel.chat.message [${data.data[0].id}]`);
  }
  response = await fetch("https://api.twitch.tv/helix/eventsub/subscriptions", {
    method: "POST",
    headers: {
      Authorization: "Bearer " + options.token,
      "Client-Id": options.clientID,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      type: "channel.chat.notification",
      version: "1",
      condition: {
        broadcaster_user_id: options.channel,
        user_id: options.user_id
      },
      transport: {
        method: "websocket",
        session_id: websocketSessionID
      }
    })
  });
  if (response.status != 202) {
    let data = await response.json();
    console.error("Failed to subscribe to channel.chat.notification. API call returned status code " + response.status);
    throw data;
  } else {
    const data = await response.json();
    console.log(`Subscribed to channel.chat.notification [${data.data[0].id}]`);
  }
}
function tierStringToLevel(tier) {
  switch (tier) {
    case "1000":
      return 1;
    case "2000":
      return 2;
    case "3000":
      return 3;
    default:
      return 0;
  }
}
async function getClips(userId) {
  let pagination = null;
  let clips = [];
  for (let i = 0;i < 10; i++) {
    const res = await fetch(`https://api.twitch.tv/helix/clips?broadcaster_id=${userId}&first=100${pagination ? `&after=${pagination}` : ""}`, {
      method: "GET",
      headers: {
        Authorization: "Bearer " + options.token,
        "Client-Id": options.clientID,
        "Content-Type": "application/json"
      }
    });
    const body = await res.json();
    pagination = body.pagination.cursor;
    clips = clips.concat(body.data);
    if (!pagination) {
      break;
    }
  }
  console.log(`Got ${clips.length} total clips.`);
  return clips;
}
async function getClipStreamURL(clipId) {
  const result = await getClipInfo(clipId);
  const uri = result.sourceUrl + "?token=" + encodeURIComponent(result.token) + "&sig=" + encodeURIComponent(result.signature);
  return uri;
}
async function getClipInfo(clipId) {
  const content = JSON.stringify(buildGraphQLQuery(clipId));
  const response = await fetch("https://gql.twitch.tv/gql", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Client-ID": "kimne78kx3ncx6brgo4mv6wki5h1ko"
    },
    body: content
  });
  const responseBody = await response.text();
  return parseGraphQLResponse(responseBody);
}
function buildGraphQLQuery(clipId) {
  return {
    operationName: "VideoAccessToken_Clip",
    variables: {
      slug: clipId
    },
    extensions: {
      persistedQuery: {
        version: 1,
        sha256Hash: "36b89d2507fce29e5ca551df756d27c1cfe079e2609642b4390aa4c35796eb11"
      }
    }
  };
}
function parseGraphQLResponse(responseBody) {
  const jsonResponse = JSON.parse(responseBody);
  const videoQualities = jsonResponse.data.clip.videoQualities;
  const bestQuality = videoQualities.sort((a, b) => b.quality - a.quality)[0];
  const playbackAccessToken = jsonResponse.data.clip.playbackAccessToken;
  return {
    sourceUrl: bestQuality.sourceURL,
    signature: playbackAccessToken.signature,
    token: playbackAccessToken.value
  };
}
async function getUserId(username) {
  const res = await fetch("https://api.twitch.tv/helix/users?login=" + username, {
    method: "GET",
    headers: {
      Authorization: "Bearer " + options.token,
      "Client-Id": options.clientID,
      "Content-Type": "application/json"
    }
  });
  const data = await res.json();
  return data.data[0].id;
}

// src/hypemeter.ts
var progress = document.querySelector(".progress");
var label = document.querySelector(".label");
var hypemeter = document.querySelector(".hypemeter");
var defaults = {
  value: 50,
  max: 300,
  bitsRate: 0.0112,
  subTier1Rate: 3.5,
  subTier2Rate: 7,
  subTier3Rate: 17.5,
  optionalMessages: false,
  subDetectType: "event"
};
var config = { ...defaults };
function saveData() {
  localStorage.setItem("hypemeter", JSON.stringify(config));
}
function loadData() {
  try {
    const json = localStorage.getItem("hypemeter");
    if (json) {
      const data = JSON.parse(json);
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
function setHypeMeter(value, max) {
  config.value = value;
  if (max !== undefined) {
    config.max = max;
  }
  saveData();
  updateHypeMeter();
}
function initHypeMeter() {
  hypemeter.style.display = "block";
  loadData();
  updateHypeMeter();
  window.chat = (message) => {
    processHypeMeter(message, "username", ["moderator"]);
  };
}
function sendOptionalMessage(message) {
  if (config.optionalMessages) {
    sendChatMessage(message);
  }
}
function applySubs(count, tier) {
  const rate = tier === 1 ? config.subTier1Rate : tier === 2 ? config.subTier2Rate : config.subTier3Rate;
  const val = config.value + rate * count;
  setHypeMeter(val);
  saveData();
  sendOptionalMessage("Hype meter increased to " + val.toFixed(2) + ` for ${count} tier ${tier} subs`);
}
function applyBits(bits) {
  const val = config.value + config.bitsRate * bits;
  setHypeMeter(val);
  saveData();
  sendOptionalMessage("Hype meter increased to " + val.toFixed(2) + ` for ${bits} bits`);
}
function processHypeMeter(message, username, badges, bits, subTier, subCount) {
  const isModerator = badges.includes("moderator") || badges.includes("broadcaster");
  const [command, ...args] = message.split(" ");
  if (bits) {
    applyBits(bits);
  }
  if (config.subDetectType === "message") {
    if (username === "streamlabs") {
      let match;
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
  } else if (config.subDetectType === "event") {
    if (subTier && subCount) {
      applySubs(subCount, subTier);
    }
  }
  if (isModerator) {
    if ((command === "!sethypemeter" || command === "!sethm") && args[0]) {
      const val = parseFloat(args[0]);
      const max = args[1] ? parseFloat(args[1]) : config.max;
      if (val >= 0) {
        setHypeMeter(val, max);
        sendOptionalMessage("Hype meter set to " + val.toFixed(2));
      }
    } else if (command === "!hm") {
      const subCommand = args[0];
      const subArgs = args.slice(1);
      switch (subCommand) {
        case "set":
          if (subArgs[0]) {
            const val2 = parseFloat(subArgs[0]);
            const max2 = subArgs[1] ? parseFloat(subArgs[1]) : config.max;
            if (val2 >= 0) {
              setHypeMeter(val2, max2);
              sendOptionalMessage("Hype meter set to " + val2.toFixed(2));
            }
          }
          break;
        case "add":
          if (subArgs[0]) {
            const val2 = parseFloat(subArgs[0]);
            if (!isNaN(val2)) {
              const newVal = config.value + val2;
              setHypeMeter(newVal);
              sendOptionalMessage("Hype meter set to " + val2.toFixed(2));
            }
          }
          break;
        case "get":
          sendChatMessage(`Hype meter is at ${config.value.toFixed(2)} / ${config.max.toFixed(2)}`);
          break;
        case "reload":
          location.reload();
          break;
        case "bitsrate":
          if (subArgs[0]) {
            const val2 = parseFloat(subArgs[0]);
            if (val2 > 0) {
              config.bitsRate = val2;
              saveData();
              sendOptionalMessage("Hype meter bits rate set to " + val2.toFixed(2));
            }
          }
          break;
        case "subrate1":
          if (subArgs[0]) {
            const val2 = parseFloat(subArgs[0]);
            if (val2 > 0) {
              config.subTier1Rate = val2;
              saveData();
              sendOptionalMessage("Hype meter sub tier 1 rate set to " + val2.toFixed(2));
            }
          }
          break;
        case "subrate2":
          if (subArgs[0]) {
            const val2 = parseFloat(subArgs[0]);
            if (val2 > 0) {
              config.subTier2Rate = val2;
              saveData();
              sendOptionalMessage("Hype meter sub tier 2 rate set to " + val2.toFixed(2));
            }
          }
          break;
        case "subrate3":
          if (subArgs[0]) {
            const val2 = parseFloat(subArgs[0]);
            if (val2 > 0) {
              config.subTier3Rate = val2;
              saveData();
              sendOptionalMessage("Hype meter sub tier 3 rate set to " + val2.toFixed(2));
            }
          }
          break;
        case "config":
          sendChatMessage(`Hype meter bits rate: ${config.bitsRate}, sub tier 1 rate: ${config.subTier1Rate}, sub tier 2 rate: ${config.subTier2Rate}, sub tier 3 rate: ${config.subTier3Rate}`);
          break;
        case "reset":
          Object.assign(config, defaults);
          updateHypeMeter();
          saveData();
          sendOptionalMessage("Hype meter reset to default values");
          break;
        case "simbits":
          if (subArgs[0]) {
            const val2 = parseFloat(subArgs[0]);
            if (val2 > 0) {
              applyBits(val2);
            }
          }
          break;
        case "simsubs":
          if (subArgs[0]) {
            const count = parseInt(subArgs[0]);
            const tier = subArgs[1] ? parseInt(subArgs[1]) : 1;
            applySubs(count, tier);
          }
          break;
        case "messages":
          if (subArgs[0] === "enable") {
            config.optionalMessages = true;
            saveData();
            sendOptionalMessage("Optional messages enabled");
          } else if (subArgs[0] === "disable") {
            config.optionalMessages = false;
            saveData();
          }
          break;
        case "subdetect":
          if (subArgs[0] === "event") {
            config.subDetectType = "event";
            saveData();
            sendOptionalMessage("Sub detection set to event");
          } else if (subArgs[0] === "message") {
            config.subDetectType = "message";
            saveData();
            sendOptionalMessage("Sub detection set to message");
          }
          break;
        case "complete":
          const val = config.value % config.max;
          const max = subArgs[0] ? parseFloat(subArgs[0]) : config.max;
          setHypeMeter(val, max);
          break;
      }
    }
  }
}
function processHypeMeterChatMessage(data) {
  const message = data.payload.event.message.text.trim();
  const badges = data.payload.event.badges.map((badge) => badge.set_id);
  const username = data.payload.event.chatter_user_login;
  const bits = data.payload.event.cheer?.bits;
  let subTier = undefined;
  let subCount = undefined;
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
  } else if (data.payload.event.prime_paid_upgrade) {
    subTier = tierStringToLevel(data.payload.event.prime_paid_upgrade.sub_tier);
    subCount = 1;
    console.log(`PRIME PAID UPGRADE: ${subTier} ${subCount}`);
  }
  processHypeMeter(message, username, badges, bits, subTier, subCount);
}

// src/clip.ts
var clipPanel = document.querySelector(".clip");
var clipVideo = document.querySelector(".clipVideo");
var channelId;
function initClip(_channelId) {
  channelId = _channelId;
  clipPanel.style.display = "block";
  clipVideo.onended = () => {
    clipVideo.src = "";
  };
  window.chat = (message) => {
    processChatCommand(message, ["moderator"]);
  };
}
function getClipIdFromUrl(url) {
  const match = /^https:\/\/clips\.twitch\.tv\/(.*)$/i.exec(url);
  if (match) {
    return match[1];
  }
  const match2 = /^https:\/\/www\.twitch\.tv\/.*?\/clip\/(.*)$/i.exec(url);
  if (match2) {
    return match2[1];
  }
  return "";
}
var clipCache = {};
async function getClipIdFromUserId(userId) {
  console.log(`Getting clip for user ${userId}`);
  if (!clipCache[userId]) {
    clipCache[userId] = await getClips(userId);
  }
  const clips = clipCache[userId];
  const randomIndex = Math.floor(Math.random() * clips.length);
  return clips[randomIndex].id;
}
async function processChatCommand(message, badges) {
  const isModerator = badges.includes("moderator") || badges.includes("broadcaster");
  const [command, ...args] = message.split(" ");
  let isUrl = false;
  if (command === "!showclip" && isModerator) {
    let clipId = null;
    if (args[0]) {
      clipId = getClipIdFromUrl(args[0]);
      if (clipId) {
        isUrl = true;
      } else {
        let username = args[0];
        if (username.startsWith("@")) {
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
        console.log("Clip ID:", clipId);
        const clipUrl = `https://clips.twitch.tv/${clipId}`;
        console.log(clipUrl);
        await sendChatMessage(`Playing clip: ${clipUrl}`);
      }
      const videoUrl = await getClipStreamURL(clipId);
      clipVideo.src = videoUrl;
    }
  }
}
function processClipChatMessage(data) {
  const message = data.payload.event.message.text.trim();
  const badges = data.payload.event.badges.map((badge) => badge.set_id);
  processChatCommand(message, badges);
}

// src/app.ts
var errorPanel = document.querySelector(".errorPanel");
async function main() {
  try {
    const params = new URLSearchParams(window.location.search);
    const user_id = params.get("user_id");
    const channel = params.get("channel") ?? user_id;
    const token = params.get("token");
    const clientID = params.get("client_id");
    const widget = params.get("widget") ?? "hypemeter";
    let processChatMessage = undefined;
    if (widget === "hypemeter") {
      initHypeMeter();
      processChatMessage = processHypeMeterChatMessage;
    } else if (widget === "clip" && channel) {
      initClip(channel);
      processChatMessage = processClipChatMessage;
    }
    if (channel && user_id && token && clientID && processChatMessage) {
      await startBot({ processChatMessage, channel, user_id, token, clientID });
    } else {
      console.error("Invalid parameters. Chat bot will not start.");
    }
  } catch (err) {
    console.log(err);
    errorPanel.textContent = `${err}`;
    errorPanel.style.display = "block";
  }
}
main();
