import type { ID } from '$types/core.type';

// ============ Enums ============

export enum RoutingMode {
	Broadcast = 'broadcast',
	Unicast = 'unicast',
	Multicast = 'multicast'
}

export enum MessageType {
	Offer = 'offer',
	Answer = 'answer',
	IceCandidate = 'ice-candidate',
	Join = 'join',
	Leave = 'leave',
	Custom = 'custom'
}

export enum IPFilterType {
	Whitelist = 'whitelist',
	Blacklist = 'blacklist'
}

export enum RateLimitScope {
	Global = 'global',
	PerClient = 'per-client',
	PerRoom = 'per-room',
	PerIP = 'per-ip'
}

export enum AuthMethod {
	None = 'none',
	Token = 'token',
	Basic = 'basic',
	EthereumHandshake = 'ethereum-handshake'
}

export enum LogLevel {
	Debug = 'debug',
	Info = 'info',
	Warn = 'warn',
	Error = 'error'
}

// ============ Room Types ============

export interface Room {
	id: ID;
	name: string;
	description?: string;
	maxClients: number;
	isPrivate: boolean;
	password?: string;
	routingMode: RoutingMode;
	allowedMessageTypes: MessageType[];
	createdAt: string;
}

// ============ Client Filtering Types ============

export interface IPFilter {
	id: ID;
	pattern: string;
	type: IPFilterType;
	description?: string;
	createdAt: string;
}

export interface ConnectionLimits {
	maxConnectionsPerIP: number;
	maxConnectionsPerUser: number;
	maxConnectionsPerRoom: number;
	maxTotalConnections: number;
}

// ============ Rate Limiting Types ============

export interface RateLimitRule {
	id: ID;
	name: string;
	scope: RateLimitScope;
	maxMessages: number;
	windowMs: number;
	messageTypes?: MessageType[];
	enabled: boolean;
}

// ============ Authentication Types ============

export interface AuthConfig {
	enabled: boolean;
	method: AuthMethod;
	tokenSecret?: string;
	tokenExpiry?: number;
	allowAnonymous: boolean;
	anonymousPrefix?: string;
	// Ethereum Handshake specific fields
	serverPrivateKey?: string;
	handshakeMessage?: string;
	handshakeExpiry?: number;
}

// ============ WebRTC Configuration Types ============

export interface ICEServer {
	id: ID;
	urls: string[];
	username?: string;
	credential?: string;
}

export interface ICECandidateFilter {
	allowHost: boolean;
	allowSrflx: boolean;
	allowPrflx: boolean;
	allowRelay: boolean;
	allowIPv6: boolean;
}

export interface WebRTCConfig {
	iceServers: ICEServer[];
	iceCandidatePoolSize: number;
	bundlePolicy: 'balanced' | 'max-compat' | 'max-bundle';
	iceTransportPolicy: 'all' | 'relay';
	candidateFilter: ICECandidateFilter;
}

// ============ Server Configuration Types ============

export interface ServerConfig {
	port: number;
	wsPath: string;
	host: string;
}

export interface LoggingConfig {
	level: LogLevel;
	logConnections: boolean;
	logMessages: boolean;
	logErrors: boolean;
}

// ============ Master Configuration Type ============

export interface SignalingConfig {
	id: ID;
	version: string;
	server: ServerConfig;
	rooms: Room[];
	ipFilters: IPFilter[];
	connectionLimits: ConnectionLimits;
	rateLimitRules: RateLimitRule[];
	auth: AuthConfig;
	webrtc: WebRTCConfig;
	logging: LoggingConfig;
	updatedAt: string;
}

// ============ API Response Types ============

export interface APIResponse<T> {
	success: boolean;
	data?: T;
	error?: string;
	timestamp: string;
}

// ============ Default Values ============

export const DEFAULT_CONNECTION_LIMITS: ConnectionLimits = {
	maxConnectionsPerIP: 10,
	maxConnectionsPerUser: 5,
	maxConnectionsPerRoom: 100,
	maxTotalConnections: 1000
};

export const DEFAULT_AUTH_CONFIG: AuthConfig = {
	enabled: true,
	method: AuthMethod.EthereumHandshake,
	allowAnonymous: false,
	anonymousPrefix: 'anon_',
	handshakeMessage: 'Sign this to authenticate with the signaling server',
	handshakeExpiry: 300
};

export const DEFAULT_ICE_CANDIDATE_FILTER: ICECandidateFilter = {
	allowHost: true,
	allowSrflx: true,
	allowPrflx: true,
	allowRelay: true,
	allowIPv6: true
};

export const DEFAULT_WEBRTC_CONFIG: WebRTCConfig = {
	iceServers: [],
	iceCandidatePoolSize: 10,
	bundlePolicy: 'balanced',
	iceTransportPolicy: 'all',
	candidateFilter: DEFAULT_ICE_CANDIDATE_FILTER
};

export const DEFAULT_LOGGING_CONFIG: LoggingConfig = {
	level: LogLevel.Info,
	logConnections: true,
	logMessages: false,
	logErrors: true
};

export const DEFAULT_SERVER_CONFIG: ServerConfig = {
	port: 6742,
	wsPath: '/ws',
	host: '0.0.0.0'
};
