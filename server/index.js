import 'dotenv/config';
import { createServer } from 'http';
import { WebSocketServer } from 'ws';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { randomBytes } from 'crypto';
import { verifyMessage } from 'viem';

// Check if UI should be disabled (signaling-only mode)
const DISABLE_UI = process.env.DISABLE_UI === 'true';

// Conditionally import SvelteKit handler
let handler = null;
if (!DISABLE_UI) {
	handler = (await import('../build/handler.js')).handler;
}

function generateHandshakeToken() {
	const timestamp = Date.now();
	const nonce = randomBytes(16).toString('hex');
	return `${timestamp}:${nonce}`;
}

function createHandshakeMessage(token, customMessage) {
	const message = customMessage || 'Sign this to authenticate with the signaling server';
	return `${message}\n\nToken: ${token}`;
}

// Pending ethereum auth tracking
const pendingEthAuth = new Map(); // ws -> { token, expiry, message }

// Load configuration
const CONFIG_PATH = resolve('config/signaling.config.json');
let config;

try {
	const configData = readFileSync(CONFIG_PATH, 'utf-8');
	config = JSON.parse(configData);
	console.log('[Config] Loaded configuration from', CONFIG_PATH);
} catch (error) {
	console.error('[Config] Failed to load configuration:', error.message);
	console.log('[Config] Using default configuration');
	config = {
		server: { port: 6742, wsPath: '/ws', host: '0.0.0.0' },
		rooms: [],
		ipFilters: [],
		connectionLimits: {
			maxConnectionsPerIP: 10,
			maxConnectionsPerUser: 5,
			maxConnectionsPerRoom: 100,
			maxTotalConnections: 1000
		},
		rateLimitRules: [],
		auth: { enabled: false, allowAnonymous: true },
		logging: { level: 'info', logConnections: true, logMessages: false, logErrors: true }
	};
}

const port = process.env.PORT || config.server.port || 6742;
const wsPath = config.server.wsPath || '/ws';

// Client tracking
const clients = new Map(); // ws -> { id, ip, roomId, userId, connectedAt, messageCount, lastMessageAt }
const rooms = new Map(); // roomId -> Set<ws>
const ipConnections = new Map(); // ip -> count
const rateLimitTrackers = new Map(); // ws -> { messageTimestamps: number[] }

// Logging helper
function log(level, message, ...args) {
	const levels = { debug: 0, info: 1, warn: 2, error: 3 };
	const configLevel = levels[config.logging?.level] ?? 1;
	const msgLevel = levels[level] ?? 1;

	if (msgLevel >= configLevel) {
		const prefix = `[${level.toUpperCase()}]`;
		if (level === 'error') {
			console.error(prefix, message, ...args);
		} else {
			console.log(prefix, message, ...args);
		}
	}
}

// IP filtering
function isIPAllowed(ip) {
	if (!config.ipFilters || config.ipFilters.length === 0) {
		return true;
	}

	const whitelists = config.ipFilters.filter((f) => f.type === 'whitelist');
	const blacklists = config.ipFilters.filter((f) => f.type === 'blacklist');

	// If there are whitelists, IP must match at least one
	if (whitelists.length > 0) {
		const isWhitelisted = whitelists.some((f) => matchIP(ip, f.pattern));
		if (!isWhitelisted) {
			return false;
		}
	}

	// Check blacklists
	const isBlacklisted = blacklists.some((f) => matchIP(ip, f.pattern));
	return !isBlacklisted;
}

function matchIP(ip, pattern) {
	// Simple IP matching (supports exact match and basic CIDR)
	if (pattern === ip) return true;

	// CIDR matching
	if (pattern.includes('/')) {
		const [network, bits] = pattern.split('/');
		const mask = ~(2 ** (32 - parseInt(bits)) - 1);
		const ipNum = ipToNumber(ip);
		const networkNum = ipToNumber(network);
		return (ipNum & mask) === (networkNum & mask);
	}

	return false;
}

function ipToNumber(ip) {
	// Handle IPv4 only for now
	if (ip.startsWith('::ffff:')) {
		ip = ip.substring(7);
	}
	const parts = ip.split('.');
	if (parts.length !== 4) return 0;
	return parts.reduce((acc, part) => (acc << 8) + parseInt(part), 0);
}

