import type { ID } from '$types/core.type';

// ============ Connection States ============

export enum ConnectionState {
	Disconnected = 'disconnected',
	Connecting = 'connecting',
	Authenticating = 'authenticating',
	Connected = 'connected',
	Error = 'error'
}

// ============ Peer Types ============

export interface Peer {
	id: ID;
	address: string;
	clientId: string;
	joinedAt: number;
}

// ============ Message Types ============

export interface ChatMessage {
	id: ID;
	senderId: string;
	senderAddress: string;
	content: string;
	timestamp: number;
	isOwn: boolean;
}

// ============ Auth Challenge ============

export interface AuthChallenge {
	type: 'auth-challenge';
	method: 'ethereum-handshake';
	token: string;
	message: string;
	expiry: number;
}

export interface AuthResponse {
	type: 'auth-response';
	signature: string;
	address: string;
}

export interface AuthSuccess {
	type: 'auth-success';
	address: string;
	clientId: string;
}

export interface AuthFailed {
	type: 'auth-failed';
	reason: string;
}

// ============ Signaling Messages ============

export interface CustomMessage {
	type: 'custom';
	subtype: 'chat' | 'peer-list-request' | 'peer-announce';
	data: unknown;
	senderId?: string;
	senderAddress?: string;
	timestamp?: number;
}

export interface ErrorMessage {
	type: 'error';
	error: string;
}

export type SignalingMessage =
	| AuthChallenge
	| AuthSuccess
	| AuthFailed
	| CustomMessage
	| ErrorMessage;

// ============ Client State ============

export interface ClientState {
	connectionState: ConnectionState;
	walletAddress: string | null;
	clientId: string | null;
	roomId: string | null;
	peers: Peer[];
	messages: ChatMessage[];
	error: string | null;
}

