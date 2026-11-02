# Advocacia Smart · Netflix Jurídica

Plataforma de temporadas e episódios de prática jurídica para o jovem advogado, criada por Julio Vicente (@advocaciasmart_).

## Endereços

| Página | Endereço padrão (GitHub Pages) |
| --- | --- |
| Plataforma (catálogo, login, área do aluno) | https://advjuliovicente.github.io/JOVEM-ADV/ |
| Página de vendas para anúncios (VSL + checkout) | https://advjuliovicente.github.io/JOVEM-ADV/assinar/ |

Cada `git push` na branch `main` publica o site automaticamente (workflow em `.github/workflows/pages.yml`).

## Estrutura

```
index.html          Plataforma completa (página pública, login e área do aluno)
assinar/index.html  Página de vendas de R$ 24,90/mês
404.html            Página de erro no visual da marca
.github/workflows/  Publicação automática no GitHub Pages
```

## Configurar a página de vendas

Abra `assinar/index.html`, procure o bloco `CONFIGURAÇÃO` no início do `<script>` e preencha:

```js
const CHECKOUT_URL = "https://pay.kiwify.com.br/SEU-CODIGO"; // link do checkout (Kiwify, Hotmart...)
const VSL_URL = "https://player.vimeo.com/video/123456";     // link de incorporação do vídeo ou .mp4
```

Os parâmetros do anúncio (`utm_source`, `fbclid` etc.) são repassados para o checkout automaticamente.

## Usar um domínio próprio depois

1. Compre o domínio (ex.: `advocaciasmart.com.br` no Registro.br).
2. No provedor de DNS, crie um registro `CNAME` de `www` apontando para `advjuliovicente.github.io`.
3. No GitHub: **Settings → Pages → Custom domain**, digite `www.seudominio.com.br` e marque **Enforce HTTPS**.

## Limite atual do login

O login é de demonstração: as contas e o progresso ficam salvos só no navegador de cada aluno (`localStorage`). Qualquer pessoa consegue criar uma conta sem pagar. Para vender acesso de verdade, o próximo passo é ligar o login a um serviço de autenticação (Supabase ou Firebase, por exemplo) ou usar a área de membros da plataforma de checkout.

---

Conteúdo educativo. Confira sempre a redação atualizada das normas e as regras da sua seccional.
