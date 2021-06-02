export default class SGItemSheet extends ItemSheet {
    get template() {
        return `systems/stargate_rpg_system/templates/sheets/${this.item.data.type}-sheet.hbs`;
    }

    getData(options) {
        const data = super.getData(options);
        const itemData = data.data;

        // Re-define the template data references (backwards compatible)
        data.item = itemData;
        data.data = itemData.data;
        return data;
      }
}