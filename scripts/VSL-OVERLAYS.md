# Overlays da VSL

Combinação escolhida em 18/09/2026: **P1** no início e **S1** na pausa, com CTA `#D62828` e texto branco. Os elementos da página ficam em `assets/vsl-overlay.css` e `assets/vsl-overlay.js`.

- A P1 usa uma prévia local de seis segundos, sem áudio e sem ligação com o rastreamento. Somente o clique em **Ativar som e assistir** envia ao Panda os comandos `currentTime: 0`, `volume: 1` e `play`.
- A S1 aparece depois de `panda_pause`. **Continuar vídeo** envia somente `play`, preservando posição e volume. A imagem `vsl-pausa-s1.png` configura a thumbnail nativa de pausa para cobrir também o modo tela cheia do iframe.
- As mensagens de retorno precisam vir do iframe da VSL e da origem exata do Panda. O primeiro play e a retomada só escondem o overlay quando o player confirma `panda_play`.
- Falha ou ausência de resposta ao clique por oito segundos libera o controle nativo. Sem o JavaScript de overlay, os elementos de P1/S1 continuam ocultos e o iframe mantém seus controles.
- A prévia respeita movimento reduzido, economia de dados, visibilidade da aba e saída da área visível.

O vídeo Panda não inicia automaticamente e não restaura posição de outra visita: a P1 promete começar desde o início. Isso não afeta a retomada S1 durante a reprodução atual. Os comandos e parâmetros seguem a [documentação do Panda](https://docs.pandavideo.com/reference/send-events) e seus [query params](https://docs.pandavideo.com/reference/query-params).

Os overlays não enviam eventos ao `dataLayer`, não têm o atributo de CTA de compra e não mudam o receptor existente `vsl.js`. Os marcos continuam dependendo dos eventos reais do iframe. `embed.js` permanece na página para preservar o contexto e as UTMs.

Validação automatizada:

```sh
node --test scripts/origem.test.mjs scripts/vsl-slot.test.mjs scripts/vsl-overlay.test.mjs
```

O ensaio visual foi feito no Panda real com os coletores de analytics bloqueados: início com som, pausa/retomada, CTA da thumbnail em tela cheia e viewport de celular. A prévia silenciosa não produziu marcos; a retomada não duplicou `vsl_start`.
