"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getGeneralHelpMessage = getGeneralHelpMessage;
exports.getDiscordLink = getDiscordLink;
function getGeneralHelpMessage() {
    return '!help !ping !queue !r (!ready) !reset !cancel';
}
function getDiscordLink() {
    return process.env.DISCORD_SERVER_LINK;
}
