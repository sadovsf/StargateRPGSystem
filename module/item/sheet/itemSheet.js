export default class SGItemSheet extends ItemSheet {
    static get defaultOptions() {
        return mergeObject(super.defaultOptions, {
          classes: ["sheet", "item", "itemsheet"],
          width: 520,
          height: 480,
          tabs: [{ navSelector: ".sheet-tabs", contentSelector: ".sheet-body", initial: "description" }]
        });
      }

    get template() {
        return `systems/stargate_rpg_system/templates/sheets/${this.item.data.type}-sheet.hbs`;
    }

    getData(options) {
        let isOwner = this.item.isOwner;
        const data = {
          owner: isOwner,
          limited: this.item.limited,
          options: this.options,
          editable: this.isEditable,
          cssClass: isOwner ? "editable" : "locked",
          rollData: this.item.getRollData.bind(this.item),
          config: CONFIG.SGRPG
        };

        // The Actor's data
        const itemData = this.item.data.toObject(false);
        data.item = itemData;
        data.data = itemData.data;

        return data;
    }
}