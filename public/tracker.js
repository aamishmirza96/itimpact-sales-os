(function(){
  var SB='https://pzgpbskztgyjtyudjncj.supabase.co';
  var SK='eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB6Z3Bic2t6dGd5anR5dWRqbmNqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA3NTIzNDQsImV4cCI6MjA5NjMyODM0NH0.8JIS3MtJOHY2FAk1Chhqg42l0-9VSBf36s-CvKPr-qg';
  var sid=sessionStorage.getItem('_it_sid');
  if(!sid){sid='s_'+Math.random().toString(36).substr(2,12)+'_'+Date.now();sessionStorage.setItem('_it_sid',sid);}
  var ps=Date.now(),ms=0;

  function post(table,body){
    var h={'Content-Type':'application/json','apikey':SK,'Authorization':'Bearer '+SK,'Prefer':'return=minimal'};
    try{fetch(SB+'/rest/v1/'+table,{method:'POST',headers:h,body:JSON.stringify(body)}).catch(function(){});}catch(e){}
  }
  function beacon(table,body){
    var h={'type':'application/json'};
    var blob=new Blob([JSON.stringify(body)],h);
    if(navigator.sendBeacon){
      navigator.sendBeacon(SB+'/rest/v1/'+table+'?apikey='+SK,blob);
    }else{post(table,body);}
  }
  function ev(type,extra){
    var d={session_id:sid,event_type:type,page_url:location.href,page_title:document.title,referrer:document.referrer,user_agent:navigator.userAgent,screen_width:screen.width,screen_height:screen.height};
    if(extra)for(var k in extra)d[k]=extra[k];
    post('analytics_events',d);
  }
  function sess(useBeacon){
    var t=Math.round((Date.now()-ps)/1000);
    var d={id:sid,first_page:sessionStorage.getItem('_it_fp')||location.href,last_page:location.href,pages_viewed:parseInt(sessionStorage.getItem('_it_pv')||'1'),total_time:t,device:/Mobile|Android/i.test(navigator.userAgent)?'mobile':'desktop',browser:(navigator.userAgent.match(/(Chrome|Firefox|Safari|Edge|Opera)/i)||['Other'])[0],started_at:sessionStorage.getItem('_it_start')||new Date().toISOString(),ended_at:new Date().toISOString()};
    if(useBeacon){beacon('analytics_sessions',d);}else{
      fetch(SB+'/rest/v1/analytics_sessions',{method:'POST',headers:{'Content-Type':'application/json','apikey':SK,'Authorization':'Bearer '+SK,'Prefer':'resolution=merge-duplicates,return=minimal'},body:JSON.stringify(d)}).catch(function(){});
    }
  }

  if(!sessionStorage.getItem('_it_fp')){sessionStorage.setItem('_it_fp',location.href);sessionStorage.setItem('_it_start',new Date().toISOString());}
  var pv=parseInt(sessionStorage.getItem('_it_pv')||'0')+1;
  sessionStorage.setItem('_it_pv',''+pv);

  ev('pageview');
  sess(false);

  document.addEventListener('click',function(e){
    var el=e.target.closest('a,button,input[type=submit],input[type=button],.cta,[data-track],[href]');
    if(!el)return;
    ev('click',{click_x:e.clientX,click_y:e.clientY,element_tag:el.tagName,element_text:(el.innerText||el.textContent||'').trim().substring(0,100)});
  },true);

  window.addEventListener('scroll',function(){
    var h=document.body.scrollHeight-window.innerHeight;
    if(h>0){var s=Math.round((window.scrollY/h)*100);if(s>ms)ms=s;}
  },{passive:true});

  setInterval(function(){sess(false);},30000);

  window.addEventListener('beforeunload',function(){
    ev('page_leave',{time_on_page:Math.round((Date.now()-ps)/1000),scroll_depth:ms});
    sess(true);
  });

  document.addEventListener('visibilitychange',function(){
    if(document.visibilityState==='hidden'){sess(true);}
  });

  if(window.history&&history.pushState){
    var op=history.pushState;
    history.pushState=function(){op.apply(this,arguments);ps=Date.now();ms=0;pv++;sessionStorage.setItem('_it_pv',''+pv);ev('pageview');sess(false);};
    window.addEventListener('popstate',function(){ps=Date.now();ms=0;pv++;sessionStorage.setItem('_it_pv',''+pv);ev('pageview');sess(false);});
  }
  console.log('[ITImpact] Analytics tracking active');
})();
