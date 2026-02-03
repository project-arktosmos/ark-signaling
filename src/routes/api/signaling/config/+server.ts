import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import fs from 'fs/promises';
import path from 'path';
import type { SignalingConfig, APIResponse } from '$types/signaling.type';

const CONFIG_PATH = path.resolve('config/signaling.config.json');

export const GET: RequestHandler = async () => {
	try {
		const configData = await fs.readFile(CONFIG_PATH, 'utf-8');
		const config: SignalingConfig = JSON.parse(configData);

		const response: APIResponse<SignalingConfig> = {
			success: true,
			data: config,
			timestamp: new Date().toISOString()
		};

		return json(response);
	} catch (error) {
		const response: APIResponse<SignalingConfig> = {
			success: false,
			error: error instanceof Error ? error.message : 'Failed to load configuration',
			timestamp: new Date().toISOString()
		};

		return json(response, { status: 500 });
	}
};

export const PUT: RequestHandler = async ({ request }) => {
	try {
		const config: SignalingConfig = await request.json();

		// Update the timestamp
		config.updatedAt = new Date().toISOString();

		// Write config to file with pretty formatting
		await fs.writeFile(CONFIG_PATH, JSON.stringify(config, null, '\t'), 'utf-8');

		const response: APIResponse<SignalingConfig> = {
			success: true,
			data: config,
			timestamp: new Date().toISOString()
		};

		return json(response);
	} catch (error) {
		const response: APIResponse<SignalingConfig> = {
			success: false,
			error: error instanceof Error ? error.message : 'Failed to save configuration',
			timestamp: new Date().toISOString()
		};

		return json(response, { status: 500 });
	}
};
