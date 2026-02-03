# Ark Signaling Server

A WebRTC signaling server with Ethereum wallet authentication. Enables secure peer-to-peer WebRTC connections through cryptographic identity verification using EIP-191 message signing.

## Features

- **WebSocket-based signaling** for WebRTC offer/answer/ICE candidate exchange
- **Ethereum wallet authentication** using message signing (EIP-191)
- **Room-based routing** with configurable message types
- **Connection limits** per IP, per user, per room, and total
- **Rate limiting** with configurable rules per message type
- **IP filtering** with whitelist/blacklist support (CIDR notation)
- **Admin dashboard** for configuration management (optional)
- **Client demo** for testing connections

## Quick Start

```bash
# Install dependencies
pnpm install

# Start development server (with hot-reload)
pnpm dev

# Build for production
pnpm build

# Start production server
pnpm start
```

The server runs on `http://localhost:6742` by default:
- WebSocket endpoint: `ws://localhost:6742/ws`
- Admin dashboard: `http://localhost:6742/`
- Client demo: `http://localhost:6742/client`

## Ethereum Handshake Authentication

The server uses Ethereum wallet signatures to authenticate clients. This provides cryptographic proof of identity without requiring a centralized user database.

### Authentication Flow

```
1. Client connects to /ws
   ↓
2. Server sends auth-challenge
   {
     type: 'auth-challenge',
     method: 'ethereum-handshake',
     token: '1702123456789:a1b2c3d4...',
     message: 'Sign this to authenticate...\n\nToken: 1702123456789:a1b2c3d4...',
     expiry: 1702123756789
   }
   ↓
3. Client signs the message with their Ethereum private key
   ↓
4. Client sends auth-response
   {
     type: 'auth-response',
     signature: '0x...',  // 65-byte signature
     address: '0x...'     // Ethereum address
   }
   ↓
5. Server verifies signature using viem.verifyMessage()
   ↓
6. On success: Server sends auth-success, client joins default room
   On failure: Connection closed with code 4001
```

### Client Implementation Example

