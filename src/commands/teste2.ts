export default {
  name: "teste2",
  description: "Inicia jogo de futebol",
  async execute(bot: any) {
    console.log("Testando com mapa real do Bonk.io...");
    
    await bot.ready(true);
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Usar um mapa de futebol real do banco de dados
    // ID 767645 é um mapa padrão
    try {
      console.log("Carregando mapa 767645...");
      await bot.loadMapById(767645);
      console.log("✓ Mapa carregado");
    } catch (error: any) {
      console.error("❌ Erro ao carregar mapa:", error.message);
      console.log("Usando mapa padrão como fallback...");
    }
    
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    console.log("Iniciando jogo com mapa real...");
    await bot.startGame();
  },
};