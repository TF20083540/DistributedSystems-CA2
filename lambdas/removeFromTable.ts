import { DynamoDB } from "aws-sdk";

const dynamoDb = new DynamoDB.DocumentClient();

exports.handler = async (event: any) => {
  console.log("Received event:", JSON.stringify(event));

  const records = event.Records;
  for (const record of records) {
    const s3 = record.s3;
    const filename = decodeURIComponent(s3.object.key.replace(/\+/g, " "));

    const params = {
      TableName: process.env.TABLE_NAME!,
      Key: {
        filename: filename,
      },
    };

    try {
      await dynamoDb.delete(params).promise();
      console.log(`Image reference deleted successfully from the db: ${filename}`); //Log
    } catch (error) { //Error log
      console.error("Error deleting image reference in the db:", error);
      return { statusCode: 500, body: JSON.stringify({ error: "Could not delete image reference from db" }) };
    }
  }

  return { statusCode: 200, body: JSON.stringify({ message: "Images reference deleted successfully from the db!" }) };
};