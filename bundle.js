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

// src/app.ts
var progressbar = document.querySelector(".progressbar");
var label = document.querySelector(".label");
var errorPanel = document.querySelector(".errorPanel");
function update(percentComplete) {
  progressbar.style.width = `${percentComplete}%`;
  label.textContent = `${percentComplete}%`;
}
function processChatMessage(data) {
  const message = data.payload.event.message.text.trim();
  let match = null;
  if (match = /^!sethypemeter\s+(\d+(?:\.\d+)?)$/i.exec(message)) {
    const hypemeterValue = parseFloat(match[1]);
    update(hypemeterValue);
    sendChatMessage("Hype meter set to " + hypemeterValue);
  }
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
    update(50);
  } catch (err) {
    console.log(err);
    errorPanel.textContent = `${err}`;
    errorPanel.style.display = "block";
  }
}
main();
