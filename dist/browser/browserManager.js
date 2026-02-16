"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.browserManager = exports.BrowserManager = void 0;
const puppeteer_core_1 = __importDefault(require("puppeteer-core"));
/**
 * Gerenciador de navegador para manter uma instância do Bonk.io aberta.
 * O Bonk.io requer um navegador real aberto para certas ações (GAME_START, CHANGE_OTHER_TEAM)
 * funcionarem corretamente por questões de segurança interna.
 */
class BrowserManager {
    constructor() {
        this.browser = null;
        this.page = null;
        this.roomUrl = null;
    }
    /**
     * Inicia o navegador e navega para a sala do bot
     * IMPORTANTE: O navegador NÃO faz login, apenas abre a URL da sala.
     * O bot (bonktools) já está conectado via WebSocket na mesma conta.
     * O navegador serve apenas para manter a "presença" necessária para game start.
     *
     * @param roomUrl - URL da sala (https://bonk.io/...)
     * @param options - Opções de configuração
     */
    async launch(roomUrl, options = {}) {
        try {
            this.roomUrl = roomUrl;
            const headless = options.headless ?? process.env.BROWSER_HEADLESS === "true";
            const envPath = process.env.CHROME_PATH?.trim();
            const executablePath = (options.executablePath?.trim() || envPath) || this.getDefaultChromePath();
            console.log("[Browser] Iniciando navegador...");
            console.log(`[Browser] Path: ${executablePath}`);
            console.log(`[Browser] Headless: ${headless}`);
            console.log("[Browser] NOTA: Navegador não fará login - apenas abre a sala como visitante");
            this.browser = await puppeteer_core_1.default.launch({
                executablePath,
                headless,
                args: [
                    "--no-sandbox",
                    "--disable-setuid-sandbox",
                    "--disable-dev-shm-usage",
                    "--disable-web-security",
                    "--mute-audio",
                    "--disable-blink-features=AutomationControlled", // Evita detecção de automação
                ],
                defaultViewport: {
                    width: 1280,
                    height: 720,
                },
            });
            this.page = await this.browser.newPage();
            // Configurar user agent para parecer mais natural
            await this.page.setUserAgent("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36");
            console.log(`[Browser] Navegando para: ${roomUrl}`);
            // Navegar diretamente para a sala (SEM fazer login)
            await this.page.goto(roomUrl, {
                waitUntil: "domcontentloaded",
                timeout: 30000,
            });
            // Aguardar o iframe do jogo carregar
            try {
                await this.page.waitForSelector("#maingameframe", { timeout: 10000 });
                console.log("[Browser] ✅ Navegador conectado à sala!");
                console.log("[Browser] O navegador está apenas observando (não fez login)");
                console.log("[Browser] O bot (bonktools) controla tudo via WebSocket");
                console.log("[Browser] ⚠️  MANTENHA ESTE NAVEGADOR ABERTO para game start funcionar!");
            }
            catch (error) {
                console.warn("[Browser] ⚠️  Iframe do jogo não carregou, mas continuando...");
            }
        }
        catch (error) {
            console.error("[Browser] ❌ Erro ao iniciar navegador:", error);
            throw error;
        }
    }
    /**
     * Fecha o navegador
     */
    async close() {
        if (this.browser) {
            console.log("[Browser] Fechando navegador...");
            await this.browser.close();
            this.browser = null;
            this.page = null;
            console.log("[Browser] Navegador fechado.");
        }
    }
    /**
     * Verifica se o navegador está ativo
     */
    isActive() {
        return this.browser !== null && this.browser.connected;
    }
    /**
     * Retorna o caminho padrão do Chrome para diferentes sistemas operacionais
     */
    getDefaultChromePath() {
        const platform = process.platform;
        switch (platform) {
            case "darwin": // macOS
                return "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
            case "win32": // Windows
                return "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
            case "linux":
                return "/usr/bin/google-chrome";
            default:
                throw new Error(`[Browser] Sistema operacional não suportado: ${platform}`);
        }
    }
    /**
     * Retorna a URL da sala
     */
    getRoomUrl() {
        return this.roomUrl;
    }
    /**
     * Executa JavaScript na página do navegador (para debugging)
     */
    async evaluate(script) {
        if (!this.page) {
            console.warn("[Browser] Navegador não está ativo.");
            return null;
        }
        try {
            const result = await this.page.evaluate(script);
            return result;
        }
        catch (error) {
            console.error("[Browser] Erro ao executar script:", error);
            return null;
        }
    }
    /**
     * Tira screenshot da página (para debugging)
     */
    async screenshot(path) {
        if (!this.page) {
            console.warn("[Browser] Navegador não está ativo.");
            return;
        }
        try {
            await this.page.screenshot({ path, fullPage: false });
            console.log(`[Browser] Screenshot salvo em: ${path}`);
        }
        catch (error) {
            console.error("[Browser] Erro ao tirar screenshot:", error);
        }
    }
}
exports.BrowserManager = BrowserManager;
// Instância singleton
exports.browserManager = new BrowserManager();
