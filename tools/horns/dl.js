const admin=require('firebase-admin');
const sa=JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
admin.initializeApp({credential:admin.credential.cert(sa),storageBucket:`${sa.project_id}.firebasestorage.app`});
const b=admin.storage().bucket();
(async()=>{
  const dest='/tmp/claude-0/-home-user/9a67f47a-9ba4-5529-a3f9-de888e6c3a69/scratchpad/horns/IJZVNv5O6rA.webm';
  const t=Date.now();
  await b.file('nde-audio/IJZVNv5O6rA.webm').download({destination:dest});
  console.log('downloaded in',((Date.now()-t)/1000).toFixed(0)+'s',(require('fs').statSync(dest).size/1e6).toFixed(0)+'MB');
  process.exit(0);
})().catch(e=>{console.error('FAIL',e.message);process.exit(1)});
