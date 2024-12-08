import { SQSHandler } from "aws-lambda";
import { SES_EMAIL_FROM, SES_EMAIL_TO, SES_REGION } from "../env";
import {
  SESClient,
  SendEmailCommand,
  SendEmailCommandInput,
} from "@aws-sdk/client-ses";
//import { DynamoDB } from "aws-sdk";
import { Lambda} from "@aws-sdk/client-lambda"; //Import the Lambda client


if (!SES_EMAIL_TO || !SES_EMAIL_FROM || !SES_REGION) {
  throw new Error(
    "Please add the SES_EMAIL_TO, SES_EMAIL_FROM and SES_REGION environment variables in an env.js file located in the root directory"
  );
}

type ContactDetails = {
  name: string;
  email: string;
  message: string;
};

const client = new SESClient({ region: SES_REGION });
//const dynamoDb = new DynamoDB.DocumentClient();
const lambdaClient = new Lambda({ region: SES_REGION });


export const handler: SQSHandler = async (event: any): Promise<void> => {
  const functionArn = process.env.REMOVEIMAGEFROMTABLEFN_ARN; //This gets the function ARN from env as set in eda-app-stack.ts

  console.log('Function ARN:', functionArn); //Log the ARN for debugging

  console.log("Event ", JSON.stringify(event));
  for (const record of event.Records) {
    const s3 = record.s3;
    const filename = decodeURIComponent(s3.object.key.replace(/\+/g, " "));

    //Send email about file deletion/rejection.
    try {
      const { name, email, message }: ContactDetails = {
        name: "The Photo Album",
        email: SES_EMAIL_FROM,
        message: `The image you uploaded was rejected or deleted.`,
      };
      const params = sendEmailParams({ name, email, message });
      await client.send(new SendEmailCommand(params));

      //Call another lambda
      const lambdaParams = {
        FunctionName: functionArn,
        InvocationType: 'RequestResponse' as const,
        Payload: JSON.stringify(event),
      };

      const lambdaResponse = await lambdaClient.invoke(lambdaParams);
      console.log('RemoveImageFromTableFn response:', lambdaResponse);


    } catch (error: unknown) {
      console.log("ERROR sending email: ", error);
    }

/*     console.log("DynamoDB Table Name: ", process.env.TABLE_NAME); //Debugging console.

    //Delete image reference from DynamoDB table
    const deleteParams = {
      TableName: process.env.TABLE_NAME!,
      Key: {
        filename: filename,
      },
    };

    try {
      const result = await dynamoDb.delete(deleteParams).promise();
      console.log(`Image reference deleted successfully from the db: ${filename}`, result);
    } catch (error) {
      console.error("Error deleting image reference in the db:", error);
    } */
  }
};

function sendEmailParams({ name, email, message }: ContactDetails) {
  const parameters: SendEmailCommandInput = {
    Destination: {
      ToAddresses: [SES_EMAIL_TO],
    },
    Message: {
      Body: {
        Html: {
          Charset: "UTF-8",
          Data: getHtmlContent({ name, email, message }),
        },
      },
      Subject: {
        Charset: "UTF-8",
        Data: `Image Upload failed`,
      },
    },
    Source: SES_EMAIL_FROM,
  };
  return parameters;
}

function getHtmlContent({ name, email, message }: ContactDetails) {
  return `
    <html>
      <body>
        <h2>Sent from: </h2>
        <ul>
          <li style="font-size:18px">👤 <b>${name}</b></li>
          <li style="font-size:18px">✉️ <b>${email}</b></li>
        </ul>
        <p style="font-size:18px">${message}</p>
      </body>
    </html> 
  `;
}