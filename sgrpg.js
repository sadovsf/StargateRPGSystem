import { SGRPG } from "./module/config.js";
import SGItemSheet from "./module/sheets/itemSheet.js";
import SGActorSheet from "./module/sheets/actorSheet.js";
import D20Roll from "./module/d20-roll.js";
import * as chat from "./module/chat.js"

Hooks.once("init", function(){
    console.log("Initializing StarGate systems");
    CONFIG.SGRPG = SGRPG;

    CONFIG.Dice.D20Roll = D20Roll;
    CONFIG.Dice.rolls.push(D20Roll);

    Items.unregisterSheet("core", ItemSheet);
    Items.registerSheet("stargate_rpg_system", SGItemSheet, {makeDefault: true});

    Actors.unregisterSheet("core", ActorSheet);
    Actors.registerSheet("stargate_rpg_system", SGActorSheet, {makeDefault: true});
});

Hooks.on("renderChatMessage", (app, html, data) => {

    // Highlight critical success or failure die
    chat.highlightCriticalSuccessFailure(app, html, data);
  });