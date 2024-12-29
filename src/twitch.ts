
const EVENTSUB_WEBSOCKET_URL = 'wss://eventsub.wss.twitch.tv/ws';

let websocketSessionID: string;
let websocketClient: WebSocket;

export type Options = {
  processChatMessage: (data: MessageData) => unknown;
  
  /** This is the User ID of the chat bot */
  user_id: string;
  
  /** Needs scopes user:bot, user:read:chat, user:write:chat */
  token: string;

  /** This is the User ID of the channel that the bot will join and listen to chat messages of */
  channel: string;

  /** Application client ID */
  clientID: string;
}

let options: Options;

export async function startBot(_options: Options) {
  options = _options;

  // Start executing the bot from here
  // Verify that the authentication is valid
  await getAuth();

  // Start WebSocket client and register handlers
  websocketClient = startWebSocketClient();
}

async function getAuth() {
  // https://dev.twitch.tv/docs/authentication/validate-tokens/#how-to-validate-a-token
  let response = await fetch('https://id.twitch.tv/oauth2/validate', {
    method: 'GET',
    headers: {
      'Authorization': 'OAuth ' + options.token
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

export type MessageData = {
  metadata: {
    message_id: string;
    message_timestamp: string;
    message_type: string;
    subscription_type: string;
    subscription_version: string;
  };
  payload: {
    session: {
      id: string
    };
    event: {
      badges: {
        id: string;
        info: string;
        set_id: string;
      }[];
      broadcaster_user_id: string;
      broadcaster_user_login: string;
      broadcaster_user_name: string;
      channel_points_animation_id: string;
      channel_points_custom_reward_id: string;
      chatter_user_id: string;
      chatter_user_login: string;
      chatter_user_name: string;
      cheer: {
        bits: number;
      } | null;
      color: string;
      message: {
        fragments: any[];
        text: string
      };
      message_id: string;
      message_type: string;
      reply: any;
      source_badges: any;
      source_broadcaster_user_id: any;
      source_broadcaster_user_login: any;
      source_broadcaster_user_name: any;
      source_message_id: any;
    },
    subscription: any;
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
      console.log(data);
      switch (data.metadata.subscription_type) {
        case 'channel.chat.message':
          // First, print the message to the program's console.
          console.log(`MSG #${data.payload.event.broadcaster_user_login} <${data.payload.event.chatter_user_login}> ${data.payload.event.message.text}`);

          options.processChatMessage(data);

          break;
      }
      break;
  }
}

export async function sendChatMessage(chatMessage: string) {
  if (options) {
    let response = await fetch('https://api.twitch.tv/helix/chat/messages', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + options.token,
        'Client-Id': options.clientID,
        'Content-Type': 'application/json'
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
  // Register channel.chat.message
  let response = await fetch('https://api.twitch.tv/helix/eventsub/subscriptions', {
    method: 'POST',
    headers: {
      'Authorization': 'Bearer ' + options.token,
      'Client-Id': options.clientID,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      type: 'channel.chat.message',
      version: '1',
      condition: {
        broadcaster_user_id: options.channel,
        user_id: options.user_id
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
