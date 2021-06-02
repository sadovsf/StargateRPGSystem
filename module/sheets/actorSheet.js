export default class SGActorSheet extends ItemSheet {
    get template() {
        return `systems/stargate_rpg_system/templates/sheets/${this.item.data.type}-sheet.hbs`;
    }
}