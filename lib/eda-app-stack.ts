import * as cdk from "aws-cdk-lib";
import * as lambdanode from "aws-cdk-lib/aws-lambda-nodejs";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as s3 from "aws-cdk-lib/aws-s3";
import * as s3n from "aws-cdk-lib/aws-s3-notifications";
import * as events from "aws-cdk-lib/aws-lambda-event-sources";
import * as sqs from "aws-cdk-lib/aws-sqs";
import * as sns from "aws-cdk-lib/aws-sns";
import * as subs from "aws-cdk-lib/aws-sns-subscriptions";
import * as iam from "aws-cdk-lib/aws-iam";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import * as rds from "aws-cdk-lib/aws-rds"; //New
import * as ec2 from "aws-cdk-lib/aws-ec2"; //New

import { Construct } from "constructs";
// import * as sqs from 'aws-cdk-lib/aws-sqs';

export class EDAAppStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    //Creates a table for my image names and descriptions
    const imagesTable = new dynamodb.Table(this, "ImagesTable", {
      partitionKey: { name: "filename", type: dynamodb.AttributeType.STRING },
      removalPolicy: cdk.RemovalPolicy.DESTROY, //Change to RETAIN for production
    });






    //Creates my bucket
    const imagesBucket = new s3.Bucket(this, "images", {
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
      publicReadAccess: false,
    });

  // Integration infrastructure
  const imageProcessQueue = new sqs.Queue(this, "img-created-queue", {
    receiveMessageWaitTime: cdk.Duration.seconds(10),
  });

  const newImageTopic = new sns.Topic(this, "NewImageTopic", {
    displayName: "New Image topic",
  }); 




  // Lambda functions
  const processImageFn = new lambdanode.NodejsFunction(
    this,
    "ProcessImageFn",
    {
      runtime: lambda.Runtime.NODEJS_18_X,
      entry: `${__dirname}/../lambdas/processImage.ts`,
      timeout: cdk.Duration.seconds(15),
      memorySize: 128,
    }
  );

  const mailerFn = new lambdanode.NodejsFunction(this, "mailer-function", {
    runtime: lambda.Runtime.NODEJS_16_X,
    memorySize: 1024,
    timeout: cdk.Duration.seconds(3),
    entry: `${__dirname}/../lambdas/mailer.ts`,
  });

                              //New Lambda - Reject Mailer
  const rejectMailerFn = new lambdanode.NodejsFunction(this, "rejectmailer-function", {
    runtime: lambda.Runtime.NODEJS_16_X,
    memorySize: 1024,
    timeout:cdk.Duration.seconds(3),
    entry: `${__dirname}/../lambdas/rejectMailer.ts`
  })

  const addImageToTableFn = new lambdanode.NodejsFunction(this, "AddImageToTableFn", {
    runtime: lambda.Runtime.NODEJS_18_X,
    entry: `${__dirname}/../lambdas/addToTable.ts`,
    environment: {
      TABLE_NAME: imagesTable.tableName,
    },
  });
  


  // S3 --> SQS
//  imagesBucket.addEventNotification( //Didn't realise the bones for this was already there.... Had to remove anyways due to Trigger conflict.
//    s3.EventType.OBJECT_CREATED,
//    new s3n.SnsDestination(newImageTopic)  // Changed
//);

  imagesBucket.addEventNotification(
    s3.EventType.OBJECT_REMOVED,
    new s3n.LambdaDestination(rejectMailerFn)  //Triggers rejectMailerFn on object deletion
  );

  imagesBucket.addEventNotification(
    s3.EventType.OBJECT_CREATED,
    new s3n.LambdaDestination(addImageToTableFn) // Triggers addImageFn on object creation
  );


 // SQS --> Lambda
  const newImageEventSource = new events.SqsEventSource(imageProcessQueue, {
    batchSize: 5,
    maxBatchingWindow: cdk.Duration.seconds(5),
  });

  const mailerQ = new sqs.Queue(this, "mailer-queue", {
    receiveMessageWaitTime: cdk.Duration.seconds(10),
  });

  const newImageMailEventSource = new events.SqsEventSource(mailerQ, {
    batchSize: 5,
    maxBatchingWindow: cdk.Duration.seconds(5),
  }); 


  





  //Event Sources
  processImageFn.addEventSource(newImageEventSource);
  mailerFn.addEventSource(newImageMailEventSource);

  //Subscription triggers
  newImageTopic.addSubscription(new subs.SqsSubscription(imageProcessQueue));
  newImageTopic.addSubscription(new subs.SqsSubscription(mailerQ));


  // Permissions
  imagesBucket.grantRead(processImageFn);
  imagesBucket.grantDelete(processImageFn); //Allow the processImage function to delete invalid imagetypes.
  imagesBucket.grantRead(rejectMailerFn); //Allows the rejectMailer function to mail when an object has been deleted.
  imagesTable.grantWriteData(addImageToTableFn); //Allows write to the imageTable
  imagesTable.grantReadData(addImageToTableFn); //Allows reading of the imageTable

  //Role Policies
  mailerFn.addToRolePolicy(
    new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        "ses:SendEmail",
        "ses:SendRawEmail",
        "ses:SendTemplatedEmail",
      ],
      resources: ["*"],
    })
  );

  rejectMailerFn.addToRolePolicy(
    new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        "ses:SendEmail",
        "ses:SendRawEmail",
        "ses:SendTemplatedEmail",
      ],
      resources: ["*"],
    })
  );


  // Output
  new cdk.CfnOutput(this, "bucketName", {
    value: imagesBucket.bucketName,
  });


  }
}
