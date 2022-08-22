# Minimal stack to demonstrate how to "batch" incoming events using SQS, Lambda and EventBridge Rules

Background: [this tweet](https://twitter.com/BorisTane/status/1561376113481420802).

> how do you do batch processing in a serverless first approach on aws?
> let's say you receive 10 to 30 events per minute but want to process a minimum of 300 at the time

To which I replied with a [guess](https://twitter.com/Grundlefleck/status/1561383960403480577).

Alternatives suggested:
 - using SQS source for lambda and setting batch size 
 - tumbling windows
 - use Kinesis

Embracing the spirit of the puzzle, I've taken as given that a minimum number is the precise requirement. Tumbling 
windows and batch size don't qualify as I believe they are based on time, not size. I haven't looked into Kinesis at all.

What this project contains:
 - a CDK project which constracts an SQS queue, a Lambda to consume from it, and an EventBridge scheduled rule
 - a script that simulates events received by pushing messages to SQS
 - a TypeScript handler that queries the size of the queue, and processes all messages when over the minimum batch size

Entry points:
 - CDK stack: `lib/serverless-batching-stack.ts`
 - Lambda source code: `src/lambda/consume-batch-fn.ts`
 - Script to simulate events being received: `bin/simulate-receiving-events.ts`

Also, see various screenshots stored in `img/` which show the processing in operation.

### What if it takes too long to reach the batch size? 
If the rate of events being received drops, or stop being received entirely, a batch size < max is likely to be "stuck".
Depending on how critical, this could either be handled in the Lambda, or alerted on. The current state is that a 
CloudWatch alarm is configured to alert on the `ApproximateAgeOfOldestMessage` metric. Since that value is not available
via the `GetQueueAttributes` SDK call, there would likely need to be a bit of custom logic in the lambda to peek at the 
oldest message even if the batch size hasn't been reached.

### Caveat emptor:
 - there are zero tests anywhere, the code is thrown together quickly without much care for style or design
 - message body size or a maximum batch size have not been taken into account; Lambda's configured memory is only 128Mb
 - costs have not been calculated or taken into account, would be shocked if it wasn't pennies a month
 - other approaches (Kinesis, Step Functions) have not been considered and could be superior


