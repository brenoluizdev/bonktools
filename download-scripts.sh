#!/bin/bash

# Script para baixar os arquivos necessários do bonk-rating-bot

echo "🔽 Baixando scripts necessários do bonk-rating-bot..."
echo ""

cd dependencies || exit 1

# URLs dos arquivos
SGRAPI_URL="https://raw.githubusercontent.com/SneezingCactus/bonk-rating-bot/main/dependencies/sgrAPI.user.js"
INJECTOR_URL="https://raw.githubusercontent.com/SneezingCactus/bonk-rating-bot/main/dependencies/CondensedInjector.js"

# Baixar sgrAPI.user.js
echo "📥 Baixando sgrAPI.user.js..."
if command -v curl &> /dev/null; then
    curl -sL "$SGRAPI_URL" -o sgrAPI.user.js
elif command -v wget &> /dev/null; then
    wget -q "$SGRAPI_URL" -O sgrAPI.user.js
else
    echo "❌ Erro: curl ou wget não encontrado"
    echo "Por favor, baixe manualmente de:"
    echo "$SGRAPI_URL"
    exit 1
fi

# Baixar CondensedInjector.js
echo "📥 Baixando CondensedInjector.js..."
if command -v curl &> /dev/null; then
    curl -sL "$INJECTOR_URL" -o CondensedInjector.js
elif command -v wget &> /dev/null; then
    wget -q "$INJECTOR_URL" -O CondensedInjector.js
else
    echo "❌ Erro: curl ou wget não encontrado"
    echo "Por favor, baixe manualmente de:"
    echo "$INJECTOR_URL"
    exit 1
fi

# Verificar downloads
echo ""
echo "✅ Verificando downloads..."
if [ -f "sgrAPI.user.js" ] && [ -s "sgrAPI.user.js" ]; then
    echo "   ✅ sgrAPI.user.js - OK"
else
    echo "   ❌ sgrAPI.user.js - FALHOU"
    exit 1
fi

if [ -f "CondensedInjector.js" ] && [ -s "CondensedInjector.js" ]; then
    echo "   ✅ CondensedInjector.js - OK"
else
    echo "   ❌ CondensedInjector.js - FALHOU"
    exit 1
fi

echo ""
echo "🎉 Scripts baixados com sucesso!"
echo ""
echo "📁 Arquivos em dependencies/:"
ls -lh sgrAPI.user.js CondensedInjector.js
echo ""
echo "✅ Próximo passo: npm run dev:new"
