# 🎮 BonkTools v2.0

[![npm version](https://img.shields.io/npm/v/bonktools.svg)](https://www.npmjs.com/package/bonktools)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.3-blue.svg)](https://www.typescriptlang.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

> Advanced Bonk.io bot library with physics simulation and game state management

BonkTools is a powerful TypeScript library for creating automated bots for Bonk.io. Unlike other libraries, BonkTools includes a **Box2D physics simulator** that allows you to detect game events like player deaths, round endings, and collisions in real-time.

## ✨ Features

- 🔌 **WebSocket Connection Management** - Stable connection with automatic reconnection
- ⚡ **Box2D Physics Simulation** - Replicate game physics locally to detect events
- 🎯 **Game State Tracking** - Full awareness of game state (rounds, scores, players)
- 🎭 **Event-Driven Architecture** - React to any game event with TypeScript events
- 🛠️ **Room Management** - Create, join, and manage rooms programmatically
- 👥 **Player Management** - Track all players, their states, and positions
- 🎪 **Host Controls** - Start/stop games, kick players, change settings
- 📝 **TypeScript Native** - Full type safety and IntelliSense support
- 🧪 **Tested & Reliable** - Built on proven Bonkbot foundation

## 📦 Installation

```bash
npm install bonktools
```

## 🚀 Quick Start

### Simple Bot Example

```typescript
import { createBot } from 'bonktools';

// Create bot
const bot = createBot({
  account: {
    username: 'MyBot',
    guest: true
  },
  logLevel: 'info'
});

// Initialize and connect
await bot.init();
await bot.connect();

// Join a room
await bot.joinRoomByUrl('https://bonk.io/123456');

// Send a message
await bot.chat('Hello from BonkTools! 🎮');

// Listen for events
bot.on('chatMessage', (player, message) => {
  console.log(`${player.username}: ${message}`);
});
```

### Host Bot Example

```typescript
import { createBot } from 'bonktools';

const bot = createBot({
  account: {
    username: 'HostBot',
    guest: true
  }
});

await bot.init();
await bot.connect();

// Create a room
const room = await bot.createRoom({
  roomName: 'My Tournament Room',
  maxPlayers: 4,
  mode: 'classic'
});

console.log('Room created:', room.shareLink);

// Detect when round ends (using physics simulation!)
bot.on('roundEnd', ({ winner, scores }) => {
  console.log(`Winner: ${winner.username}`);
  console.log('Scores:', scores);
  
  // Auto-restart in 3 seconds
  setTimeout(() => bot.startGame(), 3000);
});

// Detect player deaths
bot.on('playerDeath', (player, position) => {
  console.log(`${player.username} died at (${position.x}, ${position.y})`);
});

// Start when all ready
bot.on('allPlayersReady', () => {
  bot.startGame();
});
```

## 📚 API Reference

### Core Methods

#### `init(): Promise<BonkTools>`
Initialize the bot (get auth token, server info)

#### `connect(): Promise<BonkTools>`
Connect to Bonk.io server

#### `disconnect(): void`
Disconnect from server

### Room Management

#### `createRoom(options: RoomOptions): Promise<RoomInfo>`
Create a new room

```typescript
const room = await bot.createRoom({
  roomName: 'My Room',
  maxPlayers: 4,
  password: 'secret',
  mode: 'classic',
  hidden: false
});
```

#### `joinRoom(address: string, password?: string): Promise<void>`
Join room by address code

```typescript
await bot.joinRoom('123456', 'password');
```

#### `joinRoomByUrl(url: string): Promise<void>`
Join room by full URL

```typescript
await bot.joinRoomByUrl('https://bonk.io/123456');
```

#### `leaveRoom(): Promise<void>`
Leave current room

### Game Control

#### `startGame(): Promise<void>`
Start the game (host only)

#### `stopGame(): Promise<void>`
Stop/abort current game (host only)

#### `setRounds(rounds: number): Promise<void>`
Set number of rounds to win (1-999)

```typescript
await bot.setRounds(5);
```

#### `setReady(ready: boolean): Promise<void>`
Set bot ready status

```typescript
await bot.setReady(true);
```

### Player Management

#### `getPlayer(id: number): PlayerData | null`
Get player by ID

#### `getPlayerByUsername(username: string, guest?: boolean): PlayerData | null`
Get player by username

#### `getAllPlayers(): PlayerData[]`
Get all players in room

#### `getHost(): PlayerData | null`
Get current host player

#### `isHost(): boolean`
Check if bot is host

#### `kickPlayer(playerId: number): Promise<void>`
Kick a player (host only)

#### `giveHost(playerId: number): Promise<void>`
Transfer host to another player (host only)

#### `joinTeam(team: number): Promise<void>`
Join a team (0=spectate, 1=FFA, 2-6=teams)

#### `lockTeams(locked: boolean): Promise<void>`
Lock/unlock teams (host only)

### Chat

#### `chat(message: string): Promise<void>`
Send a chat message (max 200 chars)

```typescript
await bot.chat('Hello everyone! 👋');
```

### Utility

#### `getShareLink(): string | null`
Get room share link

#### `getRoomInfo(): RoomInfo`
Get current room information

#### `getMyId(): number`
Get bot's player ID

#### `isReady(): boolean`
Check if bot is initialized

#### `isConnected(): boolean`
Check if bot is connected

#### `getGameState(): any`
Get current game state (if physics is running)

## 🎭 Events

BonkTools uses TypeScript's EventEmitter for type-safe events:

### Connection Events

```typescript
bot.on('ready', () => {
  console.log('Bot initialized');
});

bot.on('connect', () => {
  console.log('Connected to server');
});

bot.on('disconnect', (reason) => {
  console.log('Disconnected:', reason);
});

bot.on('error', (error) => {
  console.error('Error:', error);
});
```

### Room Events

```typescript
bot.on('roomCreated', (room) => {
  console.log('Room created:', room.shareLink);
});

bot.on('roomJoined', ({ game, room, players }) => {
  console.log('Joined room:', room.name);
});
```

### Player Events

```typescript
bot.on('playerJoin', (player) => {
  console.log(`${player.username} joined`);
});

bot.on('playerLeave', (player) => {
  console.log(`${player.username} left`);
});

bot.on('playerReady', (player, ready) => {
  console.log(`${player.username} is ${ready ? 'ready' : 'not ready'}`);
});

bot.on('allPlayersReady', () => {
  console.log('All players ready!');
});

bot.on('playerTeamChange', (player, team) => {
  console.log(`${player.username} joined team ${team}`);
});

bot.on('playerKick', (player) => {
  console.log(`${player.username} was kicked`);
});
```

### Game Events

```typescript
bot.on('gameStart', () => {
  console.log('Game started!');
});

bot.on('gameEnd', (result) => {
  console.log('Game ended!');
  console.log('Champion:', result.champion?.username);
});

bot.on('roundStart', (roundNumber) => {
  console.log(`Round ${roundNumber} started`);
});

bot.on('roundEnd', (result) => {
  console.log('Round ended!');
  console.log('Winner:', result.winner?.username);
  console.log('Scores:', result.scores);
  console.log('Duration:', result.duration);
});

bot.on('countdown', (seconds) => {
  console.log(`Starting in ${seconds}...`);
});
```

### Physics Events (⚡ New!)

These events are powered by the Box2D physics simulator:

```typescript
bot.on('playerDeath', (player, position) => {
  console.log(`${player.username} died at (${position.x}, ${position.y})`);
});

bot.on('collision', (event) => {
  console.log('Collision detected:', event.type);
  console.log('Player:', event.playerId);
  console.log('Position:', event.position);
});

bot.on('playerOutOfBounds', (player) => {
  console.log(`${player.username} went out of bounds`);
});
```

### Chat Events

```typescript
bot.on('chatMessage', (player, message) => {
  console.log(`${player.username}: ${message}`);
  
  // Respond to commands
  if (message === '!help') {
    bot.chat('Available commands: !help, !placar');
  }
});
```

### Host Events

```typescript
bot.on('hostTransfer', (oldHost, newHost) => {
  console.log(`Host transferred from ${oldHost.username} to ${newHost.username}`);
});

bot.on('teamLockToggle', (locked) => {
  console.log(`Teams ${locked ? 'locked' : 'unlocked'}`);
});

bot.on('roundsChange', (rounds) => {
  console.log(`Rounds changed to ${rounds}`);
});

bot.on('gamemodeChange', (mode, engine) => {
  console.log(`Mode changed to ${mode} (${engine})`);
});
```

### Map Events

```typescript
bot.on('mapSwitch', (map) => {
  console.log('Map changed:', map.m.n); // map name
});

bot.on('mapSuggest', ({ title, author, player }) => {
  console.log(`${player.username} suggested map: ${title} by ${author}`);
});
```

## 🎯 Advanced Usage

### Tournament Bot

```typescript
import { createBot } from 'bonktools';

const bot = createBot({ /* ... */ });
await bot.init();
await bot.connect();

const room = await bot.createRoom({
  roomName: '🏆 Tournament - Round 1',
  maxPlayers: 8,
  mode: 'arrows'
});

const scores = new Map<string, number>();
let matchCount = 0;
const maxMatches = 10;

bot.on('roundEnd', ({ winner }) => {
  if (winner) {
    scores.set(winner.username, (scores.get(winner.username) || 0) + 1);
  }
  
  matchCount++;
  
  if (matchCount >= maxMatches) {
    // Tournament ended
    const champion = Array.from(scores.entries())
      .sort((a, b) => b[1] - a[1])[0];
    
    bot.chat(`🏆 Tournament Champion: ${champion[0]}!`);
    
    // Show leaderboard
    const leaderboard = Array.from(scores.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([name, score], i) => `${i+1}. ${name}: ${score}`)
      .join(' | ');
    
    bot.chat(`📊 Final: ${leaderboard}`);
  } else {
    // Next match
    setTimeout(() => bot.startGame(), 5000);
  }
});
```

### Custom Command System

```typescript
const commands = {
  '!help': () => bot.chat('Commands: !help, !score, !stats'),
  
  '!score': () => {
    const players = bot.getAllPlayers();
    const scoreText = players
      .map(p => `${p.username}: ${p.balance}`)
      .join(' | ');
    bot.chat(`📊 ${scoreText}`);
  },
  
  '!stats': () => {
    const players = bot.getAllPlayers();
    bot.chat(`👥 Players: ${players.length}`);
    bot.chat(`🎮 Round: ${currentRound}/${maxRounds}`);
  }
};

bot.on('chatMessage', (player, message) => {
  const command = commands[message.toLowerCase()];
  if (command) {
    command();
  }
});
```

## 🔧 Configuration

### BonkToolsOptions

```typescript
interface BonkToolsOptions {
  account: {
    username: string;
    password?: string;  // For non-guest accounts
    guest?: boolean;    // Default: true
  };
  server?: string;      // Default: auto-detect best server
  avatar?: Avatar;      // Custom avatar
  logLevel?: LogLevel;  // 'debug' | 'info' | 'warn' | 'error' | 'none'
  protocolVersion?: number; // Default: 49
  peerID?: string;      // Custom peer ID (auto-generated if not provided)
}
```

### RoomOptions

```typescript
interface RoomOptions {
  roomName?: string;
  maxPlayers?: number;  // 1-8
  password?: string;
  hidden?: boolean;
  quick?: boolean;
  mode?: 'classic' | 'arrows' | 'grapple' | 'death arrows' | 'simple' | 'vtol';
  minLevel?: number;    // 0-999
  maxLevel?: number;    // 0-999
}
```

## 🏗️ Architecture

BonkTools is built on a modular architecture:

```
BonkTools (Main API)
├── BonkConnection (WebSocket layer)
│   ├── PacketParser
│   └── PacketBuilder
├── PhysicsWorld (Box2D simulation)
│   ├── GameState
│   ├── CollisionDetector
│   └── InputProcessor
├── GameLoop (60 FPS game loop)
├── RoomManager
└── PlayerManager
```

The key innovation is the **PhysicsWorld** module, which:
1. Receives player inputs from the server
2. Simulates the game physics using Box2D
3. Detects collisions, deaths, and round endings
4. Emits events for your bot to react to

This allows BonkTools to have awareness of the game state that's impossible with just WebSocket packets alone.

## 🤝 Contributing

Contributions are welcome! Please read our [Contributing Guide](CONTRIBUTING.md) first.

## 📝 License

MIT © OBL

## 🙏 Acknowledgments

- Built on [Bonkbot](https://github.com/PixelMelt/BonkBot) by PixelMelt
- Physics powered by [Box2D](https://box2d.org/)
- Inspired by the Brazilian Bonk.io community

## 📞 Support

- GitHub Issues: [github.com/brenoluizdev/bonktools/issues](https://github.com/brenoluizdev/bonktools/issues)
- Discord: [Join our Discord](https://discord.gg/dBVmaySqEk)

---

Made with ❤️ for the Bonk.io community


[![npm version](https://img.shields.io/npm/v/bonktools.svg?color=blue)](https://www.npmjs.com/package/bonktools)
[![license](https://img.shields.io/github/license/brenoluizdev/bonktools.svg)](https://github.com/brenoluizdev/bonktools/blob/main/LICENSE)
[![GitHub Repo stars](https://img.shields.io/github/stars/brenoluizdev/bonktools?style=social)](https://github.com/brenoluizdev/bonktools)