Using [viem](https://viem.sh/) to sign the authentication challenge:

```typescript
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts';

// Generate or load a wallet
const privateKey = localStorage.getItem('wallet-pk') || generatePrivateKey();
localStorage.setItem('wallet-pk', privateKey);

const account = privateKeyToAccount(privateKey);

// Connect to signaling server
const ws = new WebSocket('ws://localhost:6742/ws');

ws.onmessage = async (event) => {
  const msg = JSON.parse(event.data);

  if (msg.type === 'auth-challenge') {
    // Sign the challenge message
    const signature = await account.signMessage({ message: msg.message });

    // Send authentication response
    ws.send(JSON.stringify({
      type: 'auth-response',
      signature,
      address: account.address
    }));
  }

  if (msg.type === 'auth-success') {
    console.log('Authenticated as:', msg.address);
    // Now you can send/receive signaling messages
  }
};
```

## WebSocket Message Protocol

### Client → Server Messages

```typescript
// WebRTC Signaling
{ type: 'offer', data: RTCSessionDescriptionInit, targetId?: string }
{ type: 'answer', data: RTCSessionDescriptionInit, targetId?: string }
{ type: 'ice-candidate', data: RTCIceCandidateInit, targetId?: string }

// Room Management
{ type: 'join', roomId: string }
{ type: 'leave' }

// Custom Messages (for app-specific communication)
{
  type: 'custom',
  subtype: string,      // e.g., 'chat', 'peer-announce'
  data: any,
  targetId?: string     // Optional: unicast to specific client
}
```

### Server → Client Messages

```typescript
// Authentication
{ type: 'auth-challenge', method: string, token: string, message: string, expiry: number }
{ type: 'auth-success', address: string, clientId: string }
{ type: 'auth-failed', reason: string }

// Errors
{ type: 'error', error: string }

// Forwarded messages from other clients include sender info
{
  type: 'custom',
  subtype: 'chat',
  data: { content: 'Hello!' },
  senderId: 'user_...',
  senderAddress: '0x...',
  timestamp: 1234567890
}
```

## Configuration

Configuration is stored in `config/signaling.config.json`. The admin dashboard provides a UI for editing these settings.

### Server Settings

```json
{
  "server": {
    "port": 6742,
    "wsPath": "/ws",
    "host": "0.0.0.0"
  }
}
```

### Authentication Settings

```json
{
  "auth": {
    "enabled": true,
    "method": "ethereum-handshake",
    "allowAnonymous": false,
    "handshakeMessage": "Sign this to authenticate with the signaling server",
    "handshakeExpiry": 300
  }
}
```

| Option | Description |
|--------|-------------|
| `enabled` | Enable/disable authentication |
| `method` | Authentication method (`ethereum-handshake`) |
| `allowAnonymous` | Allow unauthenticated connections |
| `handshakeMessage` | Message prefix for signing |
| `handshakeExpiry` | Challenge expiry in seconds |

### Connection Limits

```json
{
  "connectionLimits": {
    "maxConnectionsPerIP": 10,
    "maxConnectionsPerUser": 5,
    "maxConnectionsPerRoom": 100,
    "maxTotalConnections": 1000
  }
}
```

### Rate Limiting

```json
{
  "rateLimitRules": [
    {
      "id": "default-rate-limit",
      "name": "Default Rate Limit",
      "scope": "per-client",
      "maxMessages": 100,
      "windowMs": 1000,
      "enabled": true,
      "messageTypes": []
    }
  ]
}
```

### Room Configuration

```json
{
  "rooms": [
    {
      "id": "default",
      "name": "Default Room",
      "maxClients": 100,
      "routingMode": "broadcast",
      "allowedMessageTypes": ["offer", "answer", "ice-candidate", "join", "leave", "custom"]
    }
  ]
}
```

### IP Filtering

```json
{
  "ipFilters": [
    { "pattern": "192.168.1.0/24", "type": "whitelist", "description": "Local network" },
    { "pattern": "10.0.0.0/8", "type": "blacklist", "description": "Block internal" }
  ]
}
```

### WebRTC ICE Configuration

The server provides ICE server configuration to clients (informational):

```json
{
  "webrtc": {
    "iceServers": [
      { "id": "google-stun", "urls": ["stun:stun.l.google.com:19302"] }
    ],
    "iceCandidatePoolSize": 10,
    "bundlePolicy": "balanced"
  }
}
```

## Environment Variables

Create a `.env` file (see `.env.example`):

```bash
# Disable UI for signaling-only mode
DISABLE_UI=false

# Override server port
PORT=6742
```

### Signaling-Only Mode

Run the server without the admin UI for reduced resource usage:

```bash
DISABLE_UI=true pnpm start
```

In this mode:
- All HTTP routes return 503
- Only `/ws` WebSocket endpoint is active
- Lower memory footprint

## Production Deployment

### Using PM2

The repository includes an `ecosystem.config.cjs` for PM2:

```bash
# Install PM2 globally
npm install -g pm2

# Start with PM2
pm2 start ecosystem.config.cjs

# Save process list
pm2 save

# Setup startup script
pm2 startup
```

### Behind a Reverse Proxy (nginx)

For HTTPS/WSS support, use a reverse proxy:

```nginx
server {
    listen 443 ssl;
    server_name signaling.example.com;

    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;

    location /ws {
        proxy_pass http://127.0.0.1:6742;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_read_timeout 86400;
    }

    location / {
        proxy_pass http://127.0.0.1:6742;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

## API Endpoints

### Configuration API

```
GET  /api/signaling/config     # Get current configuration
POST /api/signaling/config     # Update configuration (requires server restart)
```

## Development

```bash
# Run tests
pnpm test

# Run tests with UI
pnpm test:ui

# Type checking
pnpm check

# Linting
pnpm lint

# Format code
pnpm format
```

## Architecture

```
┌─────────────────────────────────────────────┐
│              HTTP Server                     │
│  (SvelteKit UI + API routes)                │
└──────────────────┬──────────────────────────┘
                   │
       ┌───────────┴────────────┐
       ▼                        ▼
┌──────────────┐         ┌─────────────────┐
│  WebSocket   │         │   API Routes    │
│  Server      │         │  /api/signaling │
│  /ws         │         │                 │
└──────┬───────┘         └─────────────────┘
       │
       ├── IP Filtering
       ├── Connection Limits
       ├── Ethereum Auth Challenge/Response
       ├── Room Management
       ├── Rate Limiting
       └── Message Routing (broadcast/unicast)
```

## Tech Stack

- **Backend**: Node.js, [ws](https://github.com/websockets/ws) (WebSocket library)
- **Frontend**: SvelteKit, Tailwind CSS, DaisyUI
- **Authentication**: [viem](https://viem.sh/) (Ethereum library for signature verification)
- **Build**: Vite, TypeScript

## License

MIT
