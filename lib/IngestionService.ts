import * as core from '@aws-cdk/core';
import * as lambda from '@aws-cdk/aws-lambda';
import * as s3 from '@aws-cdk/aws-s3';
import * as dynamodb from '@aws-cdk/aws-dynamodb';
import { S3EventSource } from '@aws-cdk/aws-lambda-event-sources';
import { StreamViewType } from '@aws-cdk/aws-dynamodb';
import { HttpMethods } from '@aws-cdk/aws-s3';
import { RemovalPolicy } from '@aws-cdk/core';

/**
 * Bulk CSV ingestion to Amazon DynamoDB
 */
export class IngestionService extends core.Construct {
  public rawBucket: s3.Bucket;
  public rawTable: dynamodb.Table;

  constructor(scope: core.Construct, id: string) {
    super(scope, id);

    /**
     * Responsible for shared npm packages
     */
    const uuidLayer = new lambda.LayerVersion(this, 'uuidLayer', {
      code: lambda.Code.fromAsset('lambda/layers/uuidLayer/deployment.zip'),
      compatibleRuntimes: [lambda.Runtime.NODEJS_14_X],
      description: 'uuid package',
    });

    /**
     * Bucket to store the raw CSV files received from customers
     */
    this.rawBucket = new s3.Bucket(this, 'rawStore', {
      cors: [
        {
          allowedOrigins: ['*'],
          allowedMethods: [HttpMethods.PUT, HttpMethods.GET, HttpMethods.HEAD],
          maxAge: 3000,
          allowedHeaders: ['*'],
        },
      ],
    });

    /**
     * Table to store the raw notifications to be send
     */
    this.rawTable = new dynamodb.Table(this, 'Notifications', {
      partitionKey: { name: 'UUID', type: dynamodb.AttributeType.STRING },
      stream: StreamViewType.NEW_IMAGE,
      removalPolicy: RemovalPolicy.DESTROY,
    });

    /**
     * Trigger: bucket events
     * Task: stores raw notifications in the database table
     */
    const storeRawLinesHandler = new lambda.Function(this, 'StoreRawLines', {
      description: 'Store RAW line in Dynamo DB',
      runtime: lambda.Runtime.NODEJS_14_X,
      code: lambda.Code.fromAsset('lambda'),
      handler: 'store_raw_lines.handler',
      environment: {
        BUCKET: this.rawBucket.bucketName,
        NOTIFICATION_TABLE_NAME: this.rawTable.tableName,
      },
      layers: [uuidLayer],
    });

    this.rawTable.grantWriteData(storeRawLinesHandler);
    this.rawBucket.grantRead(storeRawLinesHandler);

    storeRawLinesHandler.addEventSource(
      new S3EventSource(this.rawBucket, {
        events: [s3.EventType.OBJECT_CREATED],
      })
    );
  }
}
