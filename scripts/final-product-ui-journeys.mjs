// Real native UI journeys against disposable notes and localhost protocol fixtures.
// Called by final-product-ui-native.mjs; no real account, vault or provider is used.
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
export async function journeys({language,setup,evaluate,keyboardAction,key,navigate,settle,report,send}) {
  const requests={embedding:0,status:0,plan:0,batch:0,proposals:0};
  const serve=port=>new Promise((resolve,reject)=>{
    const server=createServer(async(req,res)=>{
      const chunks=[];for await(const chunk of req)chunks.push(chunk);
      const body=chunks.length?JSON.parse(Buffer.concat(chunks).toString('utf8')):{};
      let result;
      if(req.url==='/v1/embeddings') {
        requests.embedding++;
        const inputs=Array.isArray(body.input)?body.input:[body.input];
        result={data:inputs.map((text,index)=>({index,embedding:Array.from({length:12},(_,i)=>i===0?1:(String(text).length%(i+7)+1)/20)}))};
      } else if(req.url==='/v1/status'){requests.status++;result={protocolVersion:1,status:'ok',vaultCount:0};}
      else if(req.url.endsWith('/reconcile/plan')){requests.plan++;result={protocolVersion:1,generation:body.generation,serverGeneration:0,replaceVault:true,uploadPaths:body.notes.map(n=>n.path),deletePaths:[],unchangedPaths:[]};}
      else if(req.url.endsWith('/sync/batch')){requests.batch++;result={protocolVersion:1,generation:body.generation,applied:true,stale:false,operationsApplied:body.operations.length};}
      else if(req.url.includes('/proposals?')){requests.proposals++;result={protocolVersion:1,proposals:[],nextCursor:null};}
      else {res.writeHead(404);res.end();return;}
      res.writeHead(200,{'content-type':'application/json'});res.end(JSON.stringify(result));
    });
    server.once('error',reject);server.listen(port,'127.0.0.1',()=>resolve(server));
  });
  const servers=[];
  const waitFor=expression=>evaluate(`(async()=>{for(let i=0;i<800;i++){if(${expression})return true;await new Promise(r=>setTimeout(r,25));}throw new Error(${JSON.stringify('Timed out: '+expression)})})()`);
  const input=async(action,value)=>{
    await evaluate(`(()=>{const input=hv.contentEl.querySelector('[data-health-action="${action}"]');input.focus();input.select()})()`);
    await send('Input.insertText',{text:value});
  };
  try {
    servers.push(await serve(9290));servers.push(await serve(27124));
    await setup(0,language,true,true);
    await keyboardAction('profile-learning');await waitFor('!hv.controller.getState().savingPreferences');
    await keyboardAction('scan');await waitFor('!hv.controller.getState().busy && hv.contentEl.querySelector("[data-health-action=continue]")');
    await keyboardAction('continue');await waitFor('hv.contentEl.querySelector("nav")');
    await keyboardAction('review-finding');assert.equal(await evaluate('hv.route.page'),'findings');
    await keyboardAction('nav-health');assert.equal(requests.embedding,0);
    report.interactions.push({language,journey:'new local-first',result:'profile → local scan → recommendation → Findings → Health; zero provider requests'});

    await keyboardAction('nav-recall');assert(await evaluate('hv.recall.getSnapshot().firstRun'));
    await keyboardAction('recall-refresh');await waitFor('!hv.recall.getSnapshot().busy && hv.recall.getSnapshot().summary.due===2');
    await keyboardAction('recall-start');
    for(let i=0;i<2;i++) {
      await keyboardAction('recall-reveal');
      assert(await evaluate('document.activeElement.hasAttribute("data-recall-answer")'));
      await key('3','Digit3',51);await waitFor('!hv.recall.getSnapshot().busy');await settle();
    }
    assert(await evaluate('!!hv.contentEl.querySelector("[data-health-action=recall-back]") && !hv.contentEl.querySelector("[data-health-action=recall-reveal]")'));
    await keyboardAction('recall-back');assert.equal(await evaluate('hv.recall.getSnapshot().summary.due'),0);
    report.interactions.push({language,journey:'native Recall',result:'first-run → inventory → 2 due → reveal → keyboard 3 twice → completion → overview'});

    await keyboardAction('nav-discover');await keyboardAction('discover-enable');
    await keyboardAction('semantic-mode-custom');await input('semantic-field-baseUrl','http://127.0.0.1:9290/v1');await input('semantic-field-model','ui-journey-synthetic');
    await keyboardAction('semantic-connect');await waitFor('hv.semanticSetup?.step==="connected"');
    assert.equal(requests.embedding,1);await keyboardAction('semantic-build');
    await waitFor('!!document.querySelector(".modal button.mod-cta")');
    report.interactions.push({language,confirmation:'semantic index',text:await evaluate('document.querySelector(".modal").innerText')});
    await evaluate('document.querySelector(".modal button.mod-cta").focus()');await key('Enter','Enter',13);
    await waitFor('hv.semantic.getSnapshot().state==="ready" && !hv.semantic.getSnapshot().busy');
    await keyboardAction('nav-discover');
    await keyboardAction('neighborhood-open');await waitFor('!hv.neighborhood.getSnapshot().busy');
    // Source selection uses the existing searchable text list.
    await keyboardAction('neighborhood-source-0');await waitFor('hv.neighborhood.getSnapshot().state==="ready"');
    await keyboardAction('neighborhood-back');assert.equal(await evaluate('hv.route.page'),'discover');
    await keyboardAction('global-map-open');await waitFor('hv.globalMap.getSnapshot().state==="ready"');
    await input('global-map-search','Hash Join');await keyboardAction('global-map-result-0');
    await keyboardAction('global-map-focus');await waitFor('!!hv.globalMap.getSnapshot().focus && !hv.globalMap.getSnapshot().busy');
    await evaluate('hv.globalMapView.viewport={x:12,y:-8,zoom:1.2};hv.render()');
    const before=await evaluate('({query:hv.globalMapView.query,selected:hv.globalMapView.selected,viewport:hv.globalMapView.viewport})');
    await keyboardAction('global-map-explore');await waitFor('hv.neighborhood.getSnapshot().state==="ready"');
    await keyboardAction('neighborhood-back');
    assert.equal(await evaluate('hv.route.page'),'semantic-map');
    assert.deepEqual(await evaluate('({query:hv.globalMapView.query,selected:hv.globalMapView.selected,viewport:hv.globalMapView.viewport})'),before);
    await keyboardAction('global-map-back');await keyboardAction('connections-open');await waitFor('hv.comparison.getSnapshot().state==="ready"');
    await keyboardAction('connections-filters');await keyboardAction('connections-rank-mutual-top-3');
    await keyboardAction('connections-pair-0');await keyboardAction('connections-review-useful');
    const comparison=await evaluate('({query:hv.comparisonView.query,selectedPair:hv.comparisonView.selectedPair,rank:hv.comparisonView.rankFilter,reviews:[...hv.comparisonView.reviewByPairId]})');
    assert.equal(typeof comparison.selectedPair,'string');
    await keyboardAction('connections-explore-left');await waitFor('hv.neighborhood.getSnapshot().state==="ready"');await keyboardAction('neighborhood-back');
    assert.equal(await evaluate('hv.route.page'),'connection-opportunities');
    assert.deepEqual(await evaluate('({query:hv.comparisonView.query,selectedPair:hv.comparisonView.selectedPair,rank:hv.comparisonView.rankFilter,reviews:[...hv.comparisonView.reviewByPairId]})'),comparison);
    await keyboardAction('nav-health');await keyboardAction('topology-open');await waitFor('hv.topology.getSnapshot().state==="ready"');await keyboardAction('topology-back');assert.equal(await evaluate('hv.route.page'),'health');
    report.interactions.push({language,journey:'semantic + all child origins',result:'configure/check/build → Discover → Neighborhood → Map/focus → Neighborhood/Back with query, selection and viewport → comparison/filter/review → Neighborhood/Back → Topology/Back'});

    await keyboardAction('nav-connect');await keyboardAction('connect-setup');await keyboardAction('connect-mode-local');await input('connect-field-token','synthetic-only');
    await keyboardAction('connect-submit');await waitFor('hv.connect.getSnapshot().enabled && !hv.connect.getSnapshot().busy');
    assert.equal(await evaluate('hv.connect.getSnapshot().mirrorKnownReady'),false);
    await keyboardAction('connect-check');await waitFor('!hv.connect.getSnapshot().busy');
    await keyboardAction('connect-sync');assert(await evaluate('!!hv.connectConfirmation'));
    await keyboardAction('connect-sync-confirm');await waitFor('hv.connect.getSnapshot().mirrorKnownReady && !hv.connect.getSnapshot().busy');
    await keyboardAction('connect-review');await waitFor('!!document.querySelector(".modal")');await settle();await key('Escape','Escape',27);
    assert(requests.status>=2&&requests.plan>0&&requests.batch>0&&requests.proposals>0,JSON.stringify(requests));
    report.interactions.push({language,journey:'Connect',result:'disabled → configure/test → check → explicit sync confirmation → mirror ready → proposal review entry',localhostRequests:{...requests}});

    await navigate('tools');await keyboardAction('tool-openBatchProcessing');await waitFor('!!document.querySelector(".modal")');await key('Escape','Escape',27);
    await keyboardAction('nav-settings');await keyboardAction('settings-semantic');assert(await evaluate('!!hv.semanticSetup'));await keyboardAction('semantic-back');
    report.interactions.push({language,journey:'power user',result:'Tools → batch workflow modal → return → Settings → semantic configuration → Health'});
  } finally {await evaluate('window.nativeRestore?.()');await Promise.all(servers.map(server=>new Promise(resolve=>server.close(resolve))));}
}
