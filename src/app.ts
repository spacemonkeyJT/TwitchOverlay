const hypemeter = document.querySelector<HTMLDivElement>('.hypemeter')!
const progressbar = document.querySelector<HTMLDivElement>('.progressbar')!
const label = document.querySelector<HTMLDivElement>('.label')!

const update = (percentComplete: number) => {
  progressbar.style.width = `${percentComplete}%`
  label.textContent = `${percentComplete}%`
}

update(50);

const params = new URLSearchParams(window.location.search);

const BOT_USER_ID = params.get('user_id')!; // This is the User ID of the chat bot
if (!BOT_USER_ID) throw Error('Missing user_id parameter.');

const OAUTH_TOKEN = params.get('token')!; // Needs scopes user:bot, user:read:chat, user:write:chat
if (!OAUTH_TOKEN) throw Error('Missing token parameter.');

const CLIENT_ID = params.get('client_id')!;
if (!CLIENT_ID) throw Error('Missing client_id parameter.');

const CHAT_CHANNEL_USER_ID = params.get('channel')!; // This is the User ID of the channel that the bot will join and listen to chat messages of
if (!CHAT_CHANNEL_USER_ID) throw Error('Missing channel parameter.');

const EVENTSUB_WEBSOCKET_URL = 'wss://eventsub.wss.twitch.tv/ws';

let websocketSessionID: string;

// Start executing the bot from here
(async () => {
  // Verify that the authentication is valid
  await getAuth();

  // Start WebSocket client and register handlers
  const websocketClient = startWebSocketClient();
})();

// WebSocket will persist the application loop until you exit the program forcefully

async function getAuth() {
  // https://dev.twitch.tv/docs/authentication/validate-tokens/#how-to-validate-a-token
  let response = await fetch('https://id.twitch.tv/oauth2/validate', {
    method: 'GET',
    headers: {
      'Authorization': 'OAuth ' + OAUTH_TOKEN
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
  let websocketClient = new WebSocket(EVENTSUB_WEBSOCKET_URL);

  console.log(websocketClient);

  websocketClient.addEventListener('error', console.error);

  websocketClient.addEventListener('open', () => {
    console.log('WebSocket connection opened to ' + EVENTSUB_WEBSOCKET_URL);
  });

  websocketClient.addEventListener('message', (msg) => {
    handleWebSocketMessage(JSON.parse(msg.data.toString()));
  });

  return websocketClient;
}

type MessageData = {
  metadata: {
    message_type: string;
    subscription_type: string
  };
  payload: {
    session: {
      id: string
    };
    event: {
      broadcaster_user_login: string;
      chatter_user_login: string;
      message: {
        text: string
      }
    }
  }
}

function handleWebSocketMessage(data: MessageData) {
  switch (data.metadata.message_type) {
    case 'session_welcome': // First message you get from the WebSocket server when connecting
      websocketSessionID = data.payload.session.id; // Register the Session ID it gives us
      // Listen to EventSub, which joins the chatroom from your bot's account
      registerEventSubListeners();
      break;
    case 'notification': // An EventSub notification has occurred, such as channel.chat.message
      switch (data.metadata.subscription_type) {
        case 'channel.chat.message':
          // First, print the message to the program's console.
          console.log(`MSG #${data.payload.event.broadcaster_user_login} <${data.payload.event.chatter_user_login}> ${data.payload.event.message.text}`);

          const message = data.payload.event.message.text.trim();

          if (message.startsWith('!supersecretcommand')) {
            const hypemeterValue = parseFloat(message.substring('!sethypemeter'.length).trim());
            update(hypemeterValue);
            sendChatMessage('Super secret command successful');
          }

          // Then check to see if that message was "HeyGuys"
          else if (data.payload.event.message.text.trim() == "HeyGuys") {
            // If so, send back "VoHiYo" to the chatroom
            // sendChatMessage("VoHiYo")
            update(50);
          }

          break;
      }
      break;
  }
}

async function sendChatMessage(chatMessage: string) {
  let response = await fetch('https://api.twitch.tv/helix/chat/messages', {
    method: 'POST',
    headers: {
      'Authorization': 'Bearer ' + OAUTH_TOKEN,
      'Client-Id': CLIENT_ID,
      'Content-Type': 'application/json'
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
  // Register channel.chat.message
  let response = await fetch('https://api.twitch.tv/helix/eventsub/subscriptions', {
    method: 'POST',
    headers: {
      'Authorization': 'Bearer ' + OAUTH_TOKEN,
      'Client-Id': CLIENT_ID,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      type: 'channel.chat.message',
      version: '1',
      condition: {
        broadcaster_user_id: CHAT_CHANNEL_USER_ID,
        user_id: BOT_USER_ID
      },
      transport: {
        method: 'websocket',
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