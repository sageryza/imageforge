import { Storage } from '@google-cloud/storage';
const sa = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
const storage = new Storage({ projectId: sa.project_id, credentials: sa });
const bucket = storage.bucket(`${sa.project_id}.firebasestorage.app`);
const [, , file, dest, contentType] = process.argv;
const [f] = await bucket.upload(file, {
  destination: dest,
  metadata: contentType ? { contentType } : undefined,
});
await f.makePublic();
console.log(`https://storage.googleapis.com/${bucket.name}/${dest}`);
