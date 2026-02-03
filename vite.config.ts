import tailwindcss from '@tailwindcss/vite';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig, type ViteDevServer } from 'vite';
import { WebSocketServer, type WebSocket } from 'ws';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { randomBytes } from 'crypto';
import { verifyMessage } from 'viem';

interface SignalingConfig {
	server: { port: number; wsPath: string; host: string };
	rooms: Array<{
		id: string;
		name: string;
		maxClients: number;
		routingMode: string;
		allowedMessageTypes: string[];
	}>;
	ipFilters: Array<{ pattern: string; type: string }>;
	connectionLimits: {
		maxConnectionsPerIP: number;
		maxTotalConnections: number;
		maxConnectionsPerRoom: number;
	};
	rateLimitRules: Array<{
		enabled: boolean;
		maxMessages: number;
		windowMs: number;
		messageTypes?: string[];
	}>;
	auth: {
		enabled: boolean;
		method?: string;
		allowAnonymous: boolean;
		anonymousPrefix?: string;
		serverPrivateKey?: string;
		handshakeMessage?: string;
		handshakeExpiry?: number;
	};
	logging: { level: string; logConnections: boolean; logMessages: boolean; logErrors: boolean };
}

interface ClientData {
	id: string;
	ip: string;
	roomId: string | null;
	userId: string | null;
	walletAddress: string | null;
	authenticated: boolean;
	connectedAt: number;
	messageCount: number;
	lastMessageAt: number | null;
}

interface PendingEthAuth {
	token: string;
	message: string;
	expiry: number;
}

function loadConfig(): SignalingConfig {
	const CONFIG_PATH = resolve('config/signaling.config.json');
	try {
		const configData = readFileSync(CONFIG_PATH, 'utf-8');
		console.log('[Config] Loaded configuration from', CONFIG_PATH);
		return JSON.parse(configData);
	} catch (error) {
		console.log('[Config] Using default configuration (config file not found)');
		return {
			server: { port: 6742, wsPath: '/ws', host: '0.0.0.0' },
			rooms: [],
			ipFilters: [],
			connectionLimits: {
				maxConnectionsPerIP: 10,
				maxTotalConnections: 1000,
				maxConnectionsPerRoom: 100
			},
			rateLimitRules: [],
			auth: { enabled: false, allowAnonymous: true, anonymousPrefix: 'anon_' },
			logging: { level: 'info', logConnections: true, logMessages: false, logErrors: true }
		};
	}
}

