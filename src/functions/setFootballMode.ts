export async function setFootballMode(bot: any) {
  const host = bot.getHost();

  if (!host) {
    console.warn("⚠️ Bot não é o host, não pode alterar o modo.");
    return;
  }

 const newSettings = {
    ...(bot.roomSettings || {}),
    mode: 2,   // 2 = Teams
    engine: 5, // 5 = Football
  };

  try {
    await bot.updateRoomSettings(newSettings);
    bot.chat("⚽️ Modo alterado para Football!");
    console.log("✅ Football mode definido com sucesso!");
  } catch (err) {
    console.error("❌ Falha ao alterar modo de jogo:", err);
  }
}
