import { writable, type Writable, get } from 'svelte/store';
import { browser } from '$app/environment';
import {
	ConnectionState,
	type ClientState,
	type Peer,
	type ChatMessage,
	type AuthChallenge,
	type SignalingMessage
} from '$types/client.type';
import { walletAuthService } from './wallet-auth.service';

const DEFAULT_WS_URL = 'ws://localhost:6742/ws';

class SignalingClientService {
	store: Writable<ClientState>;
	private ws: WebSocket | null = null;
	private reconnectAttempts = 0;
	private maxReconnectAttempts = 5;
	private reconnectTimeout: ReturnType<typeof setTimeout> | null = null;

	constructor() {
		this.store = writable<ClientState>({
			connectionState: ConnectionState.Disconnected,
			walletAddress: null,
			clientId: null,
			roomId: null,
			peers: [],
			messages: [],
			error: null
		});
	}

	async connect(url: string = DEFAULT_WS_URL): Promise<void> {
		if (!browser) return;

		const address = walletAuthService.getAddress();
		if (!address) {
			const connected = await walletAuthService.connect();
			if (!connected) {
				this.store.update((s) => ({
					...s,
					connectionState: ConnectionState.Error,
					error: 'Wallet connection required'
				}));
				return;
			}
		}

		this.store.update((s) => ({
			...s,
			connectionState: ConnectionState.Connecting,
			error: null
		}));

		try {
			this.ws = new WebSocket(url);
			this.setupEventListeners();
		} catch (err) {
			const message = err instanceof Error ? err.message : 'WebSocket connection failed';
			this.store.update((s) => ({
				...s,
				connectionState: ConnectionState.Error,
				error: message
			}));
		}
	}

	disconnect(): void {
		if (this.reconnectTimeout) {
			clearTimeout(this.reconnectTimeout);
			this.reconnectTimeout = null;
		}

		if (this.ws) {
			this.ws.close(1000, 'User disconnected');
			this.ws = null;
		}

		this.store.update((s) => ({
			...s,
			connectionState: ConnectionState.Disconnected,
			clientId: null,
			roomId: null,
			peers: [],
			error: null
		}));

		this.reconnectAttempts = 0;
	}

	broadcast(content: string): void {
		if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
			console.error('[WS] WebSocket not connected');
			return;
		}

		const state = get(this.store);
		if (state.connectionState !== ConnectionState.Connected) {
			console.error('[WS] Not authenticated');
			return;
		}

		const message = {
			type: 'custom',
			subtype: 'chat',
			data: { content },
			senderId: state.clientId,
			senderAddress: state.walletAddress,
			timestamp: Date.now()
		};

		this.ws.send(JSON.stringify(message));

		const chatMessage: ChatMessage = {
			id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
			senderId: state.clientId!,
			senderAddress: state.walletAddress!,
			content,
			timestamp: Date.now(),
			isOwn: true
		};

