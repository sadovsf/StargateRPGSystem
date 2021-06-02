import SGItemSheet from "./module/sheets/itemSheet.js";
import SGActorSheet from "./module/sheets/actorSheet.js";

Hooks.once("init", function(){
    console.log("Initializing StarGate systems");

    Items.unregisterSheet("core", ItemSheet);
    Items.registerSheet("stargate_rpg_system", SGItemSheet, {makeDefault: true});

    Actors.unregisterSheet("core", ActorSheet);
    Actors.registerSheet("stargate_rpg_system", SGActorSheet, {makeDefault: true});
});