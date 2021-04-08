import * as core from '@aws-cdk/core';
import * as lambda from '@aws-cdk/aws-lambda';
import * as apigateway from '@aws-cdk/aws-apigateway';
import * as s3 from '@aws-cdk/aws-s3';
import * as dynamodb from '@aws-cdk/aws-dynamodb';

export class RestService extends core.Construct {
  constructor(
    scope: core.Construct,
    id: string,
    bucket: s3.Bucket,
    mailTable: dynamodb.Table
  ) {
    super(scope, id);

    const lambdaApiLayer = new lambda.LayerVersion(this, 'lambdaApiLayer', {
      code: lambda.Code.fromAsset(
        'lambda/layers/lambdaApiLayer/deployment.zip'
      ),
      compatibleRuntimes: [lambda.Runtime.NODEJS_14_X],
      description: 'lambda API package',
    });

    const backend = new lambda.Function(this, 'apiLambda', {
      description: 'Rest API',
      runtime: lambda.Runtime.NODEJS_14_X,
      code: lambda.Code.fromAsset('lambda'),
      handler: 'rest_api.handler',
      layers: [lambdaApiLayer],
      environment: {
        UPLOAD_BUCKET: bucket.bucketName,
        MAIL_TABLE: mailTable.tableName,
      },
    });

    bucket.grantWrite(backend);
    mailTable.grantReadData(backend);

    const gateway = new apigateway.LambdaRestApi(this, 'myapi', {
      handler: backend,
      defaultCorsPreflightOptions: {
        allowOrigins: apigateway.Cors.ALL_ORIGINS,
        allowMethods: apigateway.Cors.ALL_METHODS,
      },
    });
  }
}
