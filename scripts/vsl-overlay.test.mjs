import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const source=readFileSync(new URL('../assets/vsl-overlay.js',import.meta.url),'utf8');
const origin='https://player-vz-7867cfdb-be1.tv.pandavideo.com.br';
const video='247518ef-145a-4ee7-90ab-846fcd7a65f8';
function fixture({reduced=false}={}){
 const listeners={},commands=[],timers=new Map();let timerId=0,now=0;
 const document={visibilityState:'visible',activeElement:null,fullscreenElement:null,addEventListener:(type,fn)=>{listeners['document:'+type]=fn;}};
 function node(id){return{id,hidden:true,dataset:{},attributes:{},handlers:{},disabled:false,
  getAttribute(key){return this.attributes[key]??(key==='src'?(this.src??null):null);},
  setAttribute(key,value){this.attributes[key]=value;},removeAttribute(key){delete this.attributes[key];},
  addEventListener(type,fn){this.handlers[type]=fn;},focus(){document.activeElement=this;},
  contains(el){return el===this||el===this.button;},querySelector(){return this.button;}};}
 const frame=node('heroVslFrame'),start=node('vslStartOverlay'),pause=node('vslPauseOverlay'),teaser=node('vslTeaser'),status=node('vslOverlayStatus'),slot=node('heroVsl');
 slot.dataset.vslDuration='250';frame.attributes.src=origin+'/embed/?v='+video;
 frame.contentWindow={postMessage:(message,target)=>commands.push({message:JSON.parse(JSON.stringify(message)),target})};
 start.button=node('startButton');pause.button=node('pauseButton');
 teaser.dataset.src='./assets/vsl-previa.mp4';teaser.pause=()=>{teaser.paused=true;};teaser.play=()=>{teaser.paused=false;return Promise.resolve();};
 const nodes=[frame,start,pause,teaser,status,slot];document.getElementById=id=>nodes.find(n=>n.id===id);
 const window={location:{href:'https://dicionario.fluenciacontabil.com.br/'},dataLayer:[],
  addEventListener:(type,fn)=>{listeners[type]=fn;},matchMedia:()=>({matches:reduced,addEventListener(){}})};
 const context=vm.createContext({window,document,navigator:{},URL,Number,Boolean,
  setTimeout(fn,delay){const id=++timerId;timers.set(id,{fn,at:now+delay});return id;},clearTimeout(id){timers.delete(id);}});
 vm.runInContext(source,context);
 const tick=ms=>{now+=ms;for(const [id,t]of [...timers])if(t.at<=now){timers.delete(id);t.fn();}};
 const event=(message,data={},override={})=>listeners.message({source:frame.contentWindow,origin,data:{message,video,...data},...override});
 const click=which=>{if(!which.button.disabled)which.button.handlers.click();};
 const begin=()=>{event('panda_ready');click(start);event('panda_play',{currentTime:0});};
 return{window,document,frame,start,pause,teaser,status,commands,event,click,begin,tick,listeners};
}

test('a prévia silenciosa não inicia o Panda nem emite marcos ou clique de compra',()=>{
 const f=fixture();assert.equal(f.start.hidden,false);assert.equal(f.teaser.paused,false);
 assert.deepEqual(f.commands,[]);assert.deepEqual(f.window.dataLayer,[]);
 f.event('panda_play',{isMutedIndicator:true,currentTime:1});assert.equal(f.start.hidden,false);
 f.event('panda_pause',{currentTime:0});f.tick(100);assert.equal(f.pause.hidden,true);
});
test('o clique antes de pronto espera o player e inicia uma única vez com som desde zero',()=>{
 const f=fixture();f.click(f.start);f.click(f.start);assert.deepEqual(f.commands,[]);
 f.event('panda_ready');f.event('panda_ready');
 assert.deepEqual(f.commands.map(c=>c.message),[{type:'currentTime',parameter:0},{type:'volume',parameter:1},{type:'play'}]);
 assert.ok(f.commands.every(c=>c.target===origin));assert.equal(f.start.hidden,false);
 f.event('panda_play',{currentTime:0});assert.equal(f.start.hidden,true);assert.equal(f.teaser.paused,true);
 assert.deepEqual(f.window.dataLayer,[]);
});
test('S1 retoma sem seek, sem reiniciar e sem alterar o volume escolhido no player',()=>{
 const f=fixture();f.begin();f.event('panda_pause',{currentTime:73.5});f.tick(80);
 assert.equal(f.pause.hidden,false);const prior=f.commands.length;f.click(f.pause);
 assert.deepEqual(f.commands.slice(prior).map(c=>c.message),[{type:'play'}]);
 f.event('panda_play',{currentTime:73.5});assert.equal(f.pause.hidden,true);
});
test('mensagens de outra origem, outro iframe ou outro vídeo não comandam a interface',()=>{
 const f=fixture();f.click(f.start);
 f.event('panda_ready',{}, {origin:'https://example.org'});
 f.event('panda_ready',{}, {source:{}});f.event('panda_ready',{video:'outro-video'});
 assert.deepEqual(f.commands,[]);assert.equal(f.start.hidden,false);
 f.event('panda_allData',{playerData:{duration:250}});assert.equal(f.commands.length,3);
});
test('o fim da VSL não fica encoberto por um overlay de pausa',()=>{
 const f=fixture();f.begin();f.event('panda_pause',{currentTime:250});f.event('panda_ended',{currentTime:250});f.tick(100);
 assert.equal(f.pause.hidden,true);assert.equal(f.start.hidden,true);
});
test('se não houver resposta ao play, o controle nativo fica disponível',()=>{
 const f=fixture();f.click(f.start);f.tick(8000);
 assert.equal(f.start.hidden,true);assert.equal(f.pause.hidden,true);assert.equal(f.status.hidden,false);
 assert.match(f.status.textContent,/botão de play/);assert.equal(f.frame.getAttribute('tabindex'),null);
 assert.equal(f.start.button.disabled,false);
});
test('erro do player libera a interface nativa, inclusive quando estava pausado',()=>{
 const f=fixture();f.begin();f.event('panda_pause',{currentTime:32});f.tick(80);f.event('panda_error');
 assert.equal(f.pause.hidden,true);assert.equal(f.status.hidden,false);
});
test('movimento reduzido e aba oculta não reproduzem a prévia silenciosa',()=>{
 const reduced=fixture({reduced:true});assert.equal(reduced.teaser.paused,true);assert.equal(reduced.teaser.getAttribute('src'),null);
 const f=fixture();f.document.visibilityState='hidden';f.listeners['document:visibilitychange']();assert.equal(f.teaser.paused,true);
 assert.deepEqual(f.commands,[]);
});
