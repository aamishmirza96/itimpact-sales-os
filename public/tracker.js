(function(){
  var SUPABASE_URL='https://pzgpbskztgyjtyudjncj.supabase.co';
  var SUPABASE_KEY='eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB6Z3Bic2t6dGd5anR5dWRqbmNqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA3NTIzNDQsImV4cCI6MjA5NjMyODM0NH0.8JIS3MtJOHY2FAk1Chhqg42l0-9VSBf36s-CvKPr-qg';

  var sid=sessionStorage.getItem('_it_sid');
  if(!sid){sid='s_'+Math.random().toString(36).substr(2,12)+'_'+Date.now();sessionStorage.setItem('_it_sid',sid);}
  var pageStart=Date.now();
  var maxScroll=0;

  function send(type,extra){
    var body={session_id:sid,event_type:type,page_url:location.pathname,page_title:document.title,referrer:document.referrer,user_agent:navigator.userAgent,screen_width:screen.width,screen_height:screen.height};
    if(extra)Object.assign(body,extra);
    fetch(SUPABASE_URL+'/rest/v1/analytics_events',{method:'POST',headers:{'Content-Type':'application/json','apikey':SUPABASE_KEY,'Authorization':'Bearer '+SUPABASE_KEY,'Prefer':'return=minimal'},body:JSON.stringify(body)}).catch(function(){});
  }

  function upsertSession(){
    var t=Math.round((Date.now()-pageStart)/1000);
    var body={id:sid,first_page:sessionStorage.getItem('_it_fp')||location.pathname,last_page:location.pathname,pages_viewed:parseInt(sessionStorage.getItem('_it_pv')||'1'),total_time:t,device:/Mobile|Android/i.test(navigator.userAgent)?'mobile':'desktop',browser:navigator.userAgent.match(/(Chrome|Firefox|Safari|Edge|Opera)/i)?RegExp.$1:'Other',started_at:sessionStorage.getItem('_it_start')||new Date().toISOString(),ended_at:new Date().toISOString()};
    fetch(SUPABASE_URL+'/rest/v1/analytics_sessions',{method:'POST',headers:{'Content-Type':'application/json','apikey':SUPABASE_KEY,'Authorization':'Bearer '+SUPABASE_KEY,'Prefer':'resolution=merge-duplicates,return=minimal'},body:JSON.stringify(body)}).catch(function(){});
  }

  if(!sessionStorage.getItem('_it_fp')){sessionStorage.setItem('_it_fp',location.pathname);sessionStorage.setItem('_it_start',new Date().toISOString());}
  var pv=parseInt(sessionStorage.getItem('_it_pv')||'0')+1;
  sessionStorage.setItem('_it_pv',pv.toString());

  send('pageview');
  upsertSession();

  document.addEventListener('click',function(e){
    var el=e.target.closest('a,button,input[type=submit],.cta,[data-track]');
    if(!el)return;
    send('click',{click_x:e.clientX,click_y:e.clientY,element_tag:el.tagName,element_text:(el.textContent||'').trim().substring(0,100)});
  });

  window.addEventListener('scroll',function(){
    var s=Math.round((window.scrollY/(document.body.scrollHeight-window.innerHeight))*100);
    if(s>maxScroll)maxScroll=s;
  });

  window.addEventListener('beforeunload',function(){
    var t=Math.round((Date.now()-pageStart)/1000);
    send('page_leave',{time_on_page:t,scroll_depth:maxScroll});
    upsertSession();
  });

  if(window.history&&history.pushState){
    var origPush=history.pushState;
    history.pushState=function(){origPush.apply(this,arguments);pageStart=Date.now();maxScroll=0;pv++;sessionStorage.setItem('_it_pv',pv.toString());send('pageview');upsertSession();};
    window.addEventListener('popstate',function(){pageStart=Date.now();maxScroll=0;pv++;sessionStorage.setItem('_it_pv',pv.toString());send('pageview');upsertSession();});
  }
})();
