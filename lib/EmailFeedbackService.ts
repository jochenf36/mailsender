import * as core from '@aws-cdk/core';
import * as sqs from '@aws-cdk/aws-sqs';
import * as sns from '@aws-cdk/aws-sns';
import * as subs from '@aws-cdk/aws-sns-subscriptions';
import { SqsEventSource } from '@aws-cdk/aws-lambda-event-sources';
import * as lambda from '@aws-cdk/aws-lambda';
import { CfnOutput } from '@aws-cdk/core';
import * as dynamodb from '@aws-cdk/aws-dynamodb';

export class EmailFeedbackService extends core.Construct {
  constructor(scope: core.Construct, id: string, mailTable: dynamodb.Table) {
    super(scope, id);

    /**
     * Queue to store feedback messages
     */
    const emailFeedbackQueue = new sqs.Queue(this, 'EmailFeedbackQueue');

    /**
     * Stores DL messages from email feedback Queue
     * TODO: do something with death letter
     */
    const emailFeedbackDLQueue = new sqs.Queue(this, 'emailFeedbackDLQueue');

    /**
     * Queue to store feedback messages
     */
    const emailFeedbackTopic = new sns.Topic(this, 'EmailFeedbackTopic', {
      displayName: 'Email feedback events topic',
      topicName: 'emailFeedbackTopic',
    });

    emailFeedbackTopic.addSubscription(
      new subs.SqsSubscription(emailFeedbackQueue, {
        rawMessageDelivery: true,
      })
    );

    /**
     * Responsible for handling mail feedback events
     */
    const emailFeedbackHandlerHandler = new lambda.Function(
      this,
      'HandleMailEvents',
      {
        description: 'Handle Email feedback events',
        runtime: lambda.Runtime.NODEJS_14_X,
        code: lambda.Code.fromAsset('lambda'),
        handler: 'handle_mail_events.handler',
        environment: {
          MAIL_TABLE: mailTable.tableName,
        },
      }
    );

    mailTable.grantReadWriteData(emailFeedbackHandlerHandler);

    emailFeedbackHandlerHandler.addEventSource(
      new SqsEventSource(emailFeedbackQueue, {
        batchSize: 10,
      })
    );

    new CfnOutput(this, 'EmailFeedbackTopicArn', {
      value: emailFeedbackTopic.topicArn,
    });
  }
}
