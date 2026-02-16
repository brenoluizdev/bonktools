import { HELP_TEXT } from "../messages";

export default {
  name: "ajuda",
  description: "Mostra os comandos disponíveis",
  execute(bot: any) {
    bot.chat(HELP_TEXT);
  },
};
