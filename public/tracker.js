(function(){
  var U='https://pzgpbskztgyjtyudjncj.supabase.co/rest/v1/';
  var K='eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB6Z3Bic2t6dGd5anR5dWRqbmNqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA3NTIzNDQsImV4cCI6MjA5NjMyODM0NH0.8JIS3MtJOHY2FAk1Chhqg42l0-9VSBf36s-CvKPr-qg';
  var H={'Content-Type':'application/json','apikey':K,'Authorization':'Bearer '+K,'Prefer':'return=minimal'};

  var sid=sessionStorage.getItem('_it_sid');
  if(!sid){sid='s_'+Math.random().toString(36).substr(2,12)+'_'+Date.now();sessionStorage.setItem('_it_sid',sid);}

  var ps=Date.now(),ms=0;

  function post(table,body){
    try{
      fetch(U+table,{method:'POST',headers:H,body:JSON.stringify(body),keepalive:true}).then(function(r){
        if(!r.ok)r.text().then(function(t){console.warn('[ITImpact] '+table+' error:',r.status,t);});
      }).catch(function(e){console.warn('[ITImpact] fetch error:',e);});
    }catch(e){console.warn('[ITImpact] error:',e);}
  }

  function upsert(table,body){
    try{
      var h=Object.assign({},H,{'Prefer':'resolution=merge-duplicates,return=minimal'});
      fetch(U+table,{method:'POST',headers:h,body:JSON.stringify(body),keepalive:true}).then(function(r){
        if(!r.ok)r.text().then(function(t){console.warn('[ITImpact] '+table+' upsert error:',r.status,t);});
      }).catch(function(e){console.warn('[ITImpact] upsert error:',e);});
    }catch(e){}
  }

  function ev(type,extra){
    var d={session_id:sid,event_type:type,page_url:location.href,page_title:document.title,referrer:document.referrer,user_agent:navigator.userAgent,screen_width:screen.width,screen_height:screen.height};
    if(extra)for(var k in extra)d[k]=extra[k];
    post('analytics_events',d);
  }

  function sess(){
    var t=Math.round((Date.now()-ps)/1000);
    upsert('analytics_sessions',{id:sid,first_page:sessionStorage.getItem('_it_fp')||location.href,last_page:location.href,pages_viewed:parseInt(sessionStorage.getItem('_it_pv')||'1'),total_time:t,device:/Mobile|Android|iPhone|iPad/i.test(navigator.userAgent)?'mobile':'desktop',browser:(navigator.userAgent.match(/(Chrome|Firefox|Safari|Edge|Opera)/i)||['Other'])[0],started_at:sessionStorage.getItem('_it_start')||new Date().toISOString(),ended_at:new Date().toISOString()});
  }

  if(!sessionStorage.getItem('_it_fp')){
    sessionStorage.setItem('_it_fp',location.href);
    sessionStorage.setItem('_it_start',new Date().toISOString());
  }
  var pv=parseInt(sessionStorage.getItem('_it_pv')||'0')+1;
  sessionStorage.setItem('_it_pv',''+pv);

  ev('pageview');
  sess();

  document.addEventListener('click',function(e){
    var el=e.target;
    if(!el)return;
    var tag=el.tagName||'';
    var text=(el.innerText||el.textContent||'').trim().substring(0,100);
    ev('click',{click_x:e.clientX,click_y:e.clientY,element_tag:tag,element_text:text});
  },true);

  window.addEventListener('scroll',function(){
    var h=document.documentElement.scrollHeight-window.innerHeight;
    if(h>0){var s=Math.round((window.scrollY/h)*100);if(s>ms)ms=s;}
  },{passive:true});

  setInterval(function(){sess();},15000);

  window.addEventListener('beforeunload',function(){
    ev('page_leave',{time_on_page:Math.round((Date.now()-ps)/1000),scroll_depth:ms});
    sess();
  });

  document.addEventListener('visibilitychange',function(){
    if(document.visibilityState==='hidden'){sess();}
  });

  console.log('[ITImpact] Tracking active | session: '+sid);
})();
