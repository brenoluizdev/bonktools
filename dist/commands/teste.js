"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const joinTeam_types_1 = require("../types/joinTeam.types");
exports.default = {
    name: "teste",
    description: "teste",
    async execute(bot) {
        await bot.ready(true);
        await new Promise(resolve => setTimeout(resolve, 500));
        // await bot.setTeamSettings({ teamCount: 2, locked: false });
        await bot.joinTeam(joinTeam_types_1.JoinTeam.SPEC);
    },
};
