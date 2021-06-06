import { SGRPG } from "./module/config.js";

import ItemSg from "./module/item/entity.js"
import ActorSg from "./module/actor/entity.js"

import SGItemSheet from "./module/item/sheet/itemSheet.js";
import SGActorSheet from "./module/actor/sheet/actorSheet.js";

import D20Roll from "./module/dice/d20-roll.js";
import DamageRoll from "./module/dice/damage-roll.js"

import * as chat from "./module/chat.js"
import * as macros from "./module/macros.js"
import { _getInitiativeFormula } from "./module/combat.js";
import { preloadHandlebarsTemplates } from "./module/templates.js";

Hooks.once("init", function(){
    console.log("Initializing StarGate systems");
    CONFIG.SGRPG = SGRPG;

    game.sgrpg = {
        config: SGRPG,
        rollItemMacro: macros.rollItemMacro
    };

    CONFIG.Item.documentClass = ItemSg;
    CONFIG.Actor.documentClass = ActorSg;

    CONFIG.Dice.D20Roll = D20Roll;
    CONFIG.Dice.DamageRoll = DamageRoll;
    CONFIG.Dice.rolls.push(D20Roll);
    CONFIG.Dice.rolls.push(DamageRoll);

    CONFIG.Combat.initiative.formula = "1d20 + @initiative";
    Combatant.prototype._getInitiativeFormula = _getInitiativeFormula;

    Items.unregisterSheet("core", ItemSheet);
    Items.registerSheet("sgrpg", SGItemSheet, {makeDefault: true});

    Actors.unregisterSheet("core", ActorSheet);
    Actors.registerSheet("sgrpg", SGActorSheet, {makeDefault: true});


    preloadHandlebarsTemplates()
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
Hooks.on("getChatLogEntryContext", chat.addChatMessageContextOptions);
Hooks.on("renderChatLog", (app, html, data) => ItemSg.chatListeners(html));
Hooks.on("renderChatPopout", (app, html, data) => ItemSg.chatListeners(html));