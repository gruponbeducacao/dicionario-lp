# Overlays da VSL

Estado desde **19/09/2026**: só a **S1** (retomar na pausa). A **P1** (início com som) foi removida — o vídeo volta a começar pelo botão nativo do player. Os elementos ficam em `assets/vsl-overlay.css` e `assets/vsl-overlay.js`.

## Por que a P1 saiu

Ela entrou no ar em 19/09 às 08h09 e cobria o player inteiro. O play dependia de o Panda confirmar `panda_play` depois do comando enviado por mensagem; quando a confirmação não vinha em oito segundos, o visitante ficava diante de um player parado com o aviso "Use o botão de play do vídeo para continuar".

O efeito colateral apareceu na medição: sem `panda_play`, o receptor `vsl.js` não emite `vsl_start`, e o GTM não converte em `VSLPlay`. O evento de play, que vinha de 7 a 10 por dia, **zerou no mesmo dia em que a P1 entrou**. Em teste no navegador, com clique real, o player respondeu apenas `panda_allData` e o fallback disparou duas vezes seguidas.

A S1 foi mantida por ser menos arriscada: só aparece depois que o vídeo já começou. **Ela usa o mesmo mecanismo de comando por mensagem**, com o mesmo fallback de oito segundos, então pode falhar na retomada — se isso acontecer, o caminho é removê-la também.

## Como a S1 funciona

- Aparece depois de `panda_pause`. **Continuar vídeo** envia somente `play`, preservando posição e volume.
- A imagem `vsl-pausa-s1.png` configura a thumbnail nativa de pausa, que cobre também o modo tela cheia do iframe.
- As mensagens de retorno precisam vir do iframe da VSL e da origem exata do Panda. O overlay só se esconde quando o player confirma `panda_play`.
- Falha ou ausência de resposta por oito segundos libera o controle nativo.
- Sem o JavaScript de overlay, o elemento da S1 continua oculto e o iframe mantém seus controles.

Os overlays não enviam eventos ao `dataLayer`, não têm o atributo de CTA de compra e não mudam o receptor `vsl.js`. Os marcos continuam dependendo dos eventos reais do iframe. `embed.js` permanece na página para preservar o contexto e as UTMs.

O CSS ainda traz as regras da P1 (`.fc-vsl-start-card`, `.fc-vsl-audio`, `.fc-vsl-stamp`). Elas ficaram sem uso e foram mantidas para não inflar o diff da remoção; a S1 reaproveita `.fc-vsl-overlay`, `.fc-vsl-scene`, `.fc-vsl-shade` e os estilos de botão.

Validação automatizada:

```sh
node --test scripts/origem.test.mjs scripts/vsl-slot.test.mjs scripts/vsl-overlay.test.mjs
```
