// отправка анкеты с экраном загрузки: человек видит, что анкета уходит, и не жмет кнопку второй раз.
// фото и файлы с мобильного могут грузиться долго, поэтому показываем проценты загрузки.
// cxSend(адрес, тело запроса, заголовки) → Promise с ответом сервера (json)
(function(){
  var css='.sending{position:fixed;inset:0;z-index:50;display:grid;place-items:center;padding:24px;background:rgba(0,0,0,.88);color:#efede6;text-align:center;font-family:"Aktiv Grotesk","Helvetica Neue",Arial,sans-serif}'+
    '.sending__box{display:grid;justify-items:center;gap:16px;width:min(320px,100%)}'+
    '.sending__star{width:64px;height:64px;background:#ffee00;clip-path:polygon(50% 2.5%,61.8% 36.3%,97.6% 37%,69% 58.7%,79.4% 93%,50% 72.5%,20.6% 93%,31% 58.7%,2.4% 37%,38.2% 36.3%);animation:cxspin 1.6s linear infinite}'+
    '.sending__title{margin:0;font:900 26px/.95 "Aktiv Grotesk",Arial,sans-serif;letter-spacing:-.05em;text-transform:uppercase}'+
    '.sending__bar{width:100%;height:6px;background:rgba(239,237,230,.18)}'+
    '.sending__bar span{display:block;height:100%;width:0;background:#ffee00;transition:width .2s ease}'+
    '.sending__text{margin:0;font:500 14px/1.35 "Aktiv Grotesk",Arial,sans-serif;color:rgba(239,237,230,.7)}'+
    '@keyframes cxspin{to{transform:rotate(360deg)}}'+
    '@media (prefers-reduced-motion:reduce){.sending__star{animation:none}}';
  var st=document.createElement('style');st.textContent=css;document.head.appendChild(st);

  var el=null;
  function show(){
    el=document.createElement('div');el.className='sending';el.setAttribute('role','status');el.setAttribute('aria-live','polite');
    el.innerHTML='<div class="sending__box"><div class="sending__star"></div><p class="sending__title">отправляем анкету</p><div class="sending__bar"><span></span></div><p class="sending__text">не закрывай страницу, это может занять до минуты</p></div>';
    document.body.appendChild(el);
  }
  function progress(p,text){
    if(!el)return;
    el.querySelector('.sending__bar span').style.width=Math.round(p*100)+'%';
    if(text)el.querySelector('.sending__text').textContent=text;
  }
  function hide(){if(el){el.remove();el=null;}}

  // хостинг reg.ru отвечает 403 на любой multipart, поэтому FormData уходит одним потоком: строка json
  // {f: поля, x: [{k: имя поля, n: имя файла, s: размер}]}, потом байты файлов подряд. разбирает cx_unpack в site/collab/lib.php
  window.cxPack=function(fd){
    var f={},x=[],files=[];
    fd.forEach(function(v,k){if(typeof v==='string')f[k]=v;else{x.push({k:k,n:v.name||'file',s:v.size});files.push(v);}});
    return new Blob([JSON.stringify({f:f,x:x})+'\n'].concat(files),{type:'application/octet-stream'});
  };

  window.cxSend=function(url,body,headers){
    if(typeof FormData!=='undefined'&&body instanceof FormData)body=cxPack(body);
    show();
    return new Promise(function(resolve,reject){
      var x=new XMLHttpRequest();
      x.open('POST',url);
      Object.keys(headers||{}).forEach(function(k){x.setRequestHeader(k,headers[k]);});
      x.timeout=120000;
      // загрузка файлов это 90% полосы, последние 10% ждем ответ сервера
      x.upload.onprogress=function(e){if(e.lengthComputable)progress(.9*e.loaded/e.total);};
      x.upload.onload=function(){progress(.95,'почти готово, сохраняем');};
      x.onload=function(){
        var j={};try{j=JSON.parse(x.responseText);}catch(e){}
        if(x.status>=200&&x.status<300&&j.ok){progress(1);setTimeout(function(){hide();resolve(j);},250);}
        else{hide();reject(new Error(j.error||x.status));}
      };
      x.onerror=x.ontimeout=function(){hide();reject(new Error('network'));};
      x.send(body);
    });
  };
})();
