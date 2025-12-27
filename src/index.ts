import { DurableObject } from 'cloudflare:workers';
import twilio from 'twilio';
import { createNewResponse, TwilioClient } from './services/twilio';
import { SubscriberRepository, Subscriber } from './repositories/subscribers';

const STOP_WORDS = ['stop'];
const SUBSCRIBE_WORDS = ['start'];

export default {
	/**
	 * This is the standard fetch handler for a Cloudflare Worker
	 *
	 * @param request - The request submitted to the Worker from the client
	 * @param env - The interface to reference bindings declared in wrangler.jsonc
	 * @param ctx - The execution context of the Worker
	 * @returns The response to be sent back to the client
	 */
	async fetch(request: Request, env, ctx): Promise<Response> {
		if (request.method !== 'POST') {
			return new Response('Method Not Allowed', { status: 405 });
		}

		const data = await request.formData();
		const body = data.get('Body');
		const from = data.get('From');

		if (typeof body !== 'string') {
			return createNewResponse('Invalid Body', 400);
		}

		if (typeof from !== 'string') {
			return createNewResponse('Invalid From', 400);
		}

		const subscriberRepository = new SubscriberRepository(env.DB);

		if (SUBSCRIBE_WORDS.includes(body.toLowerCase().trim())) {
			await subscriberRepository.insertOrUpdateSubscriber(from, {
				isActive: true,
			});

			return createNewResponse(
				'Thank you! You will receive updates from LEANA alerts. Reply STOP to unsubscribe',
			);
		}

		if (STOP_WORDS.includes(body.toLowerCase().trim())) {
			await subscriberRepository.insertOrUpdateSubscriber(from, {
				isActive: false,
			});

			return createNewResponse(
				'You have been unsubscribed. You will no longer receive updates from LEANA alerts',
			);
		}

		const subscriber = await subscriberRepository.getSubscriber(from);
		if (subscriber === undefined) {
			// @todo???
			return new Response(); // @todo
		}

		if (subscriber.isAdmin) {
			const subscribers = await subscriberRepository.getActiveSubscribers();
			const twilioService = TwilioClient.createFromEnv(env);
			const promises = subscribers.map((subscriber) =>
				twilioService.sendMessage(subscriber.contact, body),
			);

			await Promise.allSettled(promises);

			return createNewResponse('Sent your message to ' + subscribers.length + ' subscribers.');
		}

		return createNewResponse('');
	},
} satisfies ExportedHandler<Env>;
