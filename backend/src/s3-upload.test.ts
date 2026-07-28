import { test } from "node:test";
import assert from "node:assert/strict";
import dotenv from "dotenv";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve, basename } from "node:path";
import AWS from "aws-sdk";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: resolve(__dirname, "../.env") });

function getEnv(name: string) {
  const value = process.env[name];
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

test("aws s3 upload news-freep.jpg", async (t) => {
  const required = ["AWS_ACCESS_KEY_ID", "AWS_SECRET_ACCESS_KEY", "AWS_REGION", "AWS_BUCKET_NAME"];
  const missing = required.filter((key) => !getEnv(key));
  if (missing.length > 0) {
    t.skip(`Missing env vars: ${missing.join(", ")}`);
    return;
  }

  const accessKeyId = getEnv("AWS_ACCESS_KEY_ID")!;
  const secretAccessKey = getEnv("AWS_SECRET_ACCESS_KEY")!;
  const region = getEnv("AWS_REGION")!;
  const bucketName = getEnv("AWS_BUCKET_NAME")!;
  const prefix = getEnv("AWS_OBJECT_PREFIX") || "documents";

  const imagePath = resolve(__dirname, "../../frontend/src/assets/images/news-freep.jpg");
  if (!fs.existsSync(imagePath)) {
    t.skip(`Image file not found at ${imagePath}`);
    return;
  }

  const fileBuffer = fs.readFileSync(imagePath);
  const fileName = basename(imagePath);
  const key = `${prefix}/${fileName}`;

  const s3 = new AWS.S3({
    accessKeyId,
    secretAccessKey,
    region,
  });

  const result = await s3
    .upload({
      Bucket: bucketName,
      Key: key,
      Body: fileBuffer,
      ContentType: "image/jpeg",
    })
    .promise();

  assert.equal(result.Bucket, bucketName);
  assert.equal(result.Key, key);
  assert.ok(result.Location || result.ETag);
});

