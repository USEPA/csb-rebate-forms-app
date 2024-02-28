const { S3_PUBLIC_BUCKET, S3_PUBLIC_REGION } = process.env;

const s3BucketUrl = `https://${S3_PUBLIC_BUCKET}.s3-${S3_PUBLIC_REGION}.amazonaws.com`;

module.exports = { s3BucketUrl };
