# 📱 GUIA RÁPIDO - Ativar Jornada pelo Celular

## ⚡ Em 5 Minutos!

---

## 🎯 PASSO 1: Pegar Credenciais Marketing Cloud

### No celular/tablet:

1. **Abra o Marketing Cloud** (app ou navegador)
   ```
   https://mc.exacttarget.com
   ```

2. **Vá em Setup**
   - Clique no ícone de engrenagem ⚙️
   - Selecione "Platform Tools"
   - Clique em "Apps" → "Installed Packages"

3. **Crie ou abra um pacote**
   - Se não tem: Clique "New"
   - Nome: "N8N Integration"
   - Salve

4. **Adicione API Integration**
   - Clique "Add Component"
   - Selecione "API Integration"
   - Tipo: "Server-to-Server"
   - Permissões:
     - ✅ Journeys (Read, Write)
     - ✅ Automation (Execute)
   - Salve

5. **Copie 4 informações** (ANOTE EM ALGUM LUGAR):

```
📋 COPIE ISSO:

Client ID:
[cole aqui] ___________________________________

Client Secret:
[cole aqui] ___________________________________

Authentication Base URI:
https://mcXXXXXXXXX.auth.marketingcloudapis.com
       👆 Copie só isso: mcXXXXXXXXX

Account ID (MID):
[cole aqui] ___________________________________
```

---

## 🎯 PASSO 2: Pegar ID da Jornada

1. **Abra Journey Builder**
   - No Marketing Cloud
   - Menu "Journey Builder"

2. **Abra a jornada que quer ativar**

3. **Copie o ID da URL**:
   ```
   https://.../journey/12345678-1234-1234-1234-123456789abc
                       ⬆️⬆️⬆️ COPIE ISSO ⬆️⬆️⬆️
   ```

```
📋 COPIE ISSO:

Journey ID:
[cole aqui] ___________________________________
```

---

## 🎯 PASSO 3: Configurar N8N

### 3.1 Criar conta N8N (se não tem)

1. **Acesse**: https://n8n.io
2. Clique **"Sign Up"**
3. Use email Google/GitHub (mais rápido)
4. Confirme email

### 3.2 Importar Workflow

1. **Dentro do N8N:**
   - Clique **"Workflows"** (menu lateral esquerdo)
   - Clique **"+"** (novo workflow)

2. **Menu de opções:**
   - Clique nos **3 pontinhos ⋯** (canto superior direito)
   - Selecione **"Import from File"**

3. **Baixe o arquivo:**
   - Baixe o arquivo `marketing-cloud-ativar-jornada.json` deste repositório
   - No celular: pode fazer download direto ou copiar o JSON

4. **Importe:**
   - Selecione o arquivo baixado
   - Clique **"Import"**

### 3.3 Configurar Credenciais

1. **Clique no node "Configurações"**
   (é um quadradinho com ícone de ferramenta)

2. **Cole suas informações:**

```javascript
client_id: [COLE SEU CLIENT ID]
client_secret: [COLE SEU CLIENT SECRET]
subdomain: [COLE SEU SUBDOMAIN (só mcXXXXXXXXX)]
account_id: [COLE SEU ACCOUNT ID]
journey_id: [COLE O ID DA JORNADA]
```

3. **Salve** (ícone de disquete 💾)

---

## 🎯 PASSO 4: ATIVAR A JORNADA! 🚀

1. **Clique em "Execute Workflow"** (botão no canto superior direito)

2. **Aguarde** (alguns segundos)

3. **Resultado:**
   - ✅ **Verde** = Jornada ativada com sucesso!
   - ❌ **Vermelho** = Erro (veja o log)

---

## 📊 Exemplo Visual do Workflow

```
┌─────────────────┐
│  Quando clicar  │
│      aqui       │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Configurações   │
│ (suas credenc.) │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ 1. Autenticar   │
│  Marketing Cloud│
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ 2. Ativar       │
│    Jornada      │
└────────┬────────┘
         │
         ▼
    ✅ ATIVADA!
```

---

## ⚠️ Erros Comuns

### ❌ "Unauthorized"
**Solução:**
- Confira se Client ID e Secret estão corretos
- Veja se não tem espaço extra no início/fim

### ❌ "Journey not found"
**Solução:**
- Confirme o Journey ID (UUID)
- Veja se copiou completo (tem 36 caracteres com hífens)

### ❌ "Insufficient privileges"
**Solução:**
- No Installed Package, adicione as permissões:
  - Journeys → Read, Write
  - Automation → Execute

### ❌ "Invalid status transition"
**Solução:**
- A jornada já pode estar ativa
- Verifique no Journey Builder

---

## 💡 Dicas

### 🔄 Para automatizar:
- Substitua o **"Quando clicar aqui"** por:
  - **Schedule** = Todo dia às 9h
  - **Webhook** = Quando chamar uma URL
  - **Email** = Quando receber email

### 📱 Usar no celular:
- N8N Cloud funciona direto no navegador mobile
- Abra em tela cheia para melhor visualização
- Gire o celular (modo paisagem) se necessário

### 🔒 Segurança:
- **NUNCA** compartilhe o Client Secret
- No N8N Cloud, tudo fica criptografado
- Pode usar com tranquilidade

---

## 🆘 Precisa de Ajuda?

### Se der erro:
1. Clique no node que deu erro (vai estar vermelho ❌)
2. Olhe o painel direito → aba "OUTPUT"
3. Leia a mensagem de erro
4. Compare com os erros acima

### Quer adicionar mais funcionalidades?
- Desativar jornada: mude `"Running"` para `"Stopped"`
- Pausar jornada: mude para `"Paused"`
- Ver status: use método GET em vez de PUT

---

## ✅ Checklist Final

- [ ] Copiei Client ID
- [ ] Copiei Client Secret
- [ ] Copiei Subdomain (mcXXXXXXXXX)
- [ ] Copiei Account ID
- [ ] Copiei Journey ID
- [ ] Criei conta no N8N
- [ ] Importei o workflow
- [ ] Configurei no node "Configurações"
- [ ] Testei executando

**🎉 Pronto! Sua jornada está ativa!**

---

## 📞 Contato

Se precisar de ajuda, abra uma issue no GitHub ou me chame!

**Tempo total:** ~5 minutos ⚡
**Custo:** $0 (N8N tem plano grátis) 💰
**Dificuldade:** ⭐⭐ (Fácil!)
