/**
 * S1 (retomar na pausa). A P1 (início) saiu em 19/09/2026: ela cobria o play
 * nativo e, sem `panda_play` confirmado, o receptor deixava de emitir o play.
 * Estes testes fixam o que a S1 pode e o que ela nunca deve fazer — sobretudo
 * aparecer antes de o vídeo ter começado, que era o defeito da P1.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const source=readFileSync(new URL('../assets/vsl-overlay.js',import.meta.url),'utf8');
const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const origin='https://player-vz-7867cfdb-be1.tv.pandavideo.com.br';
const video='247518ef-145a-4ee7-90ab-846fcd7a65f8';
function fixture({remover=null,semBotao=false}={}){
 const listeners={},commands=[],timers=new Map();let timerId=0,now=0;
 const document={visibilityState:'visible',activeElement:null,fullscreenElement:null,addEventListener:(type,fn)=>{listeners['document:'+type]=fn;}};
 function node(id){return{id,hidden:true,dataset:{},attributes:{},handlers:{},disabled:false,
  getAttribute(key){return this.attributes[key]??(key==='src'?(this.src??null):null);},
  setAttribute(key,value){this.attributes[key]=value;},removeAttribute(key){delete this.attributes[key];},
  addEventListener(type,fn){this.handlers[type]=fn;},focus(){document.activeElement=this;},
  contains(el){return el===this||el===this.button;},querySelector(){return this.button;}};}
 const frame=node('heroVslFrame'),pause=node('vslPauseOverlay'),status=node('vslOverlayStatus'),slot=node('heroVsl');
 slot.dataset.vslDuration='250';frame.attributes.src=origin+'/embed/?v='+video;
 frame.contentWindow={postMessage:(message,target)=>commands.push({message:JSON.parse(JSON.stringify(message)),target})};
 pause.button=semBotao?null:node('pauseButton');
 const nodes=[frame,pause,status,slot].filter(n=>n.id!==remover);
 document.getElementById=id=>nodes.find(n=>n.id===id)??null;
 const window={location:{href:'https://dicionario.fluenciacontabil.com.br/'},dataLayer:[],
  addEventListener:(type,fn)=>{listeners[type]=fn;},matchMedia:()=>({matches:false,addEventListener(){}})};
 const context=vm.createContext({window,document,navigator:{},URL,Number,Boolean,
  setTimeout(fn,delay){const id=++timerId;timers.set(id,{fn,at:now+delay});return id;},clearTimeout(id){timers.delete(id);}});
 vm.runInContext(source,context);
 const tick=ms=>{now+=ms;for(const [id,t]of [...timers])if(t.at<=now){timers.delete(id);t.fn();}};
 const event=(message,data={},override={})=>listeners.message({source:frame.contentWindow,origin,data:{message,video,...data},...override});
 const click=which=>{if(!which.button.disabled)which.button.handlers.click();};
 const begin=()=>{event('panda_ready');event('panda_play',{currentTime:0});};
 return{window,document,frame,pause,status,commands,event,click,begin,tick,listeners};
}

test('página incompleta não derruba os scripts seguintes: falha em silêncio',()=>{
 // Uma exceção aqui interromperia o receptor que mede a VSL. Cada cenário
 // remove uma peça e exige que o overlay apenas desista.
 const cenarios={'sem slot heroVsl':'heroVsl','sem overlay de pausa':'vslPauseOverlay','sem status':'vslOverlayStatus'};
 for(const [nome,id] of Object.entries(cenarios)){
  assert.doesNotThrow(()=>fixture({remover:id}),undefined,nome);
 }
 assert.doesNotThrow(()=>fixture({semBotao:true}),undefined,'sem botão dentro da S1');
});
test('a página não traz mais o overlay de início, e mantém o de pausa',()=>{
 assert.ok(!html.includes('vslStartOverlay'),'a P1 continua no HTML');
 assert.ok(!html.includes('vslTeaser'),'a prévia silenciosa continua no HTML');
 assert.ok(html.includes('vslPauseOverlay'),'a S1 sumiu do HTML');
});
test('nada cobre o player antes de o vídeo começar',()=>{
 const f=fixture();assert.equal(f.pause.hidden,true);
 assert.deepEqual(f.commands,[]);assert.deepEqual(f.window.dataLayer,[]);
 // Pausa sem play anterior não é retomada: veio do player parado, não do espectador.
 f.event('panda_pause',{currentTime:0});f.tick(100);assert.equal(f.pause.hidden,true);
 assert.equal(f.frame.getAttribute('tabindex'),null);
});
test('S1 retoma sem seek, sem reiniciar e sem alterar o volume escolhido no player',()=>{
 const f=fixture();f.begin();f.event('panda_pause',{currentTime:73.5});f.tick(80);
 assert.equal(f.pause.hidden,false);const prior=f.commands.length;f.click(f.pause);
 assert.deepEqual(f.commands.slice(prior).map(c=>c.message),[{type:'play'}]);
 assert.ok(f.commands.every(c=>c.target===origin));
 f.event('panda_play',{currentTime:73.5});assert.equal(f.pause.hidden,true);
 assert.deepEqual(f.window.dataLayer,[]);
});
test('o overlay não emite marcos: quem mede é o receptor do site',()=>{
 const f=fixture();f.begin();f.event('panda_pause',{currentTime:40});f.tick(80);f.click(f.pause);
 f.event('panda_play',{currentTime:40});f.event('panda_ended',{currentTime:250});
 assert.deepEqual(f.window.dataLayer,[]);
});
test('mensagens de outra origem, outro iframe ou outro vídeo não comandam a interface',()=>{
 const f=fixture();f.begin();f.event('panda_pause',{currentTime:30});f.tick(80);
 const prior=f.commands.length;f.click(f.pause);
 f.event('panda_play',{currentTime:30},{origin:'https://example.org'});
 f.event('panda_play',{currentTime:30},{source:{}});
 f.event('panda_play',{currentTime:30,video:'outro-video'});
 assert.equal(f.pause.hidden,false);
 f.event('panda_play',{currentTime:30});assert.equal(f.pause.hidden,true);
 assert.deepEqual(f.commands.slice(prior).map(c=>c.message),[{type:'play'}]);
});
test('o fim da VSL não fica encoberto por um overlay de pausa',()=>{
 const f=fixture();f.begin();f.event('panda_pause',{currentTime:250});f.event('panda_ended',{currentTime:250});f.tick(100);
 assert.equal(f.pause.hidden,true);
});
test('se não houver resposta à retomada, o controle nativo fica disponível',()=>{
 const f=fixture();f.begin();f.event('panda_pause',{currentTime:60});f.tick(80);
 f.click(f.pause);f.tick(8000);
 assert.equal(f.pause.hidden,true);assert.equal(f.status.hidden,false);
 assert.match(f.status.textContent,/botão de play/);
 assert.equal(f.frame.getAttribute('tabindex'),null);
 assert.equal(f.pause.button.disabled,false);
});
test('erro do player libera a interface nativa, inclusive quando estava pausado',()=>{
 const f=fixture();f.begin();f.event('panda_pause',{currentTime:32});f.tick(80);f.event('panda_error');
 assert.equal(f.pause.hidden,true);assert.equal(f.status.hidden,false);
});
test('sem sinal de prontidão o clique não comanda o player, e o fallback cobre',()=>{
 // begin() omite panda_ready de propósito: o overlay só manda `play` depois que
 // o player se diz pronto. Sem isso, quem resolve é o controle nativo.
 const f=fixture();f.event('panda_play',{currentTime:0});f.event('panda_pause',{currentTime:10});f.tick(80);
 assert.equal(f.pause.hidden,false);
 const prior=f.commands.length;f.click(f.pause);
 assert.deepEqual(f.commands.slice(prior),[]);
 f.tick(8000);
 assert.equal(f.pause.hidden,true);assert.equal(f.status.hidden,false);
});
test('com o player pronto, o clique repetido retoma uma única vez',()=>{
 const f=fixture();f.begin();f.event('panda_pause',{currentTime:10});f.tick(80);
 assert.equal(f.pause.hidden,false);
 const prior=f.commands.length;f.click(f.pause);f.click(f.pause);
 assert.deepEqual(f.commands.slice(prior).map(c=>c.message),[{type:'play'}]);
});
