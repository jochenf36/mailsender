import * as core from '@aws-cdk/core';
import * as cognito from '@aws-cdk/aws-cognito';
import * as apigateway from '@aws-cdk/aws-apigateway';
import * as iam from '@aws-cdk/aws-iam';
import { AuthorizationType } from '@aws-cdk/aws-apigateway';
import { CfnOutput } from '@aws-cdk/core';

export class AuthService extends core.Construct {
  constructor(scope: core.Construct, id: string) {
    super(scope, id);

    // =====================================================================================
    // Cognito User Pool Authentication
    // =====================================================================================
    const userPool = new cognito.UserPool(this, 'UserPool', {
      selfSignUpEnabled: true, // Allow users to sign up
      autoVerify: { email: true }, // Verify email addresses by sending a verification code
      signInAliases: { username: true, email: true }, // Set email as an alias
    });

    const userPoolClient = new cognito.UserPoolClient(this, 'UserPoolClient', {
      userPool,
      generateSecret: false, // Don't need to generate secret for web app running on browsers
    });

    const identityPool = new cognito.CfnIdentityPool(
      this,
      'mailboxSenderIdentityPool',
      {
        allowUnauthenticatedIdentities: false, // Don't allow unathenticated users
        cognitoIdentityProviders: [
          {
            clientId: userPoolClient.userPoolClientId,
            providerName: userPool.userPoolProviderName,
          },
        ],
      }
    );

    const authenticatedRole = new iam.Role(
      this,
      'mailboxSenderAuthenticatedRole',
      {
        assumedBy: new iam.FederatedPrincipal(
          'cognito-identity.amazonaws.com',
          {
            StringEquals: {
              'cognito-identity.amazonaws.com:aud': identityPool.ref,
            },
            'ForAnyValue:StringLike': {
              'cognito-identity.amazonaws.com:amr': 'authenticated',
            },
          },
          'sts:AssumeRoleWithWebIdentity'
        ),
      }
    );

    // IAM policy granting users permission to upload, download and delete their own pictures
    authenticatedRole.addToPolicy(
      new iam.PolicyStatement({
        actions: ['s3:GetObject', 's3:PutObject'],
        effect: iam.Effect.ALLOW,
        resources: ['*'],
      })
    );

    new cognito.CfnIdentityPoolRoleAttachment(
      this,
      'IdentityPoolRoleAttachment',
      {
        identityPoolId: identityPool.ref,
        roles: { authenticated: authenticatedRole.roleArn },
      }
    );

    // Export values of Cognito
    new CfnOutput(this, 'UserPoolId', {
      value: userPool.userPoolId,
    });
    new CfnOutput(this, 'AppClientId', {
      value: userPoolClient.userPoolClientId,
    });
    new CfnOutput(this, 'IdentityPoolId', {
      value: identityPool.ref,
    });

    const client = userPool.addClient('mailbox-web-client');
  }
}
