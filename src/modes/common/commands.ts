export function getGeneralHelpMessage(): string {
  return '!help !ping !queue !r (!ready) !reset !cancel';
}

export function getDiscordLink(): string | undefined {
  return process.env.DISCORD_SERVER_LINK;
}
