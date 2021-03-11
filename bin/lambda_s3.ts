#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from '@aws-cdk/core';
import { LambdaS3Stack } from '../lib/lambda_s3-stack';

const app = new cdk.App();
new LambdaS3Stack(app, 'LambdaS3Stack');
