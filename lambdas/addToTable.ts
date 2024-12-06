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
      Item: {
        filename: filename,
        description: "Placeholder description", //I'll need to make a function that can change this.
      },
    };

    try {
      await dynamoDb.put(params).promise();
      console.log(`Image added successfully: ${filename}`); //Log
    } catch (error) { //Error log
      console.error("Error adding image:", error);
      return { statusCode: 500, body: JSON.stringify({ error: "Could not add image" }) };
    }
  }

  return { statusCode: 200, body: JSON.stringify({ message: "Images added successfully!" }) };
};