// src/twitch.ts
var params = new URLSearchParams(window.location.search);
var BOT_USER_ID = params.get("user_id");
if (!BOT_USER_ID)
  throw Error("Missing user_id parameter.");
var OAUTH_TOKEN = params.get("token");
if (!OAUTH_TOKEN)
  throw Error("Missing token parameter.");
var CLIENT_ID = params.get("client_id");
if (!CLIENT_ID)
  throw Error("Missing client_id parameter.");
var CHAT_CHANNEL_USER_ID = params.get("channel");
if (!CHAT_CHANNEL_USER_ID)
  throw Error("Missing channel parameter.");
var EVENTSUB_WEBSOCKET_URL = "wss://eventsub.wss.twitch.tv/ws";
var websocketSessionID;
var websocketClient;
var processChatMessage;
async function startBot(_processChatMessage) {
  processChatMessage = _processChatMessage;
  await getAuth();
  websocketClient = startWebSocketClient();
}
async function getAuth() {
  let response = await fetch("https://id.twitch.tv/oauth2/validate", {
    method: "GET",
    headers: {
      Authorization: "OAuth " + OAUTH_TOKEN
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
      switch (data.metadata.subscription_type) {
        case "channel.chat.message":
          console.log(`MSG #${data.payload.event.broadcaster_user_login} <${data.payload.event.chatter_user_login}> ${data.payload.event.message.text}`);
          processChatMessage(data);
          break;
      }
      break;
  }
}
async function sendChatMessage(chatMessage) {
  let response = await fetch("https://api.twitch.tv/helix/chat/messages", {
    method: "POST",
    headers: {
      Authorization: "Bearer " + OAUTH_TOKEN,
      "Client-Id": CLIENT_ID,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      broadcaster_id: CHAT_CHANNEL_USER_ID,
      sender_id: BOT_USER_ID,
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
      Authorization: "Bearer " + OAUTH_TOKEN,
      "Client-Id": CLIENT_ID,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      type: "channel.chat.message",
      version: "1",
      condition: {
        broadcaster_user_id: CHAT_CHANNEL_USER_ID,
        user_id: BOT_USER_ID
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

// src/app.ts
var progressbar = document.querySelector(".progressbar");
var label = document.querySelector(".label");
function update(percentComplete) {
  progressbar.style.width = `${percentComplete}%`;
  label.textContent = `${percentComplete}%`;
}
function processChatMessage2(data) {
  const message = data.payload.event.message.text.trim();
  let match = null;
  if (match = /^!sethypemeter\s+(\d+(?:\.\d+)?)$/i.exec(message)) {
    const hypemeterValue = parseFloat(match[1]);
    update(hypemeterValue);
    sendChatMessage("Hype meter set to " + hypemeterValue);
  }
}
async function main() {
  update(50);
  await startBot(processChatMessage2);
}
main().catch(console.error);