// Connection limits
function checkConnectionLimits(ip, roomId) {
	const limits = config.connectionLimits;

	// Check total connections
	if (clients.size >= limits.maxTotalConnections) {
		return { allowed: false, reason: 'Server at capacity' };
	}

	// Check per-IP limit
	const ipCount = ipConnections.get(ip) || 0;
	if (ipCount >= limits.maxConnectionsPerIP) {
		return { allowed: false, reason: 'Too many connections from this IP' };
	}

	// Check per-room limit
	if (roomId) {
		const roomClients = rooms.get(roomId);
		if (roomClients && roomClients.size >= limits.maxConnectionsPerRoom) {
			return { allowed: false, reason: 'Room is full' };
		}
	}

	return { allowed: true };
}

// Rate limiting
function checkRateLimit(ws, messageType) {
	if (!config.rateLimitRules || config.rateLimitRules.length === 0) {
		return true;
	}

	const now = Date.now();
	let tracker = rateLimitTrackers.get(ws);
	if (!tracker) {
		tracker = { messageTimestamps: [] };
		rateLimitTrackers.set(ws, tracker);
	}

	// Clean old timestamps
	tracker.messageTimestamps = tracker.messageTimestamps.filter((ts) => now - ts < 60000);

	for (const rule of config.rateLimitRules) {
		if (!rule.enabled) continue;

		// Check if rule applies to this message type
		if (rule.messageTypes && rule.messageTypes.length > 0) {
			if (!rule.messageTypes.includes(messageType)) continue;
		}

		// Count messages in the window
		const windowStart = now - rule.windowMs;
		const messagesInWindow = tracker.messageTimestamps.filter((ts) => ts >= windowStart).length;

		if (messagesInWindow >= rule.maxMessages) {
			return false;
		}
	}

	// Record this message
	tracker.messageTimestamps.push(now);
	return true;
}

// Authentication
function validateAuth(request) {
	if (!config.auth?.enabled) {
		return { valid: true, userId: generateAnonymousId() };
	}

	if (config.auth.allowAnonymous) {
		return { valid: true, userId: generateAnonymousId() };
	}

	// Token-based auth
	if (config.auth.method === 'token') {
		const url = new URL(request.url, `http://${request.headers.host}`);
		const token = url.searchParams.get('token');

		if (!token) {
			return { valid: false, reason: 'No token provided' };
		}

		// In a real implementation, you would validate the token here
		// For now, just accept any non-empty token
		return { valid: true, userId: `user_${token.substring(0, 8)}` };
	}

	// Ethereum handshake - allow connection but mark as pending auth
	if (config.auth.method === 'ethereum-handshake') {
		return { valid: true, userId: null, pendingEthereumAuth: true };
	}

	return { valid: true, userId: generateAnonymousId() };
}

// Send ethereum handshake challenge to client
function sendEthereumHandshakeChallenge(ws) {
	const token = generateHandshakeToken();
	const message = createHandshakeMessage(token, config.auth.handshakeMessage);
	const expiry = Date.now() + (config.auth.handshakeExpiry || 300) * 1000;

	// Store pending auth state
	pendingEthAuth.set(ws, { token, message, expiry });

	// Send challenge to client
	const challenge = {
		type: 'auth-challenge',
		method: 'ethereum-handshake',
		token,
		message,
		expiry
	};

	ws.send(JSON.stringify(challenge));
	log('debug', `Sent ethereum handshake challenge to client`);
}

// Verify ethereum handshake response from client
async function verifyEthereumHandshake(ws, response) {
	const pending = pendingEthAuth.get(ws);
	if (!pending) {
		return { valid: false, reason: 'No pending handshake challenge' };
	}

	// Check expiry
	if (Date.now() > pending.expiry) {
		pendingEthAuth.delete(ws);
		return { valid: false, reason: 'Handshake challenge expired' };
	}

	const { signature, address } = response;

	if (!signature || !address) {
		return { valid: false, reason: 'Missing signature or address' };
	}

	// Validate address format
	if (!/^0x[a-fA-F0-9]{40}$/.test(address)) {
		return { valid: false, reason: 'Invalid Ethereum address format' };
	}

	// Validate signature format (65 bytes = 0x + 130 hex chars)
	if (!/^0x[a-fA-F0-9]{130}$/.test(signature)) {
		return { valid: false, reason: 'Invalid signature format' };
	}

	try {
		// Verify the signature using viem
		const isValid = await verifyMessage({
			address,
			message: pending.message,
			signature
		});

		if (!isValid) {
			pendingEthAuth.delete(ws);
			return { valid: false, reason: 'Signature verification failed' };
		}

		pendingEthAuth.delete(ws);
		return { valid: true, userId: address.toLowerCase(), walletAddress: address.toLowerCase() };
	} catch (error) {
		log('error', 'Signature verification error:', error.message);
		pendingEthAuth.delete(ws);
		return { valid: false, reason: 'Signature verification error' };
	}
}

