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
      console.log(data);
      switch (data.metadata.subscription_type) {
        case "channel.chat.message":
          console.log(`MSG #${data.payload.event.broadcaster_user_login} <${data.payload.event.chatter_user_login}> ${data.payload.event.message.text}`);
          options.processChatMessage(data);
          break;
      }
      break;
  }
}
async function sendChatMessage(chatMessage) {
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
}

// src/hypemeter.ts
var progressbar = document.querySelector(".progressbar");
var label = document.querySelector(".label");
var defaults = {
  value: 50,
  max: 300,
  bitsRate: 0.0112,
  subTier1Rate: 3.5,
  subTier2Rate: 7,
  subTier3Rate: 17.5
};
var meter = { ...defaults };
function saveData() {
  localStorage.setItem("hypemeter", JSON.stringify(meter));
}
function loadData() {
  try {
    const json = localStorage.getItem("hypemeter");
    if (json) {
      const data = JSON.parse(json);
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
function setHypeMeter(value, max) {
  meter.value = value;
  if (max !== undefined) {
    meter.max = max;
  }
  saveData();
  updateHypeMeter();
}
function initHypeMeter() {
  loadData();
  updateHypeMeter();
}
function applySubs(count, tier) {
  const rate = tier === 1 ? meter.subTier1Rate : tier === 2 ? meter.subTier2Rate : meter.subTier3Rate;
  const val = Math.min(meter.value + rate * count, meter.max);
  setHypeMeter(val);
  saveData();
  sendChatMessage("Hype meter set to $" + val.toFixed(2));
}
function applyBits(bits) {
  const val = Math.min(meter.value + meter.bitsRate * bits, meter.max);
  setHypeMeter(val);
  saveData();
  sendChatMessage("Hype meter set to $" + val.toFixed(2));
}
function processHypeMeter(data) {
  const message = data.payload.event.message.text.trim();
  const badges = data.payload.event.badges.map((badge) => badge.set_id);
  const isModerator = badges.includes("moderator") || badges.includes("broadcaster");
  const [command, ...args] = message.split(" ");
  const { cheer } = data.payload.event;
  const { chatter_user_login } = data.payload.event;
  if (cheer) {
    applyBits(cheer.bits);
  }
  if (chatter_user_login === "streamlabs") {
    let match;
    if (match = /^(.*) just gifted (\d+) Tier (\d+) subscriptions!$/.exec(message)) {
      const count = parseInt(match[2]);
      const tier = parseInt(match[3]);
      applySubs(count, tier);
    } else if (match = /^(.*) just subscribed with Twitch Prime!$/.exec(message)) {
      applySubs(1, 1);
    }
  }
  if (isModerator) {
    if ((command === "!sethypemeter" || command === "!sethm") && args[0]) {
      const val = parseFloat(args[0]);
      const max = args[1] ? parseFloat(args[1]) : meter.max;
      if (val >= 0 && val <= max) {
        setHypeMeter(val, max);
        sendChatMessage("Hype meter set to $" + val.toFixed(2));
      }
    } else if (command === "!hm") {
      const subCommand = args[0];
      const subArgs = args.slice(1);
      switch (subCommand) {
        case "set":
          if (subArgs[0]) {
            const val = parseFloat(subArgs[0]);
            const max = subArgs[1] ? parseFloat(subArgs[1]) : meter.max;
            if (val >= 0 && val <= max) {
              setHypeMeter(val, max);
              sendChatMessage("Hype meter set to $" + val.toFixed(2));
            }
          }
          break;
        case "reload":
          location.reload();
          break;
        case "bitsrate":
          if (subArgs[0]) {
            const val = parseFloat(subArgs[0]);
            if (val > 0) {
              meter.bitsRate = val;
              saveData();
              sendChatMessage("Hype meter bits rate set to $" + val.toFixed(2));
            }
          }
          break;
        case "subrate1":
          if (subArgs[0]) {
            const val = parseFloat(subArgs[0]);
            if (val > 0) {
              meter.subTier1Rate = val;
              saveData();
              sendChatMessage("Hype meter sub tier 1 rate set to $" + val.toFixed(2));
            }
          }
          break;
        case "subrate2":
          if (subArgs[0]) {
            const val = parseFloat(subArgs[0]);
            if (val > 0) {
              meter.subTier2Rate = val;
              saveData();
              sendChatMessage("Hype meter sub tier 2 rate set to $" + val.toFixed(2));
            }
          }
          break;
        case "subrate3":
          if (subArgs[0]) {
            const val = parseFloat(subArgs[0]);
            if (val > 0) {
              meter.subTier3Rate = val;
              saveData();
              sendChatMessage("Hype meter sub tier 3 rate set to $" + val.toFixed(2));
            }
          }
          break;
        case "config":
          sendChatMessage(`Hype meter bits rate: $${meter.bitsRate}, sub tier 1 rate: $${meter.subTier1Rate}, sub tier 2 rate: $${meter.subTier2Rate}, sub tier 3 rate: $${meter.subTier3Rate}`);
          break;
        case "reset":
          Object.assign(meter, defaults);
          updateHypeMeter();
          saveData();
          sendChatMessage("Hype meter reset");
          break;
        case "simbits":
          if (subArgs[0]) {
            const val = parseFloat(subArgs[0]);
            if (val > 0) {
              applyBits(val);
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
      }
    }
  }
}

// src/app.ts
var errorPanel = document.querySelector(".errorPanel");
function processChatMessage(data) {
  processHypeMeter(data);
}
async function main() {
  try {
    const params = new URLSearchParams(window.location.search);
    const options2 = {
      processChatMessage,
      channel: params.get("channel"),
      user_id: params.get("user_id"),
      token: params.get("token"),
      clientID: params.get("client_id")
    };
    if (!options2.user_id)
      throw Error("Missing user_id parameter.");
    if (!options2.token)
      throw Error("Missing token parameter.");
    if (!options2.clientID)
      throw Error("Missing client_id parameter.");
    if (!options2.channel)
      throw Error("Missing channel parameter.");
    await startBot(options2);
    initHypeMeter();
  } catch (err) {
    console.log(err);
    errorPanel.textContent = `${err}`;
    errorPanel.style.display = "block";
  }
}
main();
