import * as cdk from '@aws-cdk/core';
import { AuthService } from './AuthService';
import * as ingestionService from './IngestionService';
import * as publishNotificationService from './PublishNotificationService';
import * as restService from './RestService';
import * as emailFeedbackService from './EmailFeedbackService';

import cognito = require('@aws-cdk/aws-cognito');

export class MailSenderStack extends cdk.Stack {
  constructor(scope: cdk.Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    new AuthService(this, 'Authentication Service');

    const ingestionServiceA = new ingestionService.IngestionService(
      this,
      'Store notification service'
    );

    const publishNotificationServiceA = new publishNotificationService.PublishNotificationService(
      this,
      'Publish notification service',
      ingestionServiceA.rawTable
    );

    new emailFeedbackService.EmailFeedbackService(
      this,
      'EmailFeedbackService',
      publishNotificationServiceA.mailTable
    );

    new restService.RestService(
      this,
      'RestService',
      ingestionServiceA.rawBucket,
      publishNotificationServiceA.mailTable
    );
  }
}
