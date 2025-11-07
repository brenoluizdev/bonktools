import { setFootballMode } from "../functions/setFootballMode";
import { SERVER_MESSAGE_TYPES } from "../types/constants.types";
import { JoinTeam } from "../types/joinTeam.types";

export default {
  name: "teste2",
  description: "teste2",
  async execute(bot: any) {
    console.log('=== INICIANDO COMANDO ===');
    
    try {
      console.log('1. Verificando conexão...');
      console.log('Connected:', bot.connected);
      console.log('Bot ID:', bot.game.id);
      console.log('Host ID:', bot.game.host);
      console.log('Is host?', bot.game.host === bot.game.id);
      
      console.log('2. Chamando bot.ready(true)...');
      await bot.ready(true);
      console.log('   ✓ Ready executado');

      console.log('3. Aguardando 500ms...');
      await new Promise(resolve => setTimeout(resolve, 500));
      console.log('   ✓ Aguardado');
      
      console.log('4. Verificando estado antes do countdown...');
      console.log('   - In game:', bot.room.inGame);
      console.log('   - Countdown:', bot.room.countdown);
      console.log('   - Players:', bot.getAllPlayers().map(p => ({
        id: p.id,
        username: p.username,
        ready: p.ready,
        team: p.team
      })));
      
      console.log('5. Chamando startGameCountdown(3)...');
      await bot.startGameCountdown(3);
      console.log('   ✓ Countdown iniciado!');
      
    } catch (error) {
      console.error('❌ ERRO NO COMANDO:', error);
      console.error('Stack:', error.stack);
    }
    
    console.log('=== COMANDO FINALIZADO ===');
  },
};