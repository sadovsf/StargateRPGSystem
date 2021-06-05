import { SGRPG } from "./module/config.js";
import SGItemSheet from "./module/sheets/itemSheet.js";
import SGActorSheet from "./module/sheets/actorSheet.js";
import D20Roll from "./module/d20-roll.js";

import * as chat from "./module/chat.js"
import * as macros from "./module/macros.js"

Hooks.once("init", function(){
    console.log("Initializing StarGate systems");
    CONFIG.SGRPG = SGRPG;

    game.sgrpg = {
        config: SGRPG,
        rollItemMacro: macros.rollItemMacro
    };

    CONFIG.Dice.D20Roll = D20Roll;
    CONFIG.Dice.rolls.push(D20Roll);

    Items.unregisterSheet("core", ItemSheet);
    Items.registerSheet("stargate_rpg_system", SGItemSheet, {makeDefault: true});

    Actors.unregisterSheet("core", ActorSheet);
    Actors.registerSheet("stargate_rpg_system", SGActorSheet, {makeDefault: true});
});

Hooks.once("ready", function() {
    console.log("Registering StarGate systems");

    // Wait to register hotbar drop hook on ready so that modules could register earlier if they want to
    Hooks.on("hotbarDrop", (bar, data, slot) => macros.createSgMacro(data, slot));
});

Hooks.on("renderChatMessage", (app, html, data) => {
    // Highlight critical success or failure die
    chat.highlightCriticalSuccessFailure(app, html, data);
});