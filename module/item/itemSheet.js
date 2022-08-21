export default class SGItemSheet extends ItemSheet {
    static get defaultOptions() {
        return mergeObject(super.defaultOptions, {
            classes: ["sheet", "item", "itemsheet"],
            width: 560,
            height: 600,
            tabs: [{ navSelector: ".sheet-tabs", contentSelector: ".sheet-body", initial: "description" }]
        });
    }

    get template() {
        return `systems/sgrpg/templates/sheets/item-sheet.hbs`;
    }

    getData(options) {
        const baseData = super.getData();
        let sheetData = {};

        // Insert the basics
        sheetData.item = baseData.data;
        sheetData.data = baseData.data.data;

        // Insert necessary misc data
        sheetData.options = baseData.options;
        sheetData.cssClass = baseData.cssClass;
        sheetData.editable = baseData.editable;
        sheetData.limited = baseData.limited;
        sheetData.title = baseData.title;
        sheetData.dtypes = baseData.dtypes;
        sheetData.config = CONFIG.SGRPG;

        // Potential consumption targets
        sheetData.abilityConsumptionTargets = this._getItemConsumptionTargets();
        sheetData.lightAnimations = CONFIG.Canvas.lightAnimations;

        return sheetData;
    }


    /**
     * Get the valid item consumption targets which exist on the actor
     * @return {{string: string}}   An object of potential consumption targets
     * @private
     */
    _getItemConsumptionTargets(item) {
        const actor = this.item.actor;
        if (!actor) return {};

        // Ammunition
        return actor.itemTypes.equip.reduce((ammo, i) => {
            ammo[i.id] = `${i.name} (${i.data.data.quantity})`;
            return ammo;
        }, {});
    }
}