function generateAnonymousId() {
	const prefix = config.auth?.anonymousPrefix || 'anon_';
	return `${prefix}${Math.random().toString(36).substring(2, 10)}`;
}

// Room management
function joinRoom(ws, roomId) {
	const clientData = clients.get(ws);
	if (!clientData) return;

	// Leave current room if any
	if (clientData.roomId) {
		leaveRoom(ws);
	}

	// Find or validate room
	let room = config.rooms.find((r) => r.id === roomId);
	if (!room && config.rooms.length > 0) {
		// Use default room
		room = config.rooms[0];
		roomId = room.id;
	}

	if (!rooms.has(roomId)) {
		rooms.set(roomId, new Set());
	}

	rooms.get(roomId).add(ws);
	clientData.roomId = roomId;

	log('debug', `Client ${clientData.id} joined room ${roomId}`);
}

function leaveRoom(ws) {
	const clientData = clients.get(ws);
	if (!clientData || !clientData.roomId) return;

	const roomClients = rooms.get(clientData.roomId);
	if (roomClients) {
		roomClients.delete(ws);
		if (roomClients.size === 0) {
			rooms.delete(clientData.roomId);
		}
	}

	log('debug', `Client ${clientData.id} left room ${clientData.roomId}`);
	clientData.roomId = null;
}

// Message routing
function routeMessage(ws, message) {
	const clientData = clients.get(ws);
	if (!clientData) return;

	let parsedMessage;
	try {
		parsedMessage = JSON.parse(message);
	} catch {
		// If not JSON, broadcast raw message
		parsedMessage = { type: 'custom', data: message };
	}

	const messageType = parsedMessage.type || 'custom';

	// Check rate limit
	if (!checkRateLimit(ws, messageType)) {
		ws.send(JSON.stringify({ error: 'Rate limit exceeded', type: 'error' }));
		return;
	}

	// Handle special message types
	if (messageType === 'join' && parsedMessage.roomId) {
		joinRoom(ws, parsedMessage.roomId);
		return;
	}

	if (messageType === 'leave') {
		leaveRoom(ws);
		return;
	}

	// Find room config
	const roomConfig = config.rooms.find((r) => r.id === clientData.roomId);

	// Check if message type is allowed
	if (roomConfig?.allowedMessageTypes && !roomConfig.allowedMessageTypes.includes(messageType)) {
		ws.send(JSON.stringify({ error: `Message type '${messageType}' not allowed in this room`, type: 'error' }));
		return;
	}

	// Get routing mode
	const routingMode = roomConfig?.routingMode || 'broadcast';

	// Route message based on mode
	if (routingMode === 'unicast' && parsedMessage.targetId) {
		// Send to specific client
		for (const [targetWs, targetData] of clients) {
			if (targetData.id === parsedMessage.targetId && targetWs.readyState === ws.OPEN) {
				targetWs.send(message);
				break;
			}
		}
	} else {
		// Broadcast to room or all clients
		const targetClients = clientData.roomId ? rooms.get(clientData.roomId) : clients.keys();

		if (targetClients) {
			for (const client of targetClients) {
				if (client !== ws && client.readyState === ws.OPEN) {
					client.send(message);
				}
			}
		}
	}

	// Update client stats
	clientData.messageCount++;
	clientData.lastMessageAt = Date.now();

	if (config.logging?.logMessages) {
		log('debug', `[WS] Message from ${clientData.id}: ${message.substring(0, 100)}`);
	}
}

// When UI is disabled, respond with JSON status for all HTTP requests
function disabledUIHandler(req, res) {
	res.writeHead(503, { 'Content-Type': 'application/json' });
	res.end(
		JSON.stringify({
			status: 'signaling-only',
			message: 'UI is disabled. WebSocket signaling available at /ws',
			wsPath: wsPath
		})
	);
}

// Server setup
const server = createServer(DISABLE_UI ? disabledUIHandler : handler);
const wss = new WebSocketServer({ noServer: true });

server.on('upgrade', (request, socket, head) => {
	const url = new URL(request.url, `http://${request.headers.host}`);

	if (url.pathname !== wsPath) {
		socket.destroy();
		return;
	}

	const ip = request.socket.remoteAddress;

	// Check IP filter
	if (!isIPAllowed(ip)) {
		log('warn', `Connection rejected: IP ${ip} is filtered`);
		socket.write('HTTP/1.1 403 Forbidden\r\n\r\n');
		socket.destroy();
		return;
	}

	// Check connection limits
	const limitCheck = checkConnectionLimits(ip);
	if (!limitCheck.allowed) {
		log('warn', `Connection rejected: ${limitCheck.reason}`);
		socket.write('HTTP/1.1 503 Service Unavailable\r\n\r\n');
		socket.destroy();
		return;
	}

	// Validate authentication
	const authResult = validateAuth(request);
	if (!authResult.valid) {
		log('warn', `Connection rejected: ${authResult.reason}`);
		socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
		socket.destroy();
		return;
	}

	wss.handleUpgrade(request, socket, head, (ws) => {
		// Store auth result for use in connection handler
		ws._authResult = authResult;
		ws._clientIP = ip;
		wss.emit('connection', ws, request);
	});
});

