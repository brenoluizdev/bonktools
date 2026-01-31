const { createBot, LOG_LEVELS } = require("bonktools");
// const { createBot, LOG_LEVELS } = require("../src/index");


// Create a bot instance
const bot = createBot({
	account: {
		username: "FUTHERO BOT",
		password: "$futheroroomsbot025",
		guest: false,
	},
	PROTOCOL_VERSION: 49,
	server: "b2brazil1",
	logLevel: LOG_LEVELS.WARN,
});

// Handle ready event
bot.events.on("ready", async () => {
	console.log("Bot is ready!");

	// Connect to the server
	await bot.connect()

	await bot.createRoom({
		roomname: "🔥 FUTHERO | X2 | FUTSAL 🔥",
		maxplayers: 8,
		roompassword: "0102030405",
		hidden: false
	});
});

// Handle connect event
bot.events.on("ready", function() {
	bot.events.on("ROOM_SHARE_LINK", () => {
		console.log(`Bot created room!\nURL: ${bot.getShareLink()}`);
	})

	// Set up packet handler
	bot.events.on("PACKET", function(packet) {
		bot.autoHandlePacket(packet);
	});

	// Handle chat messages
	bot.events.on("CHAT_MESSAGE", function(message) {
		console.log(message.player.username + ": " + message.message);

		// Check for players command
		if (message.message === "!players") {
			var players = bot.getAllPlayers(true);
			var playerNames = [];

			for (var i = 0; i < players.length; i++) {
				playerNames.push(players[i].username);
			}

			bot.chat("Players online (" + players.length + "): " + playerNames.join(", "));
		}
	});
});

// Initialize the bot
bot.init().catch((error) => {
	console.error("Failed to initialize bot:", error);
});