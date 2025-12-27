import { DurableObject } from 'cloudflare:workers';
import twilio from 'twilio';
import { createNewResponse, TwilioClient } from './services/twilio';
import { SubscriberRepository, Subscriber } from './repositories/subscribers';

const STOP_WORDS = ['stop'];
const SUBSCRIBE_WORDS = ['start'];

/**
 * Welcome to Cloudflare Workers! This is your first Durable Objects application.
 *
 * - Run `npm run dev` in your terminal to start a development server
 * - Open a browser tab at http://localhost:8787/ to see your Durable Object in action
 * - Run `npm run deploy` to publish your application
 *
 * Bind resources to your worker in `wrangler.jsonc`. After adding bindings, a type definition for the
 * `Env` object can be regenerated with `npm run cf-typegen`.
 *
 * Learn more at https://developers.cloudflare.com/durable-objects
 */

/** A Durable Object's behavior is defined in an exported Javascript class */
export class MyDurableObject extends DurableObject<Env> {
	/**
	 * The constructor is invoked once upon creation of the Durable Object, i.e. the first call to
	 * 	`DurableObjectStub::get` for a given identifier (no-op constructors can be omitted)
	 *
	 * @param ctx - The interface for interacting with Durable Object state
	 * @param env - The interface to reference bindings declared in wrangler.jsonc
	 */
	constructor(ctx: DurableObjectState, env: Env) {
		super(ctx, env);
	}

	/**
	 * The Durable Object exposes an RPC method sayHello which will be invoked when a Durable
	 *  Object instance receives a request from a Worker via the same method invocation on the stub
	 *
	 * @param name - The name provided to a Durable Object instance from a Worker
	 * @returns The greeting to be sent back to the Worker
	 */
	async sayHello(name: string): Promise<string> {
		return `Hello, ${name}!`;
	}
}

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
