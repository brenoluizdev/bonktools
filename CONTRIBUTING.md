# 🤝 Contributing to BonkTools

Obrigado por considerar contribuir com a BonkTools! Este documento fornece diretrizes para contribuir com o projeto.

## 📋 Índice

- [Código de Conduta](#código-de-conduta)
- [Como Posso Contribuir?](#como-posso-contribuir)
- [Estrutura do Projeto](#estrutura-do-projeto)
- [Ambiente de Desenvolvimento](#ambiente-de-desenvolvimento)
- [Processo de Contribuição](#processo-de-contribuição)
- [Padrões de Código](#padrões-de-código)
- [Commit Guidelines](#commit-guidelines)
- [Reportando Bugs](#reportando-bugs)
- [Sugerindo Funcionalidades](#sugerindo-funcionalidades)
- [Perguntas Frequentes](#perguntas-frequentes)

## 📜 Código de Conduta

Este projeto adere ao [Contributor Covenant Code of Conduct](CODE_OF_CONDUCT.md). Ao participar, você está comprometido a manter um ambiente respeitoso e inclusivo.

### Comportamentos Esperados

- ✅ Usar linguagem acolhedora e inclusiva
- ✅ Respeitar diferentes pontos de vista e experiências
- ✅ Aceitar críticas construtivas com elegância
- ✅ Focar no que é melhor para a comunidade
- ✅ Mostrar empatia com outros membros da comunidade

### Comportamentos Inaceitáveis

- ❌ Uso de linguagem ou imagens sexualizadas
- ❌ Comentários insultuosos ou depreciativos (trolling)
- ❌ Assédio público ou privado
- ❌ Publicar informações privadas de outros sem permissão
- ❌ Outras condutas que possam ser consideradas inapropriadas

## 💡 Como Posso Contribuir?

Há várias maneiras de contribuir com a BonkTools:

### 1. 🐛 Reportar Bugs

Encontrou um bug? Ajude-nos criando um [issue detalhado](#reportando-bugs).

### 2. 💭 Sugerir Funcionalidades

Tem uma ideia para melhorar a BonkTools? [Compartilhe conosco](#sugerindo-funcionalidades)!

### 3. 📝 Melhorar Documentação

- Corrigir typos
- Adicionar exemplos
- Melhorar explicações
- Traduzir documentação

### 4. 🔧 Implementar Funcionalidades

- Escolha uma issue marcada como `good first issue` ou `help wanted`
- Comente na issue que você vai trabalhar nela
- Siga o [processo de contribuição](#processo-de-contribuição)

### 5. 🧪 Escrever Testes

- Adicionar testes unitários
- Melhorar cobertura de testes
- Criar testes de integração

### 6. 🎨 Criar Exemplos

- Bots interessantes usando BonkTools
- Tutoriais passo-a-passo
- Use cases avançados

## 🏗️ Estrutura do Projeto

```
bonktools/
├── src/                    # Código fonte
│   ├── connection/         # Camada de conexão WebSocket
│   │   ├── BonkConnection.ts
│   │   ├── PacketParser.ts
│   │   ├── PacketBuilder.ts
│   │   └── types.ts
│   │
│   ├── simulator/          # Simulador de física Box2D
│   │   ├── PhysicsWorld.ts
│   │   ├── GameState.ts
│   │   ├── CollisionDetector.ts
│   │   ├── InputProcessor.ts
│   │   └── types.ts
│   │
│   ├── game/              # Lógica de alto nível
│   │   ├── RoomManager.ts
│   │   ├── PlayerManager.ts
│   │   ├── GameLoop.ts
│   │   ├── EventEmitter.ts
│   │   └── types.ts
│   │
│   ├── api/               # API HTTP do Bonk.io
│   │   ├── BonkAPI.ts
│   │   └── types.ts
│   │
│   ├── types/             # Types globais
│   │   ├── index.ts
│   │   ├── events.ts
│   │   ├── config.ts
│   │   └── shared.ts
│   │
│   ├── utils/             # Utilitários
│   │   ├── logger.ts
│   │   ├── constants.ts
│   │   └── helpers.ts
│   │
│   └── index.ts           # Entry point
│
├── examples/              # Exemplos de uso
│   ├── simple-bot.ts
│   ├── host-bot.ts
│   ├── tournament-bot.ts
│   └── spectator-bot.ts
│
├── tests/                 # Testes
│   ├── unit/
│   ├── integration/
│   └── e2e/
│
├── docs/                  # Documentação adicional
│   ├── getting-started.md
│   ├── api-reference.md
│   ├── architecture.md
│   └── examples.md
│
├── .github/               # GitHub configs
│   ├── workflows/
│   ├── ISSUE_TEMPLATE/
│   └── PULL_REQUEST_TEMPLATE.md
│
├── package.json
├── tsconfig.json
├── .gitignore
├── .eslintrc.js
├── .prettierrc
├── jest.config.js
├── README.md
├── CONTRIBUTING.md
├── LICENSE
└── CHANGELOG.md
```

## 🛠️ Ambiente de Desenvolvimento

### Pré-requisitos

- **Node.js** >= 16.0.0
- **npm** >= 8.0.0
- **Git**
- Editor de código (recomendamos VS Code)

### Setup Inicial

1. **Fork o repositório**

   Clique em "Fork" no GitHub para criar sua cópia do projeto.

2. **Clone seu fork**

   ```bash
   git clone https://github.com/seu-usuario/bonktools.git
   cd bonktools
   ```

3. **Adicione o repositório original como upstream**

   ```bash
   git remote add upstream https://github.com/OBL/bonktools.git
   ```

4. **Instale as dependências**

   ```bash
   npm install
   ```

5. **Configure seu ambiente**

   ```bash
   cp .env.example .env
   # Edite .env com suas configurações
   ```

### Comandos Disponíveis

```bash
# Desenvolvimento
npm run dev              # Compilar em modo watch
npm run build            # Build para produção
npm run clean            # Limpar pasta dist/

# Testes
npm test                 # Rodar todos os testes
npm run test:watch       # Testes em modo watch
npm run test:coverage    # Testes com cobertura
npm run test:unit        # Apenas testes unitários
npm run test:integration # Apenas testes de integração

# Qualidade de Código
npm run lint             # Rodar ESLint
npm run lint:fix         # Corrigir problemas automaticamente
npm run format           # Formatar código com Prettier
npm run format:check     # Verificar formatação
npm run typecheck        # Verificar tipos TypeScript

# Exemplos
npm run example:simple   # Rodar exemplo simples
npm run example:host     # Rodar exemplo host bot

# Documentação
npm run docs:build       # Gerar documentação
npm run docs:serve       # Servir documentação localmente
```

### Configuração do VS Code

Adicione estas extensões recomendadas:

- **ESLint** - Linting
- **Prettier** - Formatação
- **TypeScript and JavaScript Language Features** - IntelliSense
- **GitLens** - Git insights
- **Jest** - Testes

Configurações recomendadas (`.vscode/settings.json`):

```json
{
  "editor.formatOnSave": true,
  "editor.defaultFormatter": "esbenp.prettier-vscode",
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": true
  },
  "typescript.tsdk": "node_modules/typescript/lib",
  "typescript.enablePromptUseWorkspaceTsdk": true
}
```

## 🔄 Processo de Contribuição

### 1. Escolha ou Crie uma Issue

- Procure issues existentes com labels `good first issue` ou `help wanted`
- Se não existir, crie uma nova issue descrevendo o que você quer fazer
- Aguarde aprovação/feedback antes de começar a trabalhar

### 2. Crie uma Branch

```bash
# Atualize sua main
git checkout main
git pull upstream main

# Crie uma branch com nome descritivo
git checkout -b feature/nome-da-feature
# ou
git checkout -b fix/descricao-do-bug
```

Convenção de nomes de branches:
- `feature/` - Novas funcionalidades
- `fix/` - Correção de bugs
- `docs/` - Apenas documentação
- `refactor/` - Refatoração de código
- `test/` - Adicionar ou melhorar testes
- `chore/` - Tarefas de manutenção

### 3. Faça suas Alterações

- Escreva código limpo e bem documentado
- Siga os [padrões de código](#padrões-de-código)
- Adicione testes para novas funcionalidades
- Atualize a documentação se necessário

### 4. Teste suas Alterações

```bash
# Certifique-se que tudo funciona
npm run build
npm test
npm run lint

# Teste manualmente com exemplos
npm run example:simple
```

### 5. Commit suas Alterações

Siga as [diretrizes de commit](#commit-guidelines):

```bash
git add .
git commit -m "feat: adicionar detecção de colisão com capzone"
```

### 6. Push para seu Fork

```bash
git push origin feature/nome-da-feature
```

### 7. Abra um Pull Request

- Vá para o GitHub e clique em "New Pull Request"
- Preencha o template de PR com detalhes
- Referencie a issue relacionada (ex: `Closes #123`)
- Aguarde review

### 8. Responda ao Review

- Faça as alterações solicitadas
- Marque conversas como resolvidas quando aplicável
- Faça push das alterações (serão adicionadas ao PR automaticamente)

### 9. Merge

Após aprovação, um maintainer fará o merge do seu PR. Parabéns! 🎉

## 📝 Padrões de Código

### TypeScript

- **Strict mode** habilitado
- **Tipos explícitos** sempre que possível
- **Evite `any`** - use `unknown` ou tipos específicos
- **Interfaces** para objetos públicos
- **Types** para unions e helpers

```typescript
// ✅ Bom
interface PlayerData {
  id: number;
  username: string;
  position: Vector2;
}

function getPlayer(id: number): PlayerData | null {
  // ...
}

// ❌ Ruim
function getPlayer(id: any): any {
  // ...
}
```

### Nomenclatura

- **Classes**: PascalCase (`BonkConnection`, `PhysicsWorld`)
- **Interfaces/Types**: PascalCase (`PlayerData`, `RoomInfo`)
- **Funções/Métodos**: camelCase (`getPlayer`, `sendMessage`)
- **Variáveis**: camelCase (`playerCount`, `isReady`)
- **Constantes**: UPPER_SNAKE_CASE (`MAX_PLAYERS`, `DEFAULT_TIMEOUT`)
- **Arquivos**: PascalCase para classes (`BonkConnection.ts`), camelCase para utils (`logger.ts`)

### Formatação

- **Indentação**: 2 espaços
- **Aspas**: Simples (`'`) para strings
- **Ponto e vírgula**: Sempre
- **Vírgula final**: Sempre em objetos/arrays multi-linha
- **Linha máxima**: 100 caracteres (soft limit)

Prettier está configurado para formatar automaticamente.

### Comentários e Documentação

```typescript
/**
 * Send a chat message to the room
 * 
 * @param message - Message to send (max 200 characters)
 * @throws {Error} If message is empty or too long
 * @throws {Error} If not connected to server
 * 
 * @example
 * ```typescript
 * await bot.chat('Hello everyone! 👋');
 * ```
 */
async chat(message: string): Promise<void> {
  // Validate message
  if (!message || message.trim().length === 0) {
    throw new Error('Message cannot be empty');
  }
  
  // Implementation...
}
```

- Use **JSDoc** para métodos públicos
- Comente código complexo com `//`
- Explique o "porquê", não o "o quê"

### Error Handling

```typescript
// ✅ Bom - Erros específicos e informativos
if (!this.connected) {
  throw new Error('Not connected to server. Call connect() first.');
}

if (rounds < 1 || rounds > 999) {
  throw new Error('Rounds must be between 1 and 999');
}

// ❌ Ruim - Mensagens genéricas
if (!this.connected) {
  throw new Error('Error');
}
```

### Async/Await

```typescript
// ✅ Bom
async function getData(): Promise<Data> {
  try {
    const result = await api.fetch();
    return result;
  } catch (error) {
    logger.error('Failed to fetch data', error);
    throw error;
  }
}

// ❌ Ruim - Promises sem await
function getData(): Promise<Data> {
  return api.fetch().then(result => result);
}
```

### Imports

```typescript
// ✅ Bom - Ordenado e agrupado
import { EventEmitter } from 'eventemitter3';
import io from 'socket.io-client';

import { BonkConnection } from '@/connection/BonkConnection';
import { PhysicsWorld } from '@/simulator/PhysicsWorld';
import { createLogger } from '@/utils/logger';
import type { BonkToolsOptions, PlayerData } from '@/types';

// ❌ Ruim - Desordenado
import type { BonkToolsOptions } from '@/types';
import { BonkConnection } from '@/connection/BonkConnection';
import io from 'socket.io-client';
import { createLogger } from '@/utils/logger';
```

## 📋 Commit Guidelines

Seguimos o [Conventional Commits](https://www.conventionalcommits.org/):

### Formato

```
<type>(<scope>): <subject>

[optional body]

[optional footer]
```

### Types

- **feat**: Nova funcionalidade
- **fix**: Correção de bug
- **docs**: Apenas documentação
- **style**: Formatação (não afeta lógica)
- **refactor**: Refatoração de código
- **perf**: Melhoria de performance
- **test**: Adicionar/melhorar testes
- **chore**: Tarefas de manutenção
- **ci**: Alterações em CI/CD
- **build**: Alterações no build system

### Scopes (opcional)

- `connection`: Camada de conexão
- `simulator`: Simulador de física
- `game`: Lógica de jogo
- `api`: API HTTP
- `types`: Definições de tipos
- `utils`: Utilitários
- `examples`: Exemplos
- `docs`: Documentação

### Exemplos

```bash
# Feature
git commit -m "feat(simulator): add collision detection with capzones"

# Bug fix
git commit -m "fix(connection): prevent memory leak in socket reconnection"

# Documentation
git commit -m "docs: add example for tournament bot"

# Breaking change
git commit -m "feat(api)!: change createRoom signature

BREAKING CHANGE: createRoom now returns Promise<RoomInfo> instead of RoomInfo"

# Multiple changes
git commit -m "refactor(game): improve player state management

- Extract PlayerState class
- Add validation for state transitions
- Improve type safety"
```

### Regras

- Use imperativo ("add" não "added" ou "adds")
- Primeira letra minúscula
- Sem ponto final
- Subject: máximo 72 caracteres
- Body: explique o "porquê" e "o quê", não o "como"
- Footer: referencie issues (`Closes #123`, `Refs #456`)

## 🐛 Reportando Bugs

Antes de reportar, procure se já não existe uma issue sobre o problema.

### Template de Bug Report

markdown
**Descrição do Bug**
Descrição clara e concisa do problema.

**Como Reproduzir**
1. Vá para '...'
2. Execute '...'
3. Observe o erro

**Comportamento Esperado**
O que você esperava que acontecesse.

**Comportamento Atual**
O que realmente aconteceu.

**Ambiente**
- OS: [e.g., Windows 10, Ubuntu 22.04]
- Node.js: [e.g., 18.16.0]
- BonkTools: [e.g., 2.0.0]

**Código de Exemplo**
```typescript
const bot = createBot({ /* ... */ });
// código que causa o erro
```

**Logs/Screenshots**
Se aplicável, adicione logs de erro ou screenshots.

**Contexto Adicional**
Qualquer outra informação relevante.


## 💭 Sugerindo Funcionalidades

### Template de Feature Request

```markdown
**Qual problema esta feature resolveria?**
Descrição clara do problema ou limitação atual.

**Descrição da Solução**
Como você imagina que a feature funcionaria.

**Alternativas Consideradas**
Outras soluções que você pensou.

**Exemplo de Uso**
```typescript
// Como você gostaria de usar a feature
bot.on('newFeature', (data) => {
  // ...
});
```

**Contexto Adicional**
Screenshots, diagramas, links, etc.

**Prioridade**
- [ ] High (bloqueante para uso)
- [ ] Medium (melhoria significativa)
- [ ] Low (nice to have)


## ❓ Perguntas Frequentes

### Como testo minhas alterações localmente?

```bash
# Build e teste
npm run build
npm test

# Teste com exemplo
npm run example:host
```

### Meu PR foi rejeitado, e agora?

- Leia os comentários do reviewer
- Faça as alterações solicitadas
- Faça push das alterações (não precisa criar novo PR)
- Peça esclarecimentos se não entender algo

### Posso trabalhar em múltiplas issues ao mesmo tempo?

Recomendamos focar em uma issue por vez para evitar confusão e facilitar o review.

### Como mantenho minha fork atualizada?

```bash
# Buscar alterações do upstream
git fetch upstream

# Atualizar sua main
git checkout main
git merge upstream/main
git push origin main

# Atualizar branch de trabalho
git checkout feature/minha-branch
git rebase main
```

### Preciso assinar um CLA?

Não! Contribuições são licenciadas sob MIT, sem necessidade de CLA.

### Como posso me tornar um maintainer?

Contribua consistentemente por alguns meses. Maintainers são convidados pela comunidade.

## 🎯 Boas Práticas

### Para Iniciantes

1. Comece com issues marcadas `good first issue`
2. Pergunte antes de começar se não entender algo
3. Faça PRs pequenos e focados
4. Teste bem suas alterações

### Para Todos

1. **Comunique-se**: Comente na issue antes de começar
2. **Seja paciente**: Reviews podem demorar alguns dias
3. **Seja respeitoso**: Todos estamos aprendendo
4. **Teste tudo**: Código sem testes não será aceito
5. **Documente**: Código sem documentação é difícil de manter

## 📞 Precisa de Ajuda?

- **GitHub Discussions**: Para perguntas gerais
- **GitHub Issues**: Para bugs e features
- **Discord**: [Link do servidor] - Para chat em tempo real
- **Email**: bonktools@gmail.com

## 🙏 Agradecimentos

Obrigado por contribuir com a BonkTools! Cada contribuição, por menor que seja, ajuda a melhorar a experiência de toda a comunidade Bonk.io brasileira.

---

**Última atualização**: November 2024
**Versão**: 2.0.0
