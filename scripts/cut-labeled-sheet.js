#!/usr/bin/env node
// cut-labeled-sheet.js — cut a FRAMED, LABELED sheet of drawings into transparent
// cutouts: one PNG per cell, plant/thing only, no frame line, no label text.
//
//   node scripts/cut-labeled-sheet.js <sheet.png> <outdir> --cols 5 --rows 4 \
//        --names "monstera,pothos,…"        (reading order; defaults to cell-01…)
//        [--tol 30] [--mincomp 80] [--band 0.14]
//        [--cards]   keep each cell WHOLE as a card — frame line, label and paper,
//                    cut down the middle of the gutters (Sophie, 2026-09-21:
//                    "no keep as cards" to the transparent cutouts)
//
// Built 2026-09-21 for Sophie's 5x4 houseplant sheet ("cut them out"). How it
// finds things, because every number here was measured on that sheet:
//   FRAMES  — a frame line is a row/column carrying a long STRAIGHT dark run
//     (>=0.7 of a cell's span, 2px gaps allowed; a plant never draws one that
//     long). The sketchy frame is double-stroked in places and the gutters are
//     ~9px, so strokes within 12px cluster into ONE boundary: the cell on the
//     left ends at the cluster's first stroke, the next cell starts at its last.
//     Expects cols+1 / rows+1 clusters and refuses otherwise — a wrong grid
//     is worse than no cut. (vectorize.gutters() looks for BLANK gutters and
//     missed 7 of 7 here: these gutters carry the frame ink.)
//   PAPER   — corner-sampled colour, border-connected flood fill at --tol
//     (RGB distance; 30 keeps the watercolour shadow under a pot, which sits
//     ~20 from the paper). Interior whites walled off by ink survive.
//   LABELS  — the letters are small connected components, so --mincomp drops
//     them along with paper splatter; a word that survives that is dropped if
//     its whole bounding box sits in the bottom --band of the frame (0.14
//     caught the last "d" of "bird of paradise"; 0.11 did not). A hanging leaf
//     is connected to its plant, so its box reaches higher and it stays.
//   INSET 6px inside the frame line, 8px transparent pad around the trim.
// Writes <outdir>/<name>.png and <outdir>/report.json (frames, what was
// dropped, box sizes). Review the result on a grey contact before filing.
const sharp = require('sharp');
const fs = require('fs'), path = require('path');
const argv = process.argv.slice(2), opt = {};
const pos = [];
for (let i = 0; i < argv.length; i++) {
  if (argv[i].startsWith('--')) { const k = argv[i].slice(2); if (argv[i + 1] === undefined || argv[i + 1].startsWith('--')) opt[k] = true; else { opt[k] = argv[i + 1]; i++; } } else pos.push(argv[i]);
}
const [SRC, OUT] = pos;
if (!SRC || !OUT) { console.error('usage: cut-labeled-sheet.js <sheet> <outdir> --cols N --rows N [--names a,b,…] [--tol 30] [--mincomp 80] [--band 0.14]'); process.exit(1); }
const COLS = +(opt.cols || 5), ROWS = +(opt.rows || 4);
const NAMES = opt.names ? opt.names.split(',').map((s) => s.trim()) : Array.from({ length: COLS * ROWS }, (_, i) => 'cell-' + String(i + 1).padStart(2, '0'));
if (NAMES.length !== COLS * ROWS) { console.error(`--names must hold ${COLS * ROWS} entries`); process.exit(1); }
const CARDS = 'cards' in opt;
const TOL = +(opt.tol || 30), MINCOMP = +(opt.mincomp || 80), LABEL_BAND = +(opt.band || 0.14), INSET = 6, PAD = 8;
fs.mkdirSync(OUT, { recursive: true });

