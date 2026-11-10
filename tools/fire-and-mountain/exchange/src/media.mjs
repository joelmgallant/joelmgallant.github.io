// S3 media: short-lived signed links for viewing, presigned POST forms (with size caps) for uploading.
import { GetObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { createPresignedPost } from '@aws-sdk/s3-presigned-post';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

const VIEW_SECONDS = 300;
const UPLOAD_SECONDS = 300;

export function createMedia(bucket) {
  const client = new S3Client({});
  return {
    getUrl(key) {
      return getSignedUrl(client, new GetObjectCommand({ Bucket: bucket, Key: key }), { expiresIn: VIEW_SECONDS });
    },
    presignPost({ key, contentType, maxBytes }) {
      return createPresignedPost(client, {
        Bucket: bucket, Key: key, Expires: UPLOAD_SECONDS,
        Fields: { 'Content-Type': contentType },
        Conditions: [['content-length-range', 1, maxBytes], ['eq', '$Content-Type', contentType]],
      });
    },
  };
}
