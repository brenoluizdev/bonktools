#!/bin/bash

# =============================================================================
# Script de instalação do FUTHERO Bot Rating System
# Execute apenas: ./setup.sh   (uma linha por vez no terminal)
# =============================================================================

ERRORS=0
WARNINGS=0

echo ""
echo "🚀 FUTHERO Bot - Setup"
echo "======================"
echo ""

# -----------------------------------------------------------------------------
# 1. Verificar diretório do projeto
# -----------------------------------------------------------------------------
if [ ! -f "package.json" ]; then
    echo "❌ ERRO: Execute este script na raiz do projeto (onde está o package.json)."
    echo "   Diretório atual: $(pwd)"
    exit 1
fi
echo "✅ Diretório do projeto: $(pwd)"
echo ""

# -----------------------------------------------------------------------------
# 2. Verificar Node.js
# -----------------------------------------------------------------------------
if ! command -v node &> /dev/null; then
    echo "❌ ERRO: Node.js não encontrado."
    echo "   Instale Node.js 16+ em: https://nodejs.org/"
    exit 1
fi

NODE_VERSION=$(node -v | sed 's/v//' | cut -d. -f1)
if [ "$NODE_VERSION" -lt 16 ] 2>/dev/null; then
    echo "❌ ERRO: Node.js 16 ou superior é necessário."
    echo "   Versão atual: $(node -v)"
    exit 1
fi
echo "✅ Node.js $(node -v) (OK)"
echo ""

# -----------------------------------------------------------------------------
# 3. Verificar npm
# -----------------------------------------------------------------------------
if ! command -v npm &> /dev/null; then
    echo "❌ ERRO: npm não encontrado."
    echo "   Normalmente vem com o Node.js. Reinstale o Node.js."
    exit 1
fi
echo "✅ npm $(npm -v)"
echo ""

# -----------------------------------------------------------------------------
# 4. Criar .env.example se não existir
# -----------------------------------------------------------------------------
if [ ! -f ".env.example" ]; then
    echo "📝 Criando .env.example (arquivo não existia)..."
    cat > .env.example << 'ENVEXAMPLE'
# Configuração do Bot
BOT_PASSWORD=sua_senha_aqui

# Configuração da Sala (opcional)
ROOM_NAME=🔥 FUTHERO | X2 | FUTSAL 🔥
ROOM_PASSWORD=0102030405
ROOM_MAX_PLAYERS=8
ROOM_MIN_LEVEL=0
ROOM_HIDDEN=false

# Webhook Discord (opcional)
# DISCORD_WEBHOOK_URL=https://discord.com/api/webhooks/...

# Modo de teste (opcional)
# TEST_BROWSER_START=0
ENVEXAMPLE
    if [ -f ".env.example" ]; then
        echo "   ✅ .env.example criado."
    else
        echo "   ❌ Falha ao criar .env.example."
        ERRORS=$((ERRORS + 1))
    fi
    echo ""
else
    echo "✅ .env.example já existe"
    echo ""
fi

# -----------------------------------------------------------------------------
# 5. Criar .env a partir de .env.example (se .env não existir)
# -----------------------------------------------------------------------------
if [ ! -f ".env" ]; then
    if [ -f ".env.example" ]; then
        echo "📝 Criando .env a partir de .env.example..."
        cp .env.example .env
        echo "   ✅ .env criado."
        echo "   ⚠️  OBRIGATÓRIO: Edite o arquivo .env e defina BOT_PASSWORD com sua senha do Bonk.io."
        WARNINGS=$((WARNINGS + 1))
    else
        echo "❌ ERRO: .env não existe e .env.example também não."
        echo "   Crie um arquivo .env na raiz com pelo menos: BOT_PASSWORD=sua_senha"
        ERRORS=$((ERRORS + 1))
    fi
    echo ""
else
    echo "✅ .env já existe (não foi alterado)"
    if ! grep -q "BOT_PASSWORD=.\+" .env 2>/dev/null; then
        echo "   ⚠️  Verifique se BOT_PASSWORD está definido no .env"
        WARNINGS=$((WARNINGS + 1))
    fi
    echo ""
fi

# -----------------------------------------------------------------------------
# 6. Instalar dependências npm
# -----------------------------------------------------------------------------
echo "📦 Instalando dependências (npm install)..."
echo "   (isso pode levar alguns segundos)"
echo ""

if ! npm install 2>&1; then
    echo ""
    echo "❌ ERRO: Falha ao executar 'npm install'."
    echo "   - Verifique sua conexão com a internet."
    echo "   - Tente: npm cache clean --force && npm install"
    ERRORS=$((ERRORS + 1))
else
    echo ""
    echo "✅ Dependências instaladas com sucesso."
fi
echo ""

# -----------------------------------------------------------------------------
# 7. Auditoria de segurança (informativo)
# -----------------------------------------------------------------------------
if npm audit 2>/dev/null | grep -q "vulnerabilities"; then
    echo "ℹ️  npm audit encontrou vulnerabilidades. Para tentar corrigir:"
    echo "   npm audit fix          (correções seguras)"
    echo "   npm audit fix --force  (pode quebrar dependências)"
    echo ""
fi

# -----------------------------------------------------------------------------
# 8. Diretório data/
# -----------------------------------------------------------------------------
if [ ! -d "data" ]; then
    echo "📁 Criando diretório data/..."
    mkdir -p data
    echo "   ✅ data/ criado (usado pelo banco de dados de rating)."
else
    echo "✅ Diretório data/ já existe"
fi
echo ""

# -----------------------------------------------------------------------------
# 9. Resumo final
# -----------------------------------------------------------------------------
echo "======================"
if [ $ERRORS -gt 0 ]; then
    echo "⚠️  Setup concluído com $ERRORS erro(s). Corrija os itens acima antes de rodar 'npm run dev'."
    echo ""
    exit 1
fi

echo "✅ Setup concluído com sucesso!"
if [ $WARNINGS -gt 0 ]; then
    echo "   ($WARNINGS aviso(s) - verifique as mensagens acima)"
fi
echo ""
echo "📋 Próximos passos:"
echo "   1. Edite o arquivo .env e defina BOT_PASSWORD com sua senha do Bonk.io."
echo "   2. Inicie o bot com: npm run dev"
echo ""
echo "📚 Documentação:"
echo "   README_RATING.md  - Guia de uso"
echo "   DEVELOPMENT.md    - Guia de desenvolvimento"
echo "   USAGE_GUIDE.md    - Guia rápido para jogadores"
echo ""
echo "💡 Dica: Execute apenas um comando por vez no terminal (ex.: só ./setup.sh)."
echo ""
echo "🎮 Bom jogo!"
echo ""
