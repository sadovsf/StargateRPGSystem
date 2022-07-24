import { SGRPG } from "./module/config.js";

import "./module/scene-config.js";

import "./module/externals.js"; // Setup external module integrations here, so sgrpg.js doesn't need to otherwise care

import ItemSg from "./module/item/item.js"
import ActorSg from "./module/actor/actor.js"

import SGItemSheet from "./module/item/itemSheet.js";
import SGActorSheet from "./module/actor/actorSheet.js";

import D20Roll from "./module/dice/d20-roll.js";
import DamageRoll from "./module/dice/damage-roll.js"

import * as chat from "./module/chat.js"
import * as macros from "./module/macros.js"
import { _getInitiativeFormula } from "./module/combat.js";
import { preloadHandlebarsTemplates, registerHandlebarsHelpersSG } from "./module/templates.js";

Hooks.once("init", function () {
    console.log("Initializing StarGate systems");
    CONFIG.SGRPG = SGRPG;

    game.sgrpg = {
        config: SGRPG,
        rollItemMacro: macros.rollItemMacro,
        getTensionDie
    };

    CONFIG.Item.documentClass = ItemSg;
    CONFIG.Actor.documentClass = ActorSg;

    // 5e cone RAW should be 53.13 degrees
    CONFIG.MeasuredTemplate.defaults.angle = 53.13;

    CONFIG.Dice.D20Roll = D20Roll;
    CONFIG.Dice.DamageRoll = DamageRoll;
    CONFIG.Dice.rolls.push(D20Roll);
    CONFIG.Dice.rolls.push(DamageRoll);

    CONFIG.Combat.initiative.formula = "1d20 + @initiative";
    Combatant.prototype._getInitiativeFormula = _getInitiativeFormula;

    Items.unregisterSheet("core", ItemSheet);
    Items.registerSheet("sgrpg", SGItemSheet, { makeDefault: true });

    Actors.unregisterSheet("core", ActorSheet);
    Actors.registerSheet("sgrpg", SGActorSheet, { makeDefault: true });


    game.settings.register("sgrpg", "campaignTension", {
        name: "Campaign Tension Level",
        hint: "Set the campaign's base Tension level and the Tension Die.",
        scope: "world",
        type: String,
        choices: SGRPG.tensionDice,
        default: SGRPG.defaultTensionDie,
        config: true
    });


    preloadHandlebarsTemplates();
    registerHandlebarsHelpersSG();
});

Hooks.once("ready", function () {
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


/** Returns the current Tension Die, either from the base campaign level, or the currently active scene level if overridden there
 * @returns {string} The current Tension Die
 */
function getTensionDie() {
    // First, try to get the Tension Die of the currently active scene, if that turns out unset, get the Tension Die of the campaign
    return game.scenes.active?.getFlag("sgrpg", "sceneTensionDie") || game.settings.get("sgrpg", "campaignTension");
}