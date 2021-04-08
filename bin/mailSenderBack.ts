#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from '@aws-cdk/core';
import { MailSenderStack } from '../lib/mailSenderStack';

const app = new cdk.App();
new MailSenderStack(app, 'MailSenderStack');
