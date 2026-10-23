// движок анкет connected: шаги, проверка, фото, черновик, отправка в базу на хостинге (экран загрузки: sending.js).
// настройки анкеты лежат на странице в window.CX_FORM (см. site/join/index.html)
(function(){
  var C=window.CX_FORM;
  // страницы раздает github pages, а заявки принимает php на reg.ru по адресу admin.connected
  var ENDPOINT=location.hostname==='connected.tenzzzo.com'?'https://admin.connected.tenzzzo.com/collab/submit.php':'../collab/submit.php';
  // личная ссылка обновления: свой черновик, чтобы правки не смешались с другой анкетой на этом телефоне
  var DRAFT='connected-'+C.form+'-draft'+(C.prefill?'-'+C.prefill:'');
  // вопросы, скрытые в редакторе (off:true), анкета не показывает. шаг без вопросов пропускается
  var STEPS=C.steps.map(function(s){var o={};for(var k in s)o[k]=s[k];o.fields=s.fields.filter(function(f){return !f.off;});return o;}).filter(function(s){return s.fields.length;});
  // фото {blob,url}, в черновик не сохраняются. main: главное (обложка визитки, уходит первым), extras: ячейки 1, 2, 3 (пустая ячейка null), уходят в этом порядке
  var main=null,extras=[];
  function allPhotos(){return (main?[main]:[]).concat(extras.filter(Boolean));}
  // фото с iphone приходят в heic: safari их открывает сам, остальные браузеры через heic-to.js (3 мб, грузится только когда нужен)
  var HEIC_JS=document.currentScript.src.replace(/form\.js.*$/,'heic-to.js'),heicLib=null;

  var state={step:1,data:{}};
  try{var saved=JSON.parse(localStorage.getItem(DRAFT)||'null');if(saved&&saved.data){state=saved;if(state.step>STEPS.length)state.step=1;}}catch(e){}
  // вводный экран (блоки data-intro и кнопка #start, см. site/choir/index.html): виден только до начала анкеты
  var start=document.getElementById('start'),intro=document.querySelectorAll('[data-intro]');
  if(state.started===undefined&&(state.step>1||Object.keys(state.data).length))state.started=true;

  var stepEl=document.getElementById('step'),form=document.getElementById('form'),
      back=document.getElementById('back'),next=document.getElementById('next'),
      alertEl=document.getElementById('alert'),label=document.getElementById('progress-label'),
      bar=document.getElementById('progress');
  bar.style.setProperty('--steps',STEPS.length);
  bar.innerHTML=STEPS.map(function(){return '<span></span>';}).join('');
  var bars=bar.querySelectorAll('span');

  function save(){try{localStorage.setItem(DRAFT,JSON.stringify(state));}catch(e){}}
  function fields(){return STEPS[state.step-1].fields;}
  function esc(s){return String(s).replace(/[&<>"]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c];});}

  // при max больше 1 ячейка «главное фото» и пронумерованные ячейки 1, 2, 3: в каждую одно фото, чтобы порядок был ровно такой, как в ячейках.
  // при max 1 просто одно фото
  function slots(f){return (f.max||4)>1;}
  function addTile(cls,text,kind){return '<label class="photo photo--add'+cls+'">'+text+'<input type="file" accept="image/*,.heic,.heif" hidden data-photos="'+kind+'"></label>';}
  function renderPhotos(f){
    var max=f.max||4,del='<button type="button" class="photo__del" aria-label="убрать фото" data-del=';
    if(!slots(f))return main?'<div class="photo"><img src="'+main.url+'" alt="">'+del+'"main">×</button></div>':addTile('','+ фото','main');
    var html=main?'<div class="photo photo--main"><img src="'+main.url+'" alt=""><span class="photo__tag">главное</span>'+del+'"main">×</button></div>'
      :addTile(' photo--main','+ загрузить главное фото<small>портрет, где видно лицо</small>','main');
    for(var i=0;i<max-1;i++){
      var p=extras[i];
      html+=p?'<div class="photo"><img src="'+p.url+'" alt=""><span class="photo__tag photo__tag--n">'+(i+1)+'</span>'+del+'"'+i+'">×</button><button type="button" class="photo__up" data-main="'+i+'">'+(main?'сделать главным':'главное')+'</button></div>'
        :addTile('','+ загрузить<br>фото '+(i+1),String(i));
    }
    return html;
  }

  function renderField(f){
    var v=state.data[f.key];
    var req=f.req?' <span class="q__req">*</span>':'';
    var hint=f.hint?'<small>'+esc(f.hint)+'</small>':'';
    var id='f-'+f.key;
    if(f.type==='consent'||f.type==='check'){
      return '<div class="q" data-key="'+f.key+'"><label class="consent"><input type="checkbox" id="'+id+'" data-check'+(v?' checked':'')+'><span>'+f.html+(f.req?' <span class="q__req">*</span>':'')+'</span></label></div>';
    }
    if(f.type==='photos'){
      return '<div class="q" data-key="'+f.key+'"><p class="q__label">'+esc(f.label)+req+hint+'</p><div class="photos'+(slots(f)?' photos--slots':'')+'">'+renderPhotos(f)+'</div></div>';
    }
    if(f.type==='chips'){
      var sel=Array.isArray(v)?v:(v?[v]:[]);
      var chips=f.options.map(function(o){
        return '<button type="button" class="chip" data-opt="'+esc(o)+'" aria-pressed="'+(sel.indexOf(o)>-1)+'">'+esc(o)+'</button>';
      }).join('');
      return '<fieldset class="q" data-key="'+f.key+'"><legend class="q__label">'+esc(f.label)+req+hint+'</legend><div class="chips" data-multi="'+(!!f.multi)+'">'+chips+'</div></fieldset>';
    }
    var common=' class="input" id="'+id+'" name="'+f.key+'" placeholder="'+esc(f.ph||'')+'"'+(f.auto?' autocomplete="'+f.auto+'"':'')+(f.inputmode?' inputmode="'+f.inputmode+'"':'')+(f.max&&f.type!=='photos'?' maxlength="'+f.max+'"':'');
    var input=f.type==='textarea'?'<textarea'+common+'>'+esc(v||'')+'</textarea>':'<input type="text"'+common+' value="'+esc(v||'')+'">';
    return '<div class="q" data-key="'+f.key+'"><label class="q__label" for="'+id+'">'+esc(f.label)+req+hint+'</label>'+input+'</div>';
  }

  function render(){
    var s=STEPS[state.step-1],last=state.step===STEPS.length;
    stepEl.innerHTML='<div class="step"><div class="step__head" data-theme="'+(s.theme||C.theme)+'"><p class="step__title">'+esc(s.title)+'</p>'+(s.sub?'<p class="step__sub">'+esc(s.sub)+'</p>':'')+'</div>'+fields().map(renderField).join('')+'</div>';
    stepEl.setAttribute('data-theme',s.theme||C.theme);
    label.textContent='шаг '+state.step+' из '+STEPS.length;
    for(var i=0;i<bars.length;i++){bars[i].classList.toggle('is-on',i<state.step);}
    back.hidden=state.step===1&&!start;
    next.className='btn btn--next'+(last?' btn--send':'');
    next.innerHTML=(last?(C.sendLabel||'отправить анкету'):'дальше')+' <span class="star"></span>';
    alertEl.hidden=true;
  }

  function collect(){
    stepEl.querySelectorAll('.input').forEach(function(el){state.data[el.id.replace('f-','')]=el.value.trim();});
    stepEl.querySelectorAll('[data-check]').forEach(function(el){
      var f=fields().filter(function(x){return 'f-'+x.key===el.id;})[0];
      state.data[f.key]=el.checked?(f.value||'да'):'';
    });
    save();
  }

  // дата рождения дд.мм.гггг → полных лет, или null, если дата не похожа на настоящую
  function age(v){
    var m=/^(\d{2})\.(\d{2})\.(\d{4})$/.exec(v);if(!m)return null;
    var d=new Date(+m[3],+m[2]-1,+m[1]),now=new Date();
    if(d.getDate()!==+m[1]||d.getMonth()!==+m[2]-1)return null;
    var a=now.getFullYear()-d.getFullYear()-((now.getMonth()<d.getMonth()||(now.getMonth()===d.getMonth()&&now.getDate()<d.getDate()))?1:0);
    return a>=14&&a<=99?a:null;
  }
  // хэштеги как их написал человек: с # или без, через пробел или запятую. внутри одного хэштега пробелы убираются (#арт директор → #артдиректор).
  // так же разбирает collab_hashtags() в site/collab/lib.php
  function hashtags(s){
    s=String(s||'').toLowerCase().replace(/ё/g,'е');
    var parts=s.indexOf('#')>-1?s.split(/[#,;\n]+/):/[,;\n]/.test(s)?s.split(/[,;\n]+/):s.split(/\s+/),out=[];
    parts.forEach(function(p){p=p.replace(/[^\p{L}\p{N}_]+/gu,'').slice(0,30);if(p&&out.indexOf('#'+p)<0&&out.length<7)out.push('#'+p);});
    return out;
  }
  function clean(s){return String(s||'').replace(/^https?:\/\//,'').replace(/^(www\.)?(t\.me|instagram\.com)\//,'').replace(/[/?].*$/,'').replace(/^@/,'');}

  function validate(){
    var ok=true,first=null;
    stepEl.querySelectorAll('.q').forEach(function(q){q.classList.remove('is-invalid');var e=q.querySelector('.q__error');if(e)e.remove();});
    fields().forEach(function(f){
      var v=f.type==='photos'?(main?[main]:[]):state.data[f.key];
      var more=extras.filter(Boolean).length,max=f.max||4;
      var empty=Array.isArray(v)?!v.length:!v,msg=f.type!=='photos'?'заполни, пожалуйста':!slots(f)?'добавь фото':more?'выбери главное фото: нажми «главное» на одном из фото':'загрузи главное фото';
      var bad=false;
      // дополнительные фото все или никаких: только главное или главное и фото 1, 2, 3
      if(!empty&&f.type==='photos'&&slots(f)&&more&&more<max-1){bad=true;msg='загрузи либо одно главное фото, либо все '+max+': главное и фото '+Array.apply(null,Array(max-1)).map(function(x,i){return i+1;}).join(', ');}
      if(!empty&&f.check==='telegram'&&!/^[A-Za-z][A-Za-z0-9_]{3,31}$/.test(clean(v))){bad=true;msg='проверь ник: латиница, цифры и _';}
      if(!empty&&f.check==='instagram'&&!/^[A-Za-z0-9_.]{2,30}$/.test(clean(v))){bad=true;msg='напиши ник: латиница, цифры, точка и _';}
      if(!empty&&f.check==='email'&&!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v)){bad=true;msg='проверь почту';}
      if(!empty&&f.check==='age'&&!(+v>=14&&+v<=99)){bad=true;msg='напиши возраст числом';}
      if(!empty&&f.check==='hashtags'&&!hashtags(v).length){bad=true;msg='напиши хотя бы один хэштег, например #фотограф';}
      if(!empty&&f.check==='date'&&age(v)===null){bad=true;msg='напиши дату так: 05.03.1999';}
      if((f.req&&empty)||bad){
        ok=false;
        var q=stepEl.querySelector('[data-key="'+f.key+'"]');
        if(q){q.classList.add('is-invalid');var p=document.createElement('p');p.className='q__error';p.textContent=f.type==='consent'?'без согласия не сможем рассмотреть анкету':(f.type==='check'?'без этого согласия не сможем опубликовать визитку':msg);q.appendChild(p);if(!first)first=q;}
      }
    });
    if(first)first.scrollIntoView({behavior:'smooth',block:'center'});
    return ok;
  }

  function heicLoad(){
    if(!heicLib)heicLib=new Promise(function(resolve,reject){
      var sc=document.createElement('script');sc.src=HEIC_JS;
      sc.onload=function(){window.HeicTo?resolve(window.HeicTo):reject(new Error('photo'));};
      sc.onerror=function(){heicLib=null;reject(new Error('photo'));};
      document.head.appendChild(sc);
    });
    return heicLib;
  }
  function isHeic(file){return /heic|heif/i.test(file.type)||/\.(heic|heif)$/i.test(file.name||'');}

  // фото уменьшаются в браузере до 1600px, чтобы быстро грузились с мобильного
  function draw(file){
    return new Promise(function(resolve,reject){
      var img=new Image(),url=URL.createObjectURL(file);
      img.onload=function(){
        var k=Math.min(1,1600/Math.max(img.width,img.height)),c=document.createElement('canvas');
        c.width=Math.round(img.width*k);c.height=Math.round(img.height*k);
        c.getContext('2d').drawImage(img,0,0,c.width,c.height);
        URL.revokeObjectURL(url);
        c.toBlob(function(b){b?resolve(b):reject(new Error('photo'));},'image/jpeg',.86);
      };
      img.onerror=function(){URL.revokeObjectURL(url);reject(new Error('photo'));};
      img.src=url;
    });
  }
  function shrink(file){
    return draw(file).catch(function(err){
      if(!isHeic(file))throw err;
      return heicLoad().then(function(H){return H({blob:file,type:'image/jpeg',quality:.92});}).then(draw);
    });
  }

  stepEl.addEventListener('change',function(e){
    if(e.target.closest('[data-check]')){collect();var cq=e.target.closest('.q');cq.classList.remove('is-invalid');var ce=cq.querySelector('.q__error');if(ce)ce.remove();return;}
    var inp=e.target.closest('[data-photos]');if(!inp)return;
    var f=fields().filter(function(x){return x.type==='photos';})[0],slot=inp.dataset.photos,file=inp.files[0];
    if(!file)return;
    var box=inp.closest('.photos');box.classList.add('is-busy');
    inp.parentNode.outerHTML='<div class="photo photo--busy'+(slot==='main'&&slots(f)?' photo--main':'')+'">загружаю…</div>';
    var failed=false;
    shrink(file).then(function(b){var p={blob:b,url:URL.createObjectURL(b)};if(slot==='main')main=p;else extras[+slot]=p;},function(){failed=true;})
      .then(function(){
        var q=box.closest('.q');box.classList.remove('is-busy');box.innerHTML=renderPhotos(f);
        q.classList.remove('is-invalid');var err=q.querySelector('.q__error');if(err)err.remove();
        if(failed){q.classList.add('is-invalid');var p=document.createElement('p');p.className='q__error';p.textContent='фото не открылось, попробуй другое или сделай скриншот';q.appendChild(p);}
      });
  });

  stepEl.addEventListener('click',function(e){
    var del=e.target.closest('[data-del]');
    var up=e.target.closest('[data-main]');
    if(del||up){
      var box=(del||up).closest('.photos'),f=fields().filter(function(x){return x.type==='photos';})[0];
      if(del){var k=del.dataset.del;if(k==='main'){URL.revokeObjectURL(main.url);main=null;}else{URL.revokeObjectURL(extras[+k].url);extras[+k]=null;}}
      // выбранное меняется местами с главным, а если главного нет, становится главным и ячейка освобождается
      else{var j=+up.dataset.main,old=main;main=extras[j];extras[j]=old;}
      box.innerHTML=renderPhotos(f);
      var q=box.closest('.q');if(main){q.classList.remove('is-invalid');var er=q.querySelector('.q__error');if(er)er.remove();}
      return;}
    var chip=e.target.closest('.chip');
    if(!chip)return;
    var q=chip.closest('.q'),key=q.dataset.key,multi=chip.parentNode.dataset.multi==='true',opt=chip.dataset.opt;
    var cur=state.data[key];
    if(multi){cur=Array.isArray(cur)?cur.slice():[];var i2=cur.indexOf(opt);if(i2>-1)cur.splice(i2,1);else cur.push(opt);}
    else{cur=cur===opt?'':opt;}
    state.data[key]=cur;
    q.querySelectorAll('.chip').forEach(function(c){var on=multi?cur.indexOf(c.dataset.opt)>-1:cur===c.dataset.opt;c.setAttribute('aria-pressed',on);});
    q.classList.remove('is-invalid');var err=q.querySelector('.q__error');if(err)err.remove();
    save();
  });
  stepEl.addEventListener('input',function(e){
    if(e.target.closest('[data-photos]'))return;
    // дата рождения: точки ставятся сами, можно набирать одни цифры
    var f=fields().filter(function(x){return 'f-'+x.key===e.target.id;})[0];
    if(f&&f.check==='date'&&e.inputType!=='deleteContentBackward'){
      var dg=e.target.value.replace(/\D/g,'').slice(0,8);
      e.target.value=dg.replace(/^(\d{2})(\d)/,'$1.$2').replace(/^(\d{2}\.\d{2})(\d)/,'$1.$2');
    }
    collect();
  });

  function showIntro(on){
    for(var i=0;i<intro.length;i++)intro[i].hidden=!on;
    form.hidden=on;
  }
  if(start)start.addEventListener('click',function(){state.started=true;save();showIntro(false);window.scrollTo({top:0,behavior:'smooth'});});

  back.addEventListener('click',function(){
    collect();
    if(state.step===1&&start){state.started=false;save();showIntro(true);window.scrollTo({top:0,behavior:'smooth'});return;}
    state.step=Math.max(1,state.step-1);save();render();window.scrollTo({top:0,behavior:'smooth'});
  });

  form.addEventListener('submit',function(e){
    e.preventDefault();
    collect();
    if(!validate())return;
    if(state.step<STEPS.length){state.step++;save();render();window.scrollTo({top:0,behavior:'smooth'});return;}
    send();
  });

  function send(){
    var payload={form:C.form,page:location.host+location.pathname,website2:form.querySelector('[name="website2"]').value};
    if(C.update)payload.update=C.update===true?1:C.update;
    STEPS.forEach(function(s){s.fields.forEach(function(f){
      var v=state.data[f.key];if(f.type==='photos'||v===undefined||v==='')return;
      if(Array.isArray(v))v=v.join(', ');
      if(f.check==='telegram'||f.check==='instagram')v='@'+clean(v);
      if(f.check==='hashtags')v=hashtags(v).join(' ');
      payload[f.key]=v;
    });});
    var fd=new FormData();
    fd.append('payload',JSON.stringify(payload));
    allPhotos().forEach(function(p,i){fd.append('photo[]',p.blob,'photo'+(i+1)+'.jpg');});
    next.disabled=true;next.innerHTML='отправляем…';
    cxSend(ENDPOINT,fd)
      .then(function(){
        try{localStorage.removeItem(DRAFT);}catch(e){}
        form.hidden=true;document.getElementById('done').hidden=false;window.scrollTo({top:0,behavior:'smooth'});
      })
      .catch(function(err){
        next.disabled=false;next.innerHTML=(C.sendLabel||'отправить анкету')+' <span class="star"></span>';
        alertEl.hidden=false;
        alertEl.textContent=(err.message==='photo'?'не получилось загрузить фото, попробуй другое. ':'не получилось отправить. проверь интернет, если включен vpn, выключи его и попробуй еще раз. ')+'если не выходит, напиши нам в telegram @tenzzzo, ответы в форме сохранились. код ошибки: '+err.message;
      });
  }

  // личная ссылка обновления (join/?update=<ключ>): прошлые ответы и фото подставляются, человек правит только то, что поменялось.
  // если на этом телефоне уже есть черновик по этой ссылке, тексты берутся из него, фото все равно из прошлой анкеты
  function prefill(){
    var url=ENDPOINT.replace(/submit\.php$/,'prefill.php?t='+encodeURIComponent(C.prefill)),hadDraft=Object.keys(state.data).length>0,error='';
    stepEl.innerHTML='<p class="step__sub">загружаю твою анкету…</p>';
    next.disabled=true;
    fetch(url,{cache:'no-store'})
      .then(function(r){return r.json();})
      .then(function(j){
        if(!j.ok)throw new Error(j.error||'server');
        if(!hadDraft)STEPS.forEach(function(s){s.fields.forEach(function(f){
          var v=j.data[f.key];
          if(v===undefined||v===''||f.type==='photos'||f.type==='consent'||f.type==='check')return;
          if(f.type==='chips'){
            var list=String(v).split(/\s*,\s*/).filter(function(o){return f.options.indexOf(o)>-1;});
            if(!list.length)return;
            v=f.multi?list:list[0];
          }
          state.data[f.key]=v;
        });});
        save();
        var n=Math.min(j.photos||0,4),all=[];
        for(var i=0;i<n;i++)all.push(fetch(url+'&p='+i,{cache:'no-store'}).then(function(r){return r.ok?r.blob():null;}).catch(function(){return null;}));
        return Promise.all(all);
      })
      .then(function(blobs){
        // первое фото прошлой анкеты снова главное
        var lim=4;STEPS.forEach(function(s){s.fields.forEach(function(f){if(f.type==='photos')lim=f.max||4;});});
        blobs.forEach(function(b){if(!b||!b.size||allPhotos().length>=lim)return;var p={blob:b,url:URL.createObjectURL(b)};if(!main)main=p;else extras[allPhotos().length-1]=p;});
      })
      .catch(function(err){error=err.message;})
      .then(function(){
        next.disabled=false;render();
        if(!error)return;
        alertEl.hidden=false;
        alertEl.textContent=error==='used'?'по этой ссылке анкету уже обновили. если хочешь поправить что-то еще, напиши нам в telegram @tenzzzo, пришлем новую ссылку. или заполни анкету заново здесь.'
          :error==='expired'?'ссылка устарела. заполни анкету заново здесь или напиши нам в telegram @tenzzzo, пришлем новую.'
          :'не получилось загрузить прошлые ответы. заполни анкету здесь или напиши нам в telegram @tenzzzo.';
      });
  }

  if(C.prefill)prefill();else render();
  if(start)showIntro(!state.started);
})();
