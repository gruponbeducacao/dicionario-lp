# Origem da visita e intenção de compra

`assets/origem.js` captura a campanha na entrada, mantém a origem na sessão e
prepara os links para o checkout. Todas as páginas públicas com GTM devem carregar
uma única cópia, com caminho relativo e a versão atual (`?v=20260909`). Isso inclui
páginas sem botão de compra: uma visita ao blog pode continuar até uma oferta.

## Contrato

- A URL com parâmetros de origem substitui a origem anterior, sem misturar campanhas.
  Sem parâmetros, reutiliza `fc_origem` no `sessionStorage` do mesmo domínio.
- Links HTTPS entre o site principal, sua versão `www` e o Dicionário recebem os
  parâmetros de origem. Cookies não são copiados para esses links.
- Somente `https://pay.kiwify.com.br` recebe `s1` (`_fbp` existente), `s2` (`_fbc`
  válido ou valor construído a partir de `fbclid`) e `s3` (host e caminho da página).
  Produto, oferta e posição do botão em `utm_content` são preservados; o criativo
  recebido entra em `utm_term` quando esse campo está livre.
- O instante usado para construir `fbc` permanece estável entre botões e páginas
  da sessão. Um cookie de outro clique não substitui o `fbclid` recém-recebido.
- O clique em checkout envia apenas `checkout_click`, com `cta_location` e
  `pagina`, para o `dataLayer` existente. O GTM faz o mapeamento para
  `ClicouComprar`. O script não emite `InitiateCheckout` ou `Purchase`.
- A inicialização é única mesmo com inclusão duplicada do arquivo. Links criados
  depois do carregamento são tratados pelo listener delegado. Falhas de storage
  ou cookies não bloqueiam a navegação.

Não são criados cookies, tags ou chamadas externas. Se o navegador bloquear o
storage, a origem da URL funciona na página atual, mas sua continuidade entre
páginas depende desse armazenamento. Entre domínios, os parâmetros são levados
pela URL; não há compartilhamento de `sessionStorage`.

## Verificação e manutenção

```sh
node --test scripts/origem.test.mjs
```

Os testes usam dados sintéticos e APIs nativas do Node. Verificam navegação,
estabilidade do identificador, cookies tardios, storage indisponível, inclusão
duplicada, links dinâmicos, destinos permitidos e cobertura dos HTMLs rastreados
pelo Git. O workflow `origem.yml` executa essa verificação em PRs e merges.

Ao alterar o asset, atualizar a versão nos HTMLs e no teste de cobertura. No site
principal, regenerar `assinaturas.html` por `scripts/gen_variante_b.py`. Manter as
cópias de `origem.js`, deste documento, dos testes e do workflow alinhadas entre
os repositórios do site e do Dicionário.

O ensaio local comprova a preparação dos links e os eventos do script. A recepção
na Meta, a configuração de cada produto na Kiwify e a deduplicação entre navegador
e servidor precisam de homologação separada; não são comprovadas por estes testes.

Referências: [dataLayer do Google](https://developers.google.com/tag-platform/tag-manager/datalayer),
[tratamento oficial de click ID da Meta](https://github.com/facebook/capi-param-builder/blob/main/client_js/shared/utils/cookieUtil.js)
e [eventos do pixel na Kiwify](https://ajuda.kiwify.com.br/pt-br/article/como-configurar-o-pixel-do-facebook-1rb2xtr/).