const webSocketServer = {
	name: 'webSocketServer',
	configureServer(server: ViteDevServer) {
		if (!server.httpServer) return;

		const config = loadConfig();
		const wsPath = config.server.wsPath || '/ws';

		// Client tracking
		const clients = new Map<WebSocket, ClientData>();
		const rooms = new Map<string, Set<WebSocket>>();
		const ipConnections = new Map<string, number>();
		const rateLimitTrackers = new Map<WebSocket, { messageTimestamps: number[] }>();
		const pendingEthAuth = new Map<WebSocket, PendingEthAuth>();

		// Ethereum handshake helpers
		function generateHandshakeToken(): string {
			const timestamp = Date.now();
			const nonce = randomBytes(16).toString('hex');
			return `${timestamp}:${nonce}`;
		}

		function createHandshakeMessage(token: string, customMessage?: string): string {
			const message = customMessage || 'Sign this to authenticate with the signaling server';
			return `${message}\n\nToken: ${token}`;
		}

		function sendEthereumHandshakeChallenge(ws: WebSocket) {
			const token = generateHandshakeToken();
			const message = createHandshakeMessage(token, config.auth.handshakeMessage);
			const expiry = Date.now() + (config.auth.handshakeExpiry || 300) * 1000;

			pendingEthAuth.set(ws, { token, message, expiry });

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

		async function verifyEthereumHandshake(
			ws: WebSocket,
			response: { signature?: string; address?: string }
		): Promise<{ valid: boolean; reason?: string; userId?: string; walletAddress?: string }> {
			const pending = pendingEthAuth.get(ws);
			if (!pending) {
				return { valid: false, reason: 'No pending handshake challenge' };
			}

			if (Date.now() > pending.expiry) {
				pendingEthAuth.delete(ws);
				return { valid: false, reason: 'Handshake challenge expired' };
			}

			const { signature, address } = response;

			if (!signature || !address) {
				return { valid: false, reason: 'Missing signature or address' };
			}

			if (!/^0x[a-fA-F0-9]{40}$/.test(address)) {
				return { valid: false, reason: 'Invalid Ethereum address format' };
			}

			if (!/^0x[a-fA-F0-9]{130}$/.test(signature)) {
				return { valid: false, reason: 'Invalid signature format' };
			}

			try {
				// Verify the signature using viem
				const isValid = await verifyMessage({
					address: address as `0x${string}`,
					message: pending.message,
					signature: signature as `0x${string}`
				});

				if (!isValid) {
					pendingEthAuth.delete(ws);
					return { valid: false, reason: 'Signature verification failed' };
				}

				pendingEthAuth.delete(ws);
				return { valid: true, userId: address.toLowerCase(), walletAddress: address.toLowerCase() };
			} catch (error) {
				log('error', 'Signature verification error:', error);
				pendingEthAuth.delete(ws);
				return { valid: false, reason: 'Signature verification error' };
			}
		}

		function isEthereumHandshakeEnabled(): boolean {
			return config.auth?.enabled && config.auth?.method === 'ethereum-handshake';
		}

		// Logging helper
		function log(level: string, message: string, ...args: unknown[]) {
			const levels: Record<string, number> = { debug: 0, info: 1, warn: 2, error: 3 };
			const configLevel = levels[config.logging?.level] ?? 1;
			const msgLevel = levels[level] ?? 1;

			if (msgLevel >= configLevel) {
				const prefix = `[${level.toUpperCase()}]`;
				console.log(prefix, message, ...args);
			}
		}

		// Generate anonymous ID
		function generateAnonymousId(): string {
			const prefix = config.auth?.anonymousPrefix || 'anon_';
			return `${prefix}${Math.random().toString(36).substring(2, 10)}`;
		}

		// Check rate limit
		function checkRateLimit(ws: WebSocket, messageType: string): boolean {
			if (!config.rateLimitRules || config.rateLimitRules.length === 0) {
				return true;
			}

			const now = Date.now();
			let tracker = rateLimitTrackers.get(ws);
			if (!tracker) {
				tracker = { messageTimestamps: [] };
				rateLimitTrackers.set(ws, tracker);
			}

			tracker.messageTimestamps = tracker.messageTimestamps.filter((ts) => now - ts < 60000);

			for (const rule of config.rateLimitRules) {
				if (!rule.enabled) continue;
				if (rule.messageTypes && rule.messageTypes.length > 0) {
					if (!rule.messageTypes.includes(messageType)) continue;
				}

				const windowStart = now - rule.windowMs;
				const messagesInWindow = tracker.messageTimestamps.filter((ts) => ts >= windowStart).length;

				if (messagesInWindow >= rule.maxMessages) {
					return false;
				}
			}

			tracker.messageTimestamps.push(now);
			return true;
		}

		// Room management
		function joinRoom(ws: WebSocket, roomId: string) {
			const clientData = clients.get(ws);
			if (!clientData) return;

			if (clientData.roomId) {
				leaveRoom(ws);
			}

			let room = config.rooms.find((r) => r.id === roomId);
			if (!room && config.rooms.length > 0) {
				room = config.rooms[0];
				roomId = room.id;
			}

			if (!rooms.has(roomId)) {
				rooms.set(roomId, new Set());
			}

			rooms.get(roomId)!.add(ws);
			clientData.roomId = roomId;
			log('debug', `Client ${clientData.id} joined room ${roomId}`);
		}

		function leaveRoom(ws: WebSocket) {
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
		function routeMessage(ws: WebSocket, message: string) {
			const clientData = clients.get(ws);
			if (!clientData) return;

			let parsedMessage: { type?: string; roomId?: string; targetId?: string };
			try {
				parsedMessage = JSON.parse(message);
			} catch {
				parsedMessage = { type: 'custom' };
			}

			const messageType = parsedMessage.type || 'custom';

			if (!checkRateLimit(ws, messageType)) {
				ws.send(JSON.stringify({ error: 'Rate limit exceeded', type: 'error' }));
				return;
			}

			if (messageType === 'join' && parsedMessage.roomId) {
				joinRoom(ws, parsedMessage.roomId);
				return;
			}

			if (messageType === 'leave') {
				leaveRoom(ws);
				return;
			}

			const roomConfig = config.rooms.find((r) => r.id === clientData.roomId);

			if (roomConfig?.allowedMessageTypes && !roomConfig.allowedMessageTypes.includes(messageType)) {
				ws.send(JSON.stringify({ error: `Message type '${messageType}' not allowed`, type: 'error' }));
				return;
			}

			const routingMode = roomConfig?.routingMode || 'broadcast';

			if (routingMode === 'unicast' && parsedMessage.targetId) {
				for (const [targetWs, targetData] of clients) {
					if (targetData.id === parsedMessage.targetId && targetWs.readyState === ws.OPEN) {
						targetWs.send(message);
						break;
					}
				}
			} else {
				const targetClients = clientData.roomId ? rooms.get(clientData.roomId) : clients.keys();

				if (targetClients) {
					for (const client of targetClients) {
						if (client !== ws && client.readyState === ws.OPEN) {
							client.send(message);
						}
					}
				}
			}

			clientData.messageCount++;
			clientData.lastMessageAt = Date.now();

			if (config.logging?.logMessages) {
				log('debug', `[WS] Message from ${clientData.id}: ${message.substring(0, 100)}`);
			}
		}

		// WebSocket server
		const wss = new WebSocketServer({ noServer: true });

		server.httpServer.on('upgrade', (request, socket, head) => {
			const url = new URL(request.url || '/', `http://${request.headers.host}`);

			if (url.pathname !== wsPath) {
				return; // Let Vite handle other upgrade requests (HMR)
			}

			const ip = request.socket.remoteAddress || 'unknown';

			// Check connection limits
			if (clients.size >= config.connectionLimits.maxTotalConnections) {
				log('warn', `Connection rejected: Server at capacity`);
				socket.write('HTTP/1.1 503 Service Unavailable\r\n\r\n');
				socket.destroy();
				return;
			}

			const ipCount = ipConnections.get(ip) || 0;
			if (ipCount >= config.connectionLimits.maxConnectionsPerIP) {
				log('warn', `Connection rejected: Too many connections from ${ip}`);
				socket.write('HTTP/1.1 503 Service Unavailable\r\n\r\n');
				socket.destroy();
				return;
			}

			wss.handleUpgrade(request, socket, head, (ws) => {
				(ws as WebSocket & { _clientIP: string })._clientIP = ip;
				wss.emit('connection', ws, request);
			});
		});

		wss.on('connection', (ws, req) => {
			const ip = (ws as WebSocket & { _clientIP?: string })._clientIP || req.socket.remoteAddress || 'unknown';
			const isPendingEthAuth = isEthereumHandshakeEnabled();
			const userId = isPendingEthAuth ? null : generateAnonymousId();
			const clientId = isPendingEthAuth ? `pending_${Date.now()}` : `${userId}_${Date.now()}`;

			const clientData: ClientData = {
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

			if (isPendingEthAuth) {
				sendEthereumHandshakeChallenge(ws);
				log('info', `[WS] Client connected (pending ethereum auth) from ${ip}`);
			} else {
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

				if (!clientData) return;

				// Handle ethereum handshake auth response
				if (!clientData.authenticated) {
					try {
						const parsed = JSON.parse(message);
						if (parsed.type === 'auth-response') {
							const result = await verifyEthereumHandshake(ws, parsed);

							if (result.valid) {
								clientData.authenticated = true;
								clientData.userId = result.userId!;
								clientData.walletAddress = result.walletAddress!;
								clientData.id = `${result.userId}_${Date.now()}`;

								ws.send(
									JSON.stringify({
										type: 'auth-success',
										address: result.walletAddress,
										clientId: clientData.id
									})
								);

								if (config.rooms.length > 0) {
									joinRoom(ws, config.rooms[0].id);
								}

								log('info', `[WS] Client authenticated via ethereum handshake: ${result.walletAddress}`);
							} else {
								ws.send(
									JSON.stringify({
										type: 'auth-failed',
										reason: result.reason
									})
								);
								log('warn', `[WS] Ethereum handshake failed: ${result.reason}`);
								ws.close(4001, result.reason);
							}
							return;
						}
					} catch {
						// Not a valid auth response
					}

					ws.send(
						JSON.stringify({
							type: 'error',
							error: 'Authentication required. Send auth-response with signature and address.'
						})
					);
					return;
				}

				routeMessage(ws, message);
			});

			ws.on('close', () => {
				const clientData = clients.get(ws);

				if (clientData) {
					leaveRoom(ws);

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

		log('info', `[WS] WebSocket server initialized at ${wsPath}`);
		log('info', `[Config] Rooms: ${config.rooms.length}, Rate Limits: ${config.rateLimitRules.length}`);
	}
};

export default defineConfig({
	plugins: [tailwindcss(), sveltekit(), webSocketServer],
	server: {
		port: 6742
	},
	preview: {
		port: 6742
	}
});
