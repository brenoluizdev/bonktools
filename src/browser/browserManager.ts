import puppeteer, { Browser, Page } from "puppeteer-core";

/**
 * Browser manager to keep a Bonk.io instance open.
 * Bonk.io requires a real browser window for some actions (GAME_START, CHANGE_OTHER_TEAM)
 * to work correctly due to internal security rules.
 */
export class BrowserManager {
  private browser: Browser | null = null;
  private page: Page | null = null;
  private roomUrl: string | null = null;

  /**
   * Starts the browser and navigates to the bot room.
   * IMPORTANT: The browser does NOT log in, it only opens the room URL.
   * The bot (bonktools) is already connected via WebSocket on the same account.
   * The browser is only used to keep the required presence for game start.
   *
   * @param roomUrl - Room URL (https://bonk.io/...)
   * @param options - Configuration options
   */
  async launch(
    roomUrl: string,
    options: {
      headless?: boolean;
      executablePath?: string;
    } = {}
  ): Promise<void> {
    try {
      this.roomUrl = roomUrl;

      const headless = options.headless ?? process.env.BROWSER_HEADLESS === "true";
      const envPath = process.env.CHROME_PATH?.trim();
      const executablePath =
        (options.executablePath?.trim() || envPath) || this.getDefaultChromePath();

      console.log("[Browser] Starting browser...");
      console.log(`[Browser] Path: ${executablePath}`);
      console.log(`[Browser] Headless: ${headless}`);
      console.log("[Browser] NOTE: Browser will not log in - it only opens the room as a visitor");

      this.browser = await puppeteer.launch({
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

      // Configure user agent to look more natural
      await this.page.setUserAgent(
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
      );

      console.log(`[Browser] Navigating to: ${roomUrl}`);
      
      // Navigate directly to the room (WITHOUT logging in)
      await this.page.goto(roomUrl, {
        waitUntil: "domcontentloaded",
        timeout: 30000,
      });

      // Wait for the game iframe to load
      try {
        await this.page.waitForSelector("#maingameframe", { timeout: 10000 });
        console.log("[Browser] ✅ Browser connected to room!");
        console.log("[Browser] Browser is only observing (not logged in)");
        console.log("[Browser] Bot (bonktools) controls everything via WebSocket");
        console.log("[Browser] ⚠️  KEEP THIS BROWSER OPEN for game start to work!");
      } catch (error) {
        console.warn("[Browser] ⚠️  Game iframe did not load, continuing anyway...");
      }
    } catch (error) {
      console.error("[Browser] ❌ Error while starting browser:", error);
      throw error;
    }
  }

  /**
   * Closes the browser
   */
  async close(): Promise<void> {
    if (this.browser) {
      console.log("[Browser] Closing browser...");
      await this.browser.close();
      this.browser = null;
      this.page = null;
      console.log("[Browser] Browser closed.");
    }
  }

  /**
   * Checks if the browser is active
   */
  isActive(): boolean {
    return this.browser !== null && this.browser.connected;
  }

  /**
   * Returns the default Chrome path for each OS
   */
  private getDefaultChromePath(): string {
    const platform = process.platform;

    switch (platform) {
      case "darwin": // macOS
        return "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
      case "win32": // Windows
        return "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
      case "linux":
        return "/usr/bin/google-chrome";
      default:
        throw new Error(`[Browser] Unsupported operating system: ${platform}`);
    }
  }

  /**
   * Returns the current room URL
   */
  getRoomUrl(): string | null {
    return this.roomUrl;
  }

  /**
   * Executes JavaScript in the browser page (for debugging)
   */
  async evaluate<T>(script: string): Promise<T | null> {
    if (!this.page) {
      console.warn("[Browser] Browser is not active.");
      return null;
    }

    try {
      const result = await this.page.evaluate(script);
      return result as T;
    } catch (error) {
      console.error("[Browser] Error while executing script:", error);
      return null;
    }
  }

  /**
   * Takes a screenshot of the page (for debugging)
   */
  async screenshot(path: string): Promise<void> {
    if (!this.page) {
      console.warn("[Browser] Browser is not active.");
      return;
    }

    try {
      await this.page.screenshot({ path, fullPage: false });
      console.log(`[Browser] Screenshot saved to: ${path}`);
    } catch (error) {
      console.error("[Browser] Error while taking screenshot:", error);
    }
  }
}

// Singleton instance
export const browserManager = new BrowserManager();
