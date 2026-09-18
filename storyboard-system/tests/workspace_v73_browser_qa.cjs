/* V7.3 smoke/visual QA against a throwaway local database. */
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {spawn}=require('node:child_process'),{chromium}=require('playwright');
const root=path.resolve(__dirname,'..'),temp=fs.mkdtempSync(path.join(root,'scratch','v73-qa-'));
const out=path.join(root,'qa-artifacts','v73');fs.mkdirSync(out,{recursive:true});
const python=process.env.QA_PYTHON||'C:/Users/Hatsune/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/python.exe';
const base='http://127.0.0.1:18797';
const server=spawn(python,['-u','server.py'],{cwd:root,windowsHide:true,env:{...process.env,PORT:'18797',STORYBOARD_BIND:'127.0.0.1',STORYBOARD_DATA_ROOT:temp,STORYBOARD_ADMIN_USER:'qa-admin',STORYBOARD_ADMIN_PASSWORD:'Isolated-QA-2026!'}});
let browser,logs='';server.stdout.on('data',d=>logs=(logs+d).slice(-5000));server.stderr.on('data',d=>logs=(logs+d).slice(-5000));
(async()=>{
  for(let n=0;n<80;n++){try{if((await fetch(base+'/healthz')).ok)break;}catch(_){}await new Promise(r=>setTimeout(r,150));}
  const edge=['C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe','C:/Program Files/Microsoft/Edge/Application/msedge.exe'].find(fs.existsSync);
  browser=await chromium.launch({headless:true,...(edge?{executablePath:edge}:{})});
  const page=await browser.newPage({viewport:{width:1440,height:960}}),errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  const session=await(await page.request.post(base+'/api/login',{data:{username:'qa-admin',password:'Isolated-QA-2026!'}})).json();
  const bundle=await(await page.request.post(base+'/api/projects',{headers:{'X-CSRF-Token':session.csrf},data:{name:'V7.3 visual fixture'}})).json();
  const fixtureMedia=process.env.QA_MEDIA_DIR;
  if(fixtureMedia){
    for(const filename of fs.readdirSync(fixtureMedia).filter(name=>/\.jpg$/i.test(name)).slice(0,12)){
      const uploaded=await page.request.post(`${base}/api/projects/${bundle.project.id}/media?filename=${encodeURIComponent(filename.replace(/^[a-f\d-]{36}_/,''))}`,{headers:{'X-CSRF-Token':session.csrf,'Content-Type':'image/jpeg'},data:fs.readFileSync(path.join(fixtureMedia,filename))});
      assert.ok(uploaded.ok(),`fixture upload ${uploaded.status()}`);
    }
  }
  await page.goto(base);await page.waitForFunction(()=>globalThis.FrameForgeUI?.ready&&typeof state!=='undefined'&&state.session);
  await page.evaluate(id=>openProject(id),bundle.project.id);await page.waitForSelector('#workspaceToolbarV73');
  assert.equal(await page.locator('.ff73-toolbar-root').count(),1);
  assert.equal(await page.locator('.ff73-toolbar-root .ffui-segment').count(),4);
  for(const [index,name] of ['表格','卡片','视觉墙','时间线'].entries()){
    const control=page.locator('.ff73-toolbar-root .ffui-segment').nth(index);
    assert.equal(await control.getAttribute('aria-label'),name);await control.click();
    assert.equal(await control.getAttribute('data-state'),'on');
    await page.waitForTimeout(260);
    await page.screenshot({path:path.join(out,`${['table','cards','wall','timeline'][index]}-1440.png`),fullPage:false});
  }
  await page.locator('.ff73-toolbar-root .ffui-segment').first().click();
  await page.waitForTimeout(260);
  // Exercise the real portal interaction, not merely the closed toolbar.
  await page.getByRole('button',{name:'筛选',exact:true}).click();
  await page.screenshot({path:path.join(out,'filter-open-debug.png')});
  await page.getByRole('combobox',{name:'制作方式',exact:true}).click();
  const option=page.getByRole('option').first();
  await option.waitFor({state:'visible'});
  const layers=await page.evaluate(()=>({
    header:getComputedStyle(document.querySelector('.shot-table thead')).zIndex,
    popover:getComputedStyle(document.querySelector('.ffui-popover')).zIndex,
    dropdown:getComputedStyle(document.querySelector('.ffui-menu')).zIndex,
    background:getComputedStyle(document.querySelector('.shot-table thead th')).backgroundColor
  }));
  assert.ok(Number(layers.dropdown)>Number(layers.popover)&&Number(layers.popover)>Number(layers.header));
  assert.notEqual(layers.background,'rgba(0, 0, 0, 0)');
  await option.click();
  await page.getByRole('button',{name:'关闭筛选镜头',exact:true}).click();
  await page.evaluate(()=>{globalThis.qaEditorCancelled=false;openRichShotEditor(state.bundle.shots[0],'description').then(()=>globalThis.qaEditorCancelled=true);});
  await page.locator('.rich-editor-surface').waitFor();
  await page.keyboard.press('Escape');
  await page.waitForFunction(()=>globalThis.qaEditorCancelled);
  assert.equal(await page.locator('.rich-editor-dialog').count(),0,'Escape must settle and remove the editor');
  const duration=page.locator('#mainShotTable .editable-cell[data-field="duration_seconds"]').first();
  await duration.dblclick();
  const input=duration.locator('.inline-cell-editor');await input.waitFor();
  await input.press('Escape');
  assert.equal(await duration.locator('.inline-cell-editor').count(),0);
  const metrics=await page.evaluate(()=>({ui:document.body.dataset.uiVersion,overflow:document.documentElement.scrollWidth-document.documentElement.clientWidth,header:getComputedStyle(document.querySelector('.global-header')).height,sidebar:getComputedStyle(document.documentElement).getPropertyValue('--sidebar-width').trim(),font:getComputedStyle(document.body).fontFamily,background:getComputedStyle(document.body).backgroundColor}));
  const sidebarWidth=Number.parseFloat(metrics.sidebar);
  assert.deepEqual(metrics.ui,'7.3');assert.equal(metrics.header,'44px');assert.ok(sidebarWidth>=184&&sidebarWidth<=200,`Expected persisted sidebar width in the 184–200px compact range, actual '${metrics.sidebar}'`);assert.match(metrics.font,/Satoshi/);assert.equal(metrics.background,'rgb(0, 0, 0)');assert.ok(metrics.overflow<=1,`desktop page overflow ${metrics.overflow}px`);
  await page.setViewportSize({width:375,height:812});await page.waitForTimeout(100);
  const mobileOverflow=await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth);
  assert.ok(mobileOverflow<=1,`mobile page overflow ${mobileOverflow}px`);
  await page.screenshot({path:path.join(out,'table-375.png'),fullPage:false});
  await page.setViewportSize({width:1440,height:960});
  for(const theme of ['dark','light']){
    await page.evaluate(value=>document.documentElement.dataset.theme=value,theme);
    for(let index=0;index<4;index++){
      await page.locator('.ff73-toolbar-root .ffui-segment').nth(index).click();
      await page.waitForTimeout(300);
      await page.screenshot({path:path.join(out,`${['table','cards','wall','timeline'][index]}-${theme}-1440.png`)});
    }
    const shell=await page.evaluate(()=>['.global-header','.sidebar','.project-context-header','.workspace-toolbar','.workspace-main'].map(selector=>({selector,color:getComputedStyle(document.querySelector(selector)).backgroundColor})));
    const expected=theme==='dark'?'rgb(0, 0, 0)':'rgb(255, 255, 255)';
    shell.forEach(item=>assert.equal(item.color,expected,`${theme}: ${item.selector} breaks canvas continuity`));
    for(const [label,slug] of [['情绪板','moodboard'],['灯光平面图','lighting'],['素材资产库','assets'],['旁白与对齐','voiceover'],['审片与版本','review'],['交付与导出','exports'],['制作概览','overview']]){
      await page.getByRole('button',{name:label,exact:true}).click();
      if(['moodboard','lighting'].includes(slug)){
        const board=page.locator(`.ff-boards[aria-label="${slug==='lighting'?'灯光平面图编辑器':'情绪板编辑器'}"]`);await board.waitFor();
        await page.waitForFunction(()=>!!creativeBoardsMount);
        await page.waitForFunction(()=>document.querySelector('.ff-boards [data-action="create-board"]')?.disabled===false);
        if(await board.locator('.ff-boards-empty-state').count()){
          await board.getByRole('button',{name:'创建第一张画板',exact:true}).click();
          const tileBtn = board.locator('.ff-boards-tile-card, .ff-boards-asset-grid button').first();
          if(await tileBtn.count()) await tileBtn.click();
          if(slug==='lighting'){
            for(const mode of ['2D','2.5D','3D']){
              const control=board.getByRole('button',{name:mode,exact:true}); await control.click();
              assert.equal(await control.getAttribute('aria-pressed'),'true');
              assert.equal(await board.getAttribute('data-view-mode'),mode.toLowerCase());
            }
          }
          if(slug==='moodboard'&&fixtureMedia){
            for(let n=0;n<3;n++){
              await board.locator('.ff-boards-asset-grid button').nth(n).click();
              for(const [label,value] of [['宽度','240'],['高度','150'],['X',String(36+(n%2)*280)],['Y',String(240+Math.floor(n/2)*190)]]){
                const field=board.getByRole('spinbutton',{name:label,exact:true});await field.fill(value);await field.press('Tab');
              }
            }
          }
        }
      }
      await page.waitForTimeout(350);
      if(slug==='assets'&&fixtureMedia){
        await page.locator('.assets-v75-tile[data-media-state="loaded"]').first().waitFor();
        await page.getByRole('button',{name:'视频',exact:true}).click();
        assert.equal(await page.locator('.assets-v75-tile:visible').count(),0);
        await page.getByRole('button',{name:'全部素材',exact:true}).click();
        await page.getByRole('searchbox',{name:'搜索素材名称'}).fill('不存在的测试素材');
        assert.equal(await page.locator('.assets-v75-tile:visible').count(),0);
        await page.getByRole('searchbox',{name:'搜索素材名称'}).fill('');
        assert.equal(await page.locator('.assets-v75-tile:visible').count(),12);
      }
      await page.screenshot({path:path.join(out,`${slug}-${theme}-1440.png`)});
      assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),`${slug} ${theme} overflows viewport`);
    }
    await page.getByRole('button',{name:'分镜工作台',exact:true}).click();
  }
  assert.deepEqual(errors,[]);console.log('PASS V7.3 React shell, four views, tokens, font, desktop/mobile overflow and screenshots');
})().catch(error=>{console.error(error);console.error(logs);process.exitCode=1;}).finally(async()=>{if(browser)await browser.close();server.kill();console.log('QA fixture:',temp);});
