import twilio, { Twilio } from 'twilio';
const { MessagingResponse } = twilio.twiml;

export class TwilioClient {
    #twilio: Twilio;

    constructor(twilio: Twilio) {
        this.#twilio = twilio;
    }

    async sendMessage(contactNumber: string, message: string) {
        return this.#twilio.messages.create({
            to: contactNumber,
            body: message,
        });
    }

    static createFromEnv(env: Env): TwilioClient {
        return new TwilioClient(twilio(env.TWILIO_ACCOUNT_SID, env.TWILIO_AUTH_TOKEN));
    }
}

export function createNewResponse(body: string, status: number = 200) {
    const twiml = new MessagingResponse();
    twiml.message(body);
    return new Response(twiml.toString(), {
        status: status,
        headers: {
            'Content-Type': 'text/xml',
        },
    });
}
