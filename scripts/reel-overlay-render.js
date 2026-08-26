const {chromium}=require('/home/user/imageforge/node_modules/playwright');
const fs=require('fs'),path=require('path');
const FPS=30, DUR=Number(process.argv[2]||89.5);
(async()=>{
 fs.mkdirSync('frames',{recursive:true});
 const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium',args:['--force-color-profile=srgb','--disable-lcd-text']});
 const p=await b.newPage({viewport:{width:1080,height:1920},deviceScaleFactor:1});
 await p.goto('file://'+path.resolve('overlay.html'));
 await p.waitForFunction('window.__ready===true');
 await p.evaluate(()=>document.fonts.ready);
 const N=Math.ceil(DUR*FPS), t0=Date.now();
 for(let i=0;i<N;i++){
  await p.evaluate(t=>window.render(t),i/FPS);
  await p.screenshot({path:'frames/f'+String(i).padStart(5,'0')+'.png',omitBackground:true});
  if(i%150===0)console.log(i+'/'+N+'  '+((Date.now()-t0)/1000).toFixed(0)+'s');
 }
 await b.close();
 console.log('RENDER DONE '+N+' frames in '+((Date.now()-t0)/1000).toFixed(0)+'s');
})();