(async () => {
  const { data, info } = await sharp(SRC).flatten({background:'#fff'}).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const W = info.width, H = info.height;
  const samp=(x,y)=>{const i=(y*W+x)*3;return [data[i],data[i+1],data[i+2]];};
  const lum = (x,y) => { const p=samp(x,y); return 0.299*p[0]+0.587*p[1]+0.114*p[2]; };
  // frame lines: rows/cols carrying a long straight dark run (gaps of 2px allowed)
  const dark=(x,y)=>lum(x,y)<225;
  const longest=(len,get)=>{let best=0,run=0,gap=0;for(let i=0;i<len;i++){if(get(i)){run+=gap+1;gap=0;}else{gap++;if(gap>2){best=Math.max(best,run);run=0;gap=0;}}}return Math.max(best,run);};
  const rowsRun=[];for(let y=0;y<H;y++)rowsRun.push(longest(W,x=>dark(x,y)||(y>0&&dark(x,y-1))||(y<H-1&&dark(x,y+1))));
  const colsRun=[];for(let x=0;x<W;x++)colsRun.push(longest(H,y=>dark(x,y)||(x>0&&dark(x-1,y))||(x<W-1&&dark(x+1,y))));
  const lines=(a,th)=>{const out=[];let s=-1;for(let i=0;i<=a.length;i++){const on=i<a.length&&a[i]>=th;if(on&&s<0)s=i;if(!on&&s>=0){if(out.length&&s-out[out.length-1][1]<=12)out[out.length-1][1]=i-1;else out.push([s,i-1]);s=-1;}}return out;};
  const hl=lines(rowsRun, H/ROWS*0.7), vl=lines(colsRun, H/ROWS*0.9);
  console.log('h-lines', JSON.stringify(hl)); console.log('v-lines', JSON.stringify(vl));
  if (hl.length!==ROWS+1 || vl.length!==COLS+1) throw new Error('expected '+(ROWS+1)+' h-clusters and '+(COLS+1)+' v-clusters');
  const report=[];
  for (let r=0;r<ROWS;r++) for (let c=0;c<COLS;c++) {
    const name = NAMES[r*COLS+c];
    const fl=vl[c][1], fr=vl[c+1][0], ft=hl[r][1], fb=hl[r+1][0];
    if (CARDS) {
      // outer edge of each cell = the middle of the gutter cluster (its first stroke
      // belongs to this cell, its last to the next); the sheet's own edge outside.
      const mid=(cl)=>Math.round((cl[0]+cl[1])/2);
      const L=c===0?0:mid(vl[c]), R=c===COLS-1?W:mid(vl[c+1]), T=r===0?0:mid(hl[r]), B=r===ROWS-1?H:mid(hl[r+1]);
      // even margin around the frame line: the smallest gap the gutters allow
      const m=Math.max(2, Math.min(vl[c][1]-vl[c][0], hl[r][1]-hl[r][0], 6));
      const cx0=Math.max(L, vl[c][0]-m), cx1=Math.min(R, vl[c+1][1]+m+1), cy0=Math.max(T, hl[r][0]-m), cy1=Math.min(B, hl[r+1][1]+m+1);
      const file=path.join(OUT, name.replace(/[^a-z0-9]+/g,'-')+'.png');
      // the SHEET's paper (its four corners averaged) — a pixel beside one frame can land on a splatter or a stroke and pad the card in a different cream (measured on three of twenty)
      const paper=[0,1,2].map(j=>Math.round([samp(2,2),samp(W-3,2),samp(2,H-3),samp(W-3,H-3)].reduce((t,q)=>t+q[j],0)/4));
      report.push({name,file,card:[cx0,cy0,cx1,cy1],paper});
      console.log(name.padEnd(18),'card',[cx0,cy0,cx1,cy1].join(','),(cx1-cx0)+'x'+(cy1-cy0));
      continue;
    }
    const x0=0,y0=0;
    const px0=x0+fl+INSET, px1=x0+fr-INSET, py0=y0+ft+INSET, py1=y0+fb-INSET;
    const w=px1-px0, h=py1-py0, N=w*h;
    const corners=[samp(px0+2,py0+2),samp(px1-3,py0+2),samp(px0+2,py1-3),samp(px1-3,py1-3)];
    const bg=[0,1,2].map(j=>corners.reduce((s,cc)=>s+cc[j],0)/4);
    const near=(x,yy)=>{const p=samp(x,yy);return Math.hypot(p[0]-bg[0],p[1]-bg[1],p[2]-bg[2])<=TOL;};
    const isbg=new Uint8Array(N); const st=[];
    const push=(x,yy)=>{const i=yy*w+x; if(!isbg[i]&&near(px0+x,py0+yy)){isbg[i]=1;st.push(i);}};
    for(let x=0;x<w;x++){push(x,0);push(x,h-1);} for(let yy=0;yy<h;yy++){push(0,yy);push(w-1,yy);}
    while(st.length){const i=st.pop(),x=i%w,yy=(i/w)|0; if(x>0)push(x-1,yy); if(x<w-1)push(x+1,yy); if(yy>0)push(x,yy-1); if(yy<h-1)push(x,yy+1);}
    // components of what is left
    const comp=new Int32Array(N).fill(-1); const comps=[];
    for(let i=0;i<N;i++){ if(isbg[i]||comp[i]>=0) continue; const id=comps.length; const cc={n:0,top:h,bot:-1}; const q=[i]; comp[i]=id;
      while(q.length){const j=q.pop(); cc.n++; const x=j%w,yy=(j/w)|0; if(yy<cc.top)cc.top=yy; if(yy>cc.bot)cc.bot=yy;
        for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]){const nx=x+dx,ny=yy+dy; if(nx<0||ny<0||nx>=w||ny>=h) continue; const jj=ny*w+nx; if(!isbg[jj]&&comp[jj]<0){comp[jj]=id;q.push(jj);}}}
      comps.push(cc); }
    const bandTop = h*(1-LABEL_BAND);
    const drop = comps.map(cc => cc.n<MINCOMP || cc.top>=bandTop);
    let droppedSmall=0, droppedLabel=0;
    for(let i=0;i<N;i++) if(!isbg[i]&&drop[comp[i]]){ if(comps[comp[i]].n<MINCOMP) droppedSmall++; else droppedLabel++; isbg[i]=1; }
    const out=Buffer.alloc(N*4); let bx0=w,by0=h,bx1=-1,by1=-1;
    for(let i=0;i<N;i++){const x=i%w,yy=(i/w)|0; const p=samp(px0+x,py0+yy); out[i*4]=p[0];out[i*4+1]=p[1];out[i*4+2]=p[2];out[i*4+3]=isbg[i]?0:255;
      if(!isbg[i]){if(x<bx0)bx0=x;if(x>bx1)bx1=x;if(yy<by0)by0=yy;if(yy>by1)by1=yy;}}
    const file=path.join(OUT, name.replace(/[^a-z0-9]+/g,'-')+'.png');
    await sharp(out,{raw:{width:w,height:h,channels:4}}).extract({left:bx0,top:by0,width:bx1-bx0+1,height:by1-by0+1})
      .extend({top:PAD,bottom:PAD,left:PAD,right:PAD,background:{r:0,g:0,b:0,alpha:0}}).png().toFile(file);
    const kept=comps.filter((cc,i)=>!drop[i]).map(cc=>cc.n).sort((a,b)=>b-a);
    report.push({name,file,frame:[x0+fl,y0+ft,x0+fr,y0+fb],bg:bg.map(Math.round),kept,droppedSmall,droppedLabel,box:[bx1-bx0+1,by1-by0+1]});
    console.log(name.padEnd(18), 'frame', [x0+fl,y0+ft,x0+fr,y0+fb].join(','), 'kept', kept.length, kept.slice(0,4).join('/'), 'small', droppedSmall, 'label', droppedLabel, 'box', bx1-bx0+1+'x'+(by1-by0+1));
  }
  if (CARDS) {
    // every card the same size: the largest cell, the rest padded on their own paper colour
    const cw=Math.max(...report.map(r=>r.card[2]-r.card[0])), chh=Math.max(...report.map(r=>r.card[3]-r.card[1]));
    for (const r of report) {
      const [x0,y0,x1,y1]=r.card, w=x1-x0, h=y1-y0, dx=cw-w, dy=chh-h;
      const [pr,pg,pb]=r.paper;
      await sharp(SRC).extract({left:x0,top:y0,width:w,height:h})
        .extend({left:Math.floor(dx/2),right:Math.ceil(dx/2),top:Math.floor(dy/2),bottom:Math.ceil(dy/2),background:{r:pr,g:pg,b:pb,alpha:1}})
        .png().toFile(r.file);
    }
    console.log('cards', cw+'x'+chh);
  }
  fs.writeFileSync(path.join(OUT,'report.json'), JSON.stringify(report,null,1));
})();
