import * as core from '@aws-cdk/core';
import * as lambda from '@aws-cdk/aws-lambda';
import * as sqs from '@aws-cdk/aws-sqs';
import * as iam from '@aws-cdk/aws-iam';
import * as dynamodb from '@aws-cdk/aws-dynamodb';
import {
  DynamoEventSource,
  SqsDlq,
  SqsEventSource,
} from '@aws-cdk/aws-lambda-event-sources';
import { RemovalPolicy } from '@aws-cdk/core';

/**
 * Publish notification received from the raw Table inserts
 */
export class PublishNotificationService extends core.Construct {
  public mailTable: dynamodb.Table;

  constructor(scope: core.Construct, id: string, table: dynamodb.Table) {
    super(scope, id);

    /**
     * Queue to store generated notifications
     */
    const notificationQueue = new sqs.Queue(this, 'NotificationQueue');

    /**
     * Trigger: dynamo DB stream
     * Task: create Notification from DB stream and put them in the notification Queue
     */
    const createNotificationsFromDBHandler = new lambda.Function(
      this,
      'CreateNotificationsFromDBHandler',
      {
        description: 'Create Notification and insert into SQS',
        runtime: lambda.Runtime.NODEJS_14_X,
        code: lambda.Code.fromAsset('lambda'),
        handler: 'create_notifications_from_db.handler',
        environment: {
          QUEUE: notificationQueue.queueUrl,
        },
      }
    );

    notificationQueue.grantSendMessages(createNotificationsFromDBHandler);

    /**
     * Stores DL messages from the Dynamo Event Source
     * TODO: do something with death letter
     */
    const publishNotificationDLQueue = new sqs.Queue(
      this,
      'PublishNotificationDLQueue'
    );

    createNotificationsFromDBHandler.addEventSource(
      new DynamoEventSource(table, {
        startingPosition: lambda.StartingPosition.TRIM_HORIZON,
        batchSize: 5,
        bisectBatchOnError: true,
        onFailure: new SqsDlq(publishNotificationDLQueue),
        retryAttempts: 10,
      })
    );

    this.mailTable = new dynamodb.Table(this, 'Mail_Table', {
      partitionKey: { name: 'MESSAGE_ID', type: dynamodb.AttributeType.STRING },
      removalPolicy: RemovalPolicy.DESTROY,
    });

    /**
     * Responsible for publishing notifications received from the notification Queue
     */
    const publishNotificationHandler = new lambda.Function(
      this,
      'PublishNotification',
      {
        description: 'Send EMAIL for notification',
        runtime: lambda.Runtime.NODEJS_14_X,
        code: lambda.Code.fromAsset('lambda'),
        handler: 'publish_notification.handler',
        environment: {
          MAIL_TABLE: this.mailTable.tableName,
        },
      }
    );

    this.mailTable.grantWriteData(publishNotificationHandler);

    publishNotificationHandler.addEventSource(
      new SqsEventSource(notificationQueue, {
        batchSize: 10,
      })
    );

    publishNotificationHandler.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ['ses:SendEmail', 'SES:SendRawEmail'],
        resources: ['*'],
        effect: iam.Effect.ALLOW,
      })
    );
  }
}
