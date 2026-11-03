# Advocacia Smart · Netflix Jurídica

Plataforma de temporadas e episódios de prática jurídica para o jovem advogado, criada por Julio Vicente (@advocaciasmart_). O acesso é exclusivo para quem assina pela Hotmart.

## Endereços

| Página | Endereço padrão (GitHub Pages) |
| --- | --- |
| Plataforma (login e área do aluno) | https://advjuliovicente.github.io/JOVEM-ADV/ |
| Página de vendas para anúncios (VSL + checkout) | https://advjuliovicente.github.io/JOVEM-ADV/assinar/ |
| Webhook da Hotmart | https://tgosadjncwlbdcbiixsj.supabase.co/functions/v1/hotmart-webhook |

Cada `git push` na branch `main` publica o site automaticamente (`.github/workflows/pages.yml`).

## Como o acesso funciona

1. A pessoa compra na Hotmart.
2. A Hotmart chama o webhook. A função `hotmart-webhook` grava o e-mail na tabela `assinaturas` com status `ativa` e envia um convite por e-mail.
3. A pessoa clica no link do e-mail, cria a senha e entra.
4. Depois, ela entra com e-mail e senha. Se esquecer a senha, usa "Primeiro acesso ou esqueci a senha".
5. Cancelamento: o acesso continua até o fim do período pago. Reembolso, chargeback, pagamento atrasado ou expirado: o acesso é bloqueado na hora. Um novo pagamento aprovado libera de novo.

O conteúdo das temporadas fica criptografado em `conteudo.enc`. A chave está no Supabase e só é entregue a quem tem assinatura válida, então não adianta abrir o código-fonte da página.

### Status da tabela `assinaturas`

| Status | Tem acesso? | Vem do evento da Hotmart |
| --- | --- | --- |
| `ativa` | Sim | PURCHASE_APPROVED, PURCHASE_COMPLETE |
| `cortesia` | Sim | Manual (liberação gratuita; o webhook nunca altera) |
| `cancelada` | Até a data em `acesso_ate` | SUBSCRIPTION_CANCELLATION, PURCHASE_CANCELED |
| `atrasada` | Não | PURCHASE_DELAYED |
| `reembolsada` | Não | PURCHASE_REFUNDED |
| `chargeback` | Não | PURCHASE_CHARGEBACK, PURCHASE_PROTEST |
| `expirada` | Não | PURCHASE_EXPIRED |

**Liberar acesso manual** (você mesmo, parceiros, testes): no Supabase, abra **Table Editor → assinaturas → Insert row**, preencha `email` (minúsculo) e `status` = `cortesia`. Depois, em **Authentication → Users → Invite user**, convide o mesmo e-mail.

## Configuração (uma vez)

### Supabase › Authentication
- **Sign In / Providers → Email:** desligue **Allow new users to sign up**. Só quem a Hotmart cadastra entra.
- **URL Configuration → Site URL:** `https://advjuliovicente.github.io/JOVEM-ADV/`
- **URL Configuration → Redirect URLs:** adicione `https://advjuliovicente.github.io/JOVEM-ADV/**`
- **Emails → SMTP Settings:** configure um SMTP próprio (Resend, Brevo, Amazon SES...). O envio padrão do Supabase só manda e-mail para membros da sua equipe e tem limite de poucos por hora: sem SMTP próprio, os compradores não recebem o convite.
- **Emails → Templates:** traduza "Invite user" e "Reset password" (sugestões abaixo).

### Supabase › Edge Functions › Secrets
- `HOTMART_HOTTOK` (obrigatório): o token da Hotmart em **Ferramentas → Webhook → Autenticação**.
- `HOTMART_PRODUCT_ID` (opcional): ID do produto; eventos de outros produtos são ignorados.
- `SITE_URL` (opcional): troque quando tiver domínio próprio.

### Hotmart › Ferramentas › Webhook
- URL: `https://tgosadjncwlbdcbiixsj.supabase.co/functions/v1/hotmart-webhook`
- Versão: **2.0.0**
- Eventos: compra aprovada, completa, cancelada, reembolsada, chargeback, protesto, atrasada, expirada e cancelamento de assinatura.

### Página de vendas
Em `assinar/index.html`, no bloco `CONFIGURAÇÃO`:

```js
const CHECKOUT_URL = "https://pay.hotmart.com/SEU-CODIGO";
const VSL_URL = "https://player.vimeo.com/video/123456";
```

## Modelos de e-mail sugeridos

**Invite user** · Assunto: `Seu acesso à Advocacia Smart chegou`

```html
<h2>Compra confirmada!</h2>
<p>Clique no botão abaixo para criar sua senha e começar a Temporada 1.</p>
<p><a href="{{ .ConfirmationURL }}">Criar minha senha</a></p>
<p>Depois, entre sempre com este e-mail ({{ .Email }}) e a senha que você criou.</p>
```

**Reset password** · Assunto: `Seu link de acesso à Advocacia Smart`

```html
<h2>Criar ou trocar sua senha</h2>
<p><a href="{{ .ConfirmationURL }}">Definir minha senha</a></p>
<p>Se você não pediu este e-mail, pode ignorá-lo.</p>
```

## Estrutura

```
index.html                      Plataforma: login, área do aluno e player
conteudo.enc                    Temporadas criptografadas (AES-GCM)
assinar/index.html              Página de vendas de R$ 24,90/mês
404.html                        Página de erro no visual da marca
supabase/functions/hotmart-webhook/   Função que recebe a Hotmart
supabase/migrations/            Tabelas e regras de acesso do banco
.github/workflows/pages.yml     Publicação automática
```

## Biblioteca de materiais

A aba **Materiais** da plataforma traz modelos e conteúdos prontos (contrato de honorários, procuração, petições, planilha, artes e roteiros). Os materiais ficam dentro do `conteudo.enc`, junto com as temporadas, e só aparecem para quem tem assinatura válida.

Cada material tem `status: "ok"` (pronto, com texto para copiar ou `link` para o arquivo) ou `"breve"` (mostra a prévia e o selo "em breve"). Para publicar um material novo ou terminar um que está "em breve", peça ao Claude para regenerar o `conteudo.enc` com a mudança.

## Editar o conteúdo das temporadas

O texto das temporadas não fica legível no repositório. Para alterar episódios ou questões, peça ao Claude para regenerar o `conteudo.enc`: ele descriptografa com a chave do Supabase, aplica a mudança e criptografa de novo.

## Domínio próprio depois

1. Compre o domínio (ex.: `advocaciasmart.com.br` no Registro.br).
2. No DNS, crie um `CNAME` de `www` apontando para `advjuliovicente.github.io`.
3. GitHub: **Settings → Pages → Custom domain** e marque **Enforce HTTPS**.
4. Atualize no Supabase a Site URL, as Redirect URLs e o segredo `SITE_URL`.

---

Conteúdo educativo. Confira sempre a redação atualizada das normas e as regras da sua seccional.
