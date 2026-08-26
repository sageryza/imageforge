const {chromium}=require('/home/user/imageforge/node_modules/playwright');
const fs=require('fs'),path=require('path');
(async()=>{
 const times=process.argv.slice(2).map(Number);
 const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium',args:['--force-color-profile=srgb','--disable-lcd-text']});
 const p=await b.newPage({viewport:{width:1080,height:1920},deviceScaleFactor:1});
 await p.goto('file://'+path.resolve('overlay.html'));
 await p.waitForFunction('window.__ready===true');
 await p.evaluate(()=>document.fonts.ready);
 fs.mkdirSync('probe',{recursive:true});
 for(const t of times){
  await p.evaluate(t=>window.render(t),t);
  await p.screenshot({path:`probe/t${t}.png`,omitBackground:true});
 }
 await b.close();console.log('done');
})();
