import * as fs from "fs";
import { SQS } from "@aws-sdk/client-sqs";

/**
 * Script that runs indefinitely, sending events to an SQS queue.
 * The number of events is confined to a range per minute, configurable in main().
 */

const sqs = new SQS({});

const sleep = (durationSeconds: number) => new Promise((resolve) => setTimeout(resolve, durationSeconds * 1_000));

const sendEvent = async (QueueUrl: string) => {
    await sqs.sendMessage({
        QueueUrl,
        MessageBody: JSON.stringify({
           sentAt: new Date().toISOString()
        })
    })
}

const delayThenSend = async (delaySeconds: number, queueUrl: string): Promise<void> => {
    await sleep(delaySeconds);
    await sendEvent(queueUrl)
}

const sendEventsForDuration = async (numEvents: number, durationSeconds: number, queueUrl: string) => {
    const eventDelays = Array.from({length: numEvents}, () => Math.round(Math.random() * durationSeconds));
    eventDelays.sort((a: number, b: number) => a - b); // lol Javascript
    console.log(`Sending ${numEvents} events over ${durationSeconds} seconds. Delays: ${eventDelays}`);

    await Promise.all([sleep(durationSeconds), ...(eventDelays.map((delay) => delayThenSend(delay, queueUrl)))]);
}

const retrieveQueueUrlFromCdkOutputsFile = (outputsFilename: string): string => {
    let queueName = undefined;
    try {
        const outputJson = JSON.parse(fs.readFileSync(outputsFilename).toString("utf-8"));
        queueName = outputJson["ServerlessBatchingStack"][ "ServerlessBatchingQueueUrl" ];
    } catch (err) {
        console.error(err);
    }
    if (!queueName) {
        throw new Error(`Could not retrieve queue name from file named ${outputsFilename}. Try running "cdk deploy -O ${outputsFilename}"`);
    } else {
        return queueName;
    }
}

const main = async (eventsPerDuration: { min: number, max: number }, durationSeconds: number) => {
    const queueUrl = retrieveQueueUrlFromCdkOutputsFile("cdk-output.json");
    console.log(`Sending ${JSON.stringify(eventsPerDuration, null, '')} events every ${durationSeconds} seconds to SQS queue named ${queueUrl}`);

    const { min, max } = eventsPerDuration;
    while (true) {
        const numEvents = Math.round(Math.random() * (max + 1 - min) + min);
        await sendEventsForDuration(numEvents, durationSeconds, queueUrl);
    }
}

main({min: 10, max: 30}, 60)
    .then(() => console.log("Complete"))
    .catch(console.error);
