import { createNewResponse, TwilioClient } from './services/twilio';
import { SubscriberRepository } from './repositories/subscribers';

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
            console.error(`Received ${request.method}, rejecting with 405 status`);

            return new Response('Method Not Allowed', { status: 405 });
        }

        const data = await request.formData();
        const body = data.get('Body');
        const from = data.get('From');

        if (typeof body !== 'string') {
            console.error('body is not a string. Exiting early.');
            return createNewResponse('Invalid Body', 400);
        }

        if (typeof from !== 'string') {
            console.error('from is not a string. Exiting early.');
            return createNewResponse('Invalid From', 400);
        }

        const subscriberRepository = new SubscriberRepository(env.DB);

        if (SUBSCRIBE_WORDS.includes(body.toLowerCase().trim())) {
            await subscriberRepository.insertOrUpdateSubscriber(from, {
                isActive: true,
            });

            console.log({ subscriber_number: from, action: 'subscribed' });
            return createNewResponse(
                'Thank you! You will receive updates from LEANA alerts. Reply STOP to unsubscribe',
            );
        }

        if (STOP_WORDS.includes(body.toLowerCase().trim())) {
            await subscriberRepository.insertOrUpdateSubscriber(from, {
                isActive: false,
            });
            console.log({ subscriber_number: from, action: 'unsubscribed' });

            return createNewResponse(
                'You have been unsubscribed. You will no longer receive updates from LEANA alerts',
            );
        }

        const subscriber = await subscriberRepository.getSubscriber(from);
        if (subscriber === undefined) {
            console.error('No subscriber found. Exiting early without a response.', {
                subscriber_number: from,
            });

            // The sender did not opt in or out and they are not in the database.
            return createNewResponse('');
        }

        if (!subscriber.isAdmin) {
            console.error('Sender is not an admin. Exiting early without a response.', {
                subscriber,
            });

            return createNewResponse('');
        }

        const subscribers = await subscriberRepository.getActiveSubscribers();
        const twilioService = TwilioClient.createFromEnv(env);
        const promises = subscribers.map((subscriber) =>
            twilioService.sendMessage(subscriber.contact, body),
        );

        console.log(`Sending message to ${promises.length} subscribers`, {
            subscriber: subscriber,
            body: body,
        });

        // @todo consider filtering these into passes/failures
        Promise.allSettled(promises);

        return createNewResponse('Sent your message to ' + subscribers.length + ' subscribers.');
    },
} satisfies ExportedHandler<Env>;
