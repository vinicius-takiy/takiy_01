# 🚀 Marketing Cloud - Integração N8N

Workflows prontos para ativar jornadas do Salesforce Marketing Cloud via N8N, **direto do celular**, sem código.

---

## 📦 O que tem aqui?

Este repositório contém **2 workflows N8N** para ativar jornadas do Marketing Cloud:

### 1️⃣ Versão Simples ⭐ **RECOMENDADO PARA INICIANTES**
**Arquivo:** `n8n-workflows/marketing-cloud-ativar-jornada-simples.json`

✅ Interface intuitiva com emojis
✅ Feedback visual de sucesso/erro
✅ Perfeita para usar no celular
✅ Instruções direto nos nodes

**Escolha se:** Você quer algo rápido e fácil de usar

---

### 2️⃣ Versão Completa 🔧 **PARA QUEM JÁ CONHECE N8N**
**Arquivo:** `n8n-workflows/marketing-cloud-ativar-jornada.json`

✅ Estrutura profissional
✅ Fácil de expandir/customizar
✅ Ideal para integrar com outros workflows

**Escolha se:** Você já usa N8N e quer integrar com outros processos

---

## 🎯 Começar Agora (3 passos)

### Passo 1: Pegar Credenciais
Siga o **[GUIA-RAPIDO.md](n8n-workflows/GUIA-RAPIDO.md)** completo

**Resumo:**
1. Acesse Marketing Cloud → Setup → Installed Packages
2. Copie: Client ID, Secret, Subdomain, Account ID
3. No Journey Builder, copie o Journey ID

### Passo 2: Importar no N8N
1. Crie conta grátis em https://n8n.io
2. Importe um dos arquivos JSON acima
3. Cole suas credenciais no node "Configurações"

### Passo 3: Ativar!
Clique em "Execute Workflow" ✅

---

## 📚 Documentação

- **[GUIA-RAPIDO.md](n8n-workflows/GUIA-RAPIDO.md)** - Tutorial completo passo a passo (📱 otimizado para celular)
- **[README.md](n8n-workflows/README.md)** - Documentação técnica detalhada
- **[.env.example](n8n-workflows/.env.example)** - Template de credenciais

---

## 🎓 Estrutura do Projeto

```
takiy_01/
├── README.md                          ← Você está aqui
├── n8n-workflows/
│   ├── GUIA-RAPIDO.md                 ← 📱 Tutorial para celular
│   ├── README.md                      ← 📖 Docs completa
│   ├── .env.example                   ← 🔐 Template credenciais
│   ├── marketing-cloud-ativar-jornada-simples.json  ← ⭐ Versão simples
│   └── marketing-cloud-ativar-jornada.json          ← 🔧 Versão completa
```

---

## ⚡ FAQ Rápido

### ❓ Preciso instalar algo?
**Não!** Tudo funciona direto no navegador (N8N Cloud)

### ❓ Funciona no celular?
**Sim!** Os workflows foram otimizados para mobile

### ❓ É grátis?
**Sim!** N8N tem plano gratuito suficiente para isso

### ❓ É seguro?
**Sim!** N8N criptografa suas credenciais

### ❓ Quanto tempo leva?
**~5 minutos** para configurar tudo

### ❓ Posso automatizar?
**Sim!** Substitua o trigger manual por:
- Schedule (agendar)
- Webhook (API)
- Email
- Slack
- E muito mais!

---

## 🔄 Funcionalidades Extras

### Desativar jornada
No workflow, mude `"Running"` para `"Stopped"`

### Pausar jornada
Mude para `"Paused"`

### Ativar múltiplas jornadas
Adicione um loop no workflow

### Ver status da jornada
Mude o método de PUT para GET

---

## 🆘 Problemas?

Consulte a seção **Troubleshooting** no [README.md](n8n-workflows/README.md)

**Erros comuns:**
- ❌ Unauthorized → Confira Client ID/Secret
- ❌ Journey not found → Verifique o Journey ID
- ❌ Insufficient privileges → Adicione permissões no Installed Package

---

## 🤝 Contribuir

Encontrou um bug? Quer adicionar features?
1. Abra uma issue
2. Envie um PR
3. Entre em contato!

---

## 📞 Suporte

- **Marketing Cloud Docs:** https://developer.salesforce.com/docs/marketing/marketing-cloud
- **N8N Docs:** https://docs.n8n.io
- **Issues:** [Abrir issue](../../issues)

---

## ✅ Checklist de Início

- [ ] Li o [GUIA-RAPIDO.md](n8n-workflows/GUIA-RAPIDO.md)
- [ ] Copiei minhas credenciais do Marketing Cloud
- [ ] Criei conta no N8N
- [ ] Importei o workflow (escolhi uma versão)
- [ ] Configurei as credenciais
- [ ] Testei e funcionou! 🎉

---

## 📝 Licença

MIT - Use à vontade!

---

**Desenvolvido com ❤️ para facilitar sua vida com Marketing Cloud**

**⏱️ Configuração:** 5 minutos
**💰 Custo:** $0 (gratuito)
**📱 Plataforma:** Web/Mobile
**🔧 Dificuldade:** ⭐⭐ Fácil

**🚀 Comece agora:** [GUIA-RAPIDO.md](n8n-workflows/GUIA-RAPIDO.md)