		this.store.update((s) => ({
			...s,
			messages: [...s.messages, chatMessage]
		}));
	}

	clearMessages(): void {
		this.store.update((s) => ({ ...s, messages: [] }));
	}

	private setupEventListeners(): void {
		if (!this.ws) return;

		this.ws.onopen = () => {
			console.log('[WS] Connected - awaiting auth challenge');
			this.reconnectAttempts = 0;
			this.store.update((s) => ({
				...s,
				connectionState: ConnectionState.Authenticating
			}));
		};

		this.ws.onmessage = (event) => {
			this.handleMessage(event.data);
		};

		this.ws.onclose = (event) => {
			console.log('[WS] Connection closed:', event.code, event.reason);
			this.ws = null;

			if (event.code === 1000 || event.code === 4001) {
				this.store.update((s) => ({
					...s,
					connectionState: ConnectionState.Disconnected
				}));
				return;
			}

			this.attemptReconnect();
		};

		this.ws.onerror = (error) => {
			console.error('[WS] Error:', error);
			this.store.update((s) => ({
				...s,
				error: 'WebSocket error occurred'
			}));
		};
	}

	private async handleMessage(data: string): Promise<void> {
		try {
			const message = JSON.parse(data) as SignalingMessage;

			switch (message.type) {
				case 'auth-challenge':
					await this.handleAuthChallenge(message as AuthChallenge);
					break;

				case 'auth-success':
					this.handleAuthSuccess(message);
					break;

				case 'auth-failed':
					this.handleAuthFailed(message);
					break;

				case 'custom':
					this.handleCustomMessage(message);
					break;

				case 'error':
					this.store.update((s) => ({ ...s, error: message.error }));
					break;

				default:
					console.log('[WS] Unhandled message type:', message);
			}
		} catch (err) {
			console.error('[WS] Failed to parse message:', err);
		}
	}

	private async handleAuthChallenge(challenge: AuthChallenge): Promise<void> {
		console.log('[Auth] Received challenge, signing...');

		const signature = await walletAuthService.signMessage(challenge.message);
		if (!signature) {
			this.store.update((s) => ({
				...s,
				connectionState: ConnectionState.Error,
				error: 'Failed to sign authentication message'
			}));
			this.disconnect();
			return;
		}

		const address = walletAuthService.getAddress();
		if (!address) {
			this.store.update((s) => ({
				...s,
				connectionState: ConnectionState.Error,
				error: 'Wallet address not available'
			}));
			this.disconnect();
			return;
		}

		const authResponse = {
			type: 'auth-response',
			signature,
			address
		};

		this.ws?.send(JSON.stringify(authResponse));
		console.log('[Auth] Sent auth response');
	}

	private handleAuthSuccess(message: { address: string; clientId: string }): void {
		console.log('[Auth] Authentication successful:', message.clientId);

		this.store.update((s) => ({
			...s,
			connectionState: ConnectionState.Connected,
			walletAddress: message.address,
			clientId: message.clientId,
			error: null
		}));

		// Announce ourselves and request existing peers
		this.announcePeer();
		this.requestPeerList();
	}

	private handleAuthFailed(message: { reason: string }): void {
		console.error('[Auth] Authentication failed:', message.reason);

		this.store.update((s) => ({
			...s,
			connectionState: ConnectionState.Error,
			error: `Authentication failed: ${message.reason}`
		}));
	}

	private handleCustomMessage(message: {
		subtype: string;
		data: unknown;
		senderId?: string;
		senderAddress?: string;
		timestamp?: number;
	}): void {
		switch (message.subtype) {
			case 'chat':
				this.handleChatMessage(message);
				break;

			case 'peer-announce':
				this.handlePeerAnnounce(message);
				break;

			case 'peer-list-request':
				// Another peer is requesting the peer list, respond with our announcement
				this.announcePeer();
				break;

			default:
				console.log('[WS] Unknown custom subtype:', message.subtype);
		}
	}

	private handleChatMessage(message: {
		data: unknown;
		senderId?: string;
		senderAddress?: string;
		timestamp?: number;
	}): void {
		const data = message.data as { content: string };
		const state = get(this.store);

		if (message.senderId === state.clientId) {
			return;
		}

		const chatMessage: ChatMessage = {
			id: `${message.timestamp || Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
			senderId: message.senderId || 'unknown',
			senderAddress: message.senderAddress || 'unknown',
			content: data.content,
			timestamp: message.timestamp || Date.now(),
			isOwn: false
		};

		this.store.update((s) => ({
			...s,
			messages: [...s.messages, chatMessage]
		}));
	}

	private handlePeerAnnounce(message: {
		data: unknown;
		senderId?: string;
		senderAddress?: string;
	}): void {
		const data = message.data as { address: string; clientId: string };
		const state = get(this.store);

		if (data.clientId === state.clientId) return;

		const peer: Peer = {
			id: data.clientId,
			address: data.address,
			clientId: data.clientId,
			joinedAt: Date.now()
		};

		this.store.update((s) => {
			const exists = s.peers.some((p) => p.clientId === peer.clientId);
			if (exists) return s;

			return {
				...s,
				peers: [...s.peers, peer]
			};
		});
	}

	private announcePeer(): void {
		if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;

		const state = get(this.store);
		if (!state.clientId || !state.walletAddress) return;

		const announcement = {
			type: 'custom',
			subtype: 'peer-announce',
			data: {
				address: state.walletAddress,
				clientId: state.clientId
			}
		};

		this.ws.send(JSON.stringify(announcement));
	}

	private requestPeerList(): void {
		if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;

		const request = {
			type: 'custom',
			subtype: 'peer-list-request',
			data: {}
		};

		this.ws.send(JSON.stringify(request));
		console.log('[WS] Requested peer list');
	}

	private attemptReconnect(): void {
		if (this.reconnectAttempts >= this.maxReconnectAttempts) {
			this.store.update((s) => ({
				...s,
				connectionState: ConnectionState.Error,
				error: 'Max reconnection attempts reached'
			}));
			return;
		}

		this.reconnectAttempts++;
		const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000);

		console.log(`[WS] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts})`);

		this.store.update((s) => ({
			...s,
			connectionState: ConnectionState.Connecting
		}));

		this.reconnectTimeout = setTimeout(() => {
			this.connect();
		}, delay);
	}
}

export const signalingClientService = new SignalingClientService();
