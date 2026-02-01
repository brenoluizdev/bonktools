import { CLIENT_MESSAGE_TYPES } from "bonkbot";
import bot from "../bot";
import { JoinTeam } from "../types/joinTeam.types";

export default function readyEvent(botInstance: typeof bot) { 
  botInstance.events.on("ready", async () => {
    console.log("✅ Bot is fully ready and connected to Bonk.io servers!");

    try {
      await botInstance.connect();
      console.log("🔌 Connection established!");

      await new Promise((resolve) => setTimeout(resolve, 3000));

      const room = await botInstance.createRoom({
        roomname: "🔥 FUTHERO | X2 | FUTSAL 🔥",
        maxplayers: 8,
        roompassword: "0102030405",
        hidden: false,
      });

      await botInstance.setFootballMode();

      console.log("🟢 Room successfully created!");

      setInterval(() => {
        const players = botInstance.getAllPlayers(true);

        if (players.length <= 1) {
          const botPlayer = players.find((p: any) => p.id === 0);
          if (botPlayer) {
            const newTeam =
              botPlayer.team === JoinTeam.RED ? JoinTeam.BLUE : JoinTeam.RED;

            botInstance.joinTeam(newTeam);

            botInstance.chat(
              `🔄 Nenhum jogador entrou após 20 minutos. O bot foi movido para o time ${newTeam === JoinTeam.RED ? "vermelho" : "azul"
              } para manter a sala ativa.`
            );
          }
        }
      }, 1_200_000); // 20 minutos
    } catch (err) {
      console.error("❌ Erro ao conectar ou criar sala:", err);
    }
  });
}
