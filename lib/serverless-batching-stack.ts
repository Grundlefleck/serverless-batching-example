import * as cdk from 'aws-cdk-lib';
import { CfnOutput, Duration } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as sqs from 'aws-cdk-lib/aws-sqs';
import { NodejsFunction } from "aws-cdk-lib/aws-lambda-nodejs";
import { Architecture, Tracing } from "aws-cdk-lib/aws-lambda";
import { Rule, Schedule } from "aws-cdk-lib/aws-events";
import { LambdaFunction } from "aws-cdk-lib/aws-events-targets";
import { Alarm } from "aws-cdk-lib/aws-cloudwatch";


export class ServerlessBatchingStack extends cdk.Stack {
    constructor(scope: Construct, id: string, props?: cdk.StackProps) {
        super(scope, id, props);
        const visibilityTimeout = cdk.Duration.seconds(300);
        const queue = new sqs.Queue(this, 'ServerlessBatchingQueue', {
            visibilityTimeout
        });

        const consumeBatchFn = new NodejsFunction(this, "ConsumeBatchFn", {
            architecture: Architecture.ARM_64,
            tracing: Tracing.ACTIVE,
            bundling: { },
            entry: "src/lambda/consume-batch-fn.ts",
            handler: "handler",
            environment: {
                EVENTS_SQS_URL: queue.queueUrl
            },
            timeout: Duration.seconds(30),
            memorySize: 128
        });

        queue.grantConsumeMessages(consumeBatchFn);

        const consumeBatchSchedule = new Rule(this, "ConsumeBatchSchedule", {
            schedule: Schedule.rate(Duration.minutes(10))
        });
        consumeBatchSchedule.addTarget(new LambdaFunction(consumeBatchFn));

        new Alarm(this, "BatchEventsNotProcessedSoonEnough", {
            metric: queue.metricApproximateAgeOfOldestMessage(),
            alarmDescription: "Events are not being processed. Has rate dropped, or lambda scheduling been deactivated?",
            threshold: 60 * 60,
            evaluationPeriods: 1
        });

        new CfnOutput(this, "ServerlessBatchingQueueName", {
            exportName: "ServerlessBatchingQueueName",
            value: queue.queueName
        });
        new CfnOutput(this, "ServerlessBatchingQueueUrl", {
            exportName: "ServerlessBatchingQueueUrl",
            value: queue.queueUrl
        });
    }
}
