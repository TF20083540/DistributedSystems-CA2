/* eslint-disable import/extensions, import/no-absolute-path */
import { SQSHandler } from "aws-lambda";
import {
  GetObjectCommand,
  PutObjectCommandInput,
  GetObjectCommandInput,
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand
} from "@aws-sdk/client-s3";

const s3 = new S3Client();

export const handler: SQSHandler = async (event) => {
  console.log("Event ", JSON.stringify(event));
  for (const record of event.Records) {
    const recordBody = JSON.parse(record.body);        // Parse SQS message
    const snsMessage = JSON.parse(recordBody.Message); // Parse SNS message

    if (snsMessage.Records) {
      console.log("Record body ", JSON.stringify(snsMessage));
      for (const messageRecord of snsMessage.Records) {
        const s3e = messageRecord.s3;
        const srcBucket = s3e.bucket.name;
        const srcKey = decodeURIComponent(s3e.object.key.replace(/\+/g, " "));



        // Validate file type
        const validImageTypes = ['.jpeg', '.jpg', '.png'];
        const fileExtension = srcKey.slice((Math.max(0, srcKey.lastIndexOf(".")) || Infinity) + 1).toLowerCase();

        if (!validImageTypes.includes(`.${fileExtension}`)) {
          console.error(`Invalid file type for ${srcKey}. Deleting the file.`);
          try {
            await s3.send(new DeleteObjectCommand({ Bucket: srcBucket, Key: srcKey }));
            console.log(`Successfully deleted invalid file: ${srcKey}`);
          } catch (error) {
            console.error(`Error deleting file ${srcKey}:`, error);
          }
          return; // Skip further processing for this file
        }

        let origimage = null; //Is this a hint towards lambda chaining?
        try {
          // Download the image from the S3 source bucket.
          const params: GetObjectCommandInput = {
            Bucket: srcBucket,
            Key: srcKey,
          };
          origimage = await s3.send(new GetObjectCommand(params));
          // Process the image ......

        } catch (error) {
          console.log(error);
        }
      }
    }
  }
};