import { Message, SQS } from "@aws-sdk/client-sqs";

const sqs = new SQS({});

const minimumBatchSize = 300;

export const handler = async () => {
    const queueUrl: string = process.env[ "EVENTS_SQS_URL" ]!;

    const getAttributesOutput = await sqs.getQueueAttributes({
        QueueUrl: queueUrl,
        AttributeNames: ["ApproximateNumberOfMessages"]
    });

    const numberOfMessages = getAttributesOutput.Attributes![ "ApproximateNumberOfMessages" ];

    if (numberOfMessages === undefined) {
        throw new Error("ApproximateNumberOfMessages attribute undefined");
    } else if (Number(numberOfMessages) < minimumBatchSize) {
        console.log(`Number of messages (${numberOfMessages}) is not enough to process as a batch. Exiting`);
    } else {
        await drainQueueAndProcess(queueUrl);
    }
}

const drainQueueAndProcess = async (queueUrl: string) => {
    const batch: Array<Message> = [];
    let messages = undefined;

    do {
        const response = await sqs.receiveMessage({QueueUrl: queueUrl, MaxNumberOfMessages: 10});
        messages = response.Messages || [];
        batch.push(...messages);
    } while (messages.length > 0 /* and batch is not too large already */)

    // We now have a batch worth of events in memory. Process, then remove from the queue.
    // This would need to be more robust for a meaningful system. Possibly await acknowledgement of receipt from the
    // external system before removing from the queue. Or if it really can't be trusted, write the batch as an
    // atomic unit somewhere, like S3, trigger sending S3 object downstream and build a retry mechanism around that.

    console.log(`Processing ${batch.length} messages... Done`);

    for (const processedMessage of batch) {
        await sqs.deleteMessage({QueueUrl: queueUrl, ReceiptHandle: processedMessage.ReceiptHandle});
    }
}