wss.on('connection', (ws, req) => {
	const ip = ws._clientIP;
	const authResult = ws._authResult;
	const isPendingEthAuth = authResult?.pendingEthereumAuth === true;
	const userId = isPendingEthAuth ? null : (authResult?.userId || generateAnonymousId());
	const clientId = isPendingEthAuth ? `pending_${Date.now()}` : `${userId}_${Date.now()}`;

	// Track connection
	const clientData = {
		id: clientId,
		ip,
		roomId: null,
		userId,
		walletAddress: null,
		authenticated: !isPendingEthAuth,
		connectedAt: Date.now(),
		messageCount: 0,
		lastMessageAt: null
	};

	clients.set(ws, clientData);
	ipConnections.set(ip, (ipConnections.get(ip) || 0) + 1);

	// If pending ethereum auth, send challenge
	if (isPendingEthAuth) {
		sendEthereumHandshakeChallenge(ws);
		log('info', `[WS] Client connected (pending ethereum auth) from ${ip}`);
	} else {
		// Auto-join default room if exists and authenticated
		if (config.rooms.length > 0) {
			joinRoom(ws, config.rooms[0].id);
		}

		if (config.logging?.logConnections) {
			log('info', `[WS] Client connected: ${clientId} from ${ip}`);
		}
	}

	ws.on('message', async (data) => {
		const message = data.toString();
		const clientData = clients.get(ws);

		// Handle ethereum handshake auth response
		if (!clientData.authenticated) {
			try {
				const parsed = JSON.parse(message);
				if (parsed.type === 'auth-response') {
					const result = await verifyEthereumHandshake(ws, parsed);

					if (result.valid) {
						// Update client data with authenticated info
						clientData.authenticated = true;
						clientData.userId = result.userId;
						clientData.walletAddress = result.walletAddress;
						clientData.id = `${result.userId}_${Date.now()}`;

						// Send success response
						ws.send(JSON.stringify({
							type: 'auth-success',
							address: result.walletAddress,
							clientId: clientData.id
						}));

						// Auto-join default room
						if (config.rooms.length > 0) {
							joinRoom(ws, config.rooms[0].id);
						}

						log('info', `[WS] Client authenticated via ethereum handshake: ${result.walletAddress}`);
					} else {
						// Send failure response and close connection
						ws.send(JSON.stringify({
							type: 'auth-failed',
							reason: result.reason
						}));
						log('warn', `[WS] Ethereum handshake failed: ${result.reason}`);
						ws.close(4001, result.reason);
					}
					return;
				}
			} catch {
				// Not a valid auth response
			}

			// Non-auth messages from unauthenticated clients are rejected
			ws.send(JSON.stringify({
				type: 'error',
				error: 'Authentication required. Send auth-response with signature and address.'
			}));
			return;
		}

		routeMessage(ws, message);
	});

	ws.on('close', () => {
		const clientData = clients.get(ws);

		if (clientData) {
			leaveRoom(ws);

			// Update IP connection count
			const ipCount = ipConnections.get(clientData.ip) || 1;
			if (ipCount <= 1) {
				ipConnections.delete(clientData.ip);
			} else {
				ipConnections.set(clientData.ip, ipCount - 1);
			}

			if (config.logging?.logConnections) {
				log('info', `[WS] Client disconnected: ${clientData.id}`);
			}
		}

		clients.delete(ws);
		rateLimitTrackers.delete(ws);
		pendingEthAuth.delete(ws);
	});

	ws.on('error', (error) => {
		if (config.logging?.logErrors) {
			log('error', '[WS] Error:', error);
		}
	});
});

server.listen(port, config.server.host || '0.0.0.0', () => {
	if (DISABLE_UI) {
		log('info', '[Server] UI DISABLED - Running in signaling-only mode');
	}
	log('info', `[Server] Running on http://localhost:${port}`);
	log('info', `[WS] WebSocket server ready at ${wsPath}`);
	log('info', `[Config] Rooms: ${config.rooms.length}, IP Filters: ${config.ipFilters.length}, Rate Limits: ${config.rateLimitRules.length}`);
});
