export default class SGActorSheet extends ActorSheet {
    get template() {
        return `systems/stargate_rpg_system/templates/sheets/${this.actor.data.type}-sheet.hbs`;
    }

    getData(options) {
        let isOwner = this.actor.isOwner;
        const data = {
          owner: isOwner,
          limited: this.actor.limited,
          options: this.options,
          editable: this.isEditable,
          cssClass: isOwner ? "editable" : "locked",
          isCharacter: this.actor.type === "character",
          isNPC: this.actor.type === "npc",
          isVehicle: this.actor.type === 'vehicle',
          config: CONFIG.DND5E,
          rollData: this.actor.getRollData.bind(this.actor)
        };

        // The Actor's data
        const actorData = this.actor.data.toObject(false);
        data.actor = actorData;
        data.data = actorData.data;

        data.attributeMods = {};
        for(const attr_name in data.data.attributes) {
            data.attributeMods[attr_name] = this._calculateAttributeMod(data.data.attributes[attr_name]);
        }

        console.log(data);
        return data;
    }

    /**
     * Activate event listeners using the prepared sheet HTML
     * @param html {jQuery}   The prepared HTML object ready to be rendered into the DOM
     */
    activateListeners(html) {
        super.activateListeners(html);
        if ( ! this.isEditable ) return;

        // Rollable skill checks
        html.find('button.txt-btn[type="roll"]').click(event => this._onRollCheck(event));
        //html.find('div.attr input').change(this._onChangeAttrValue.bind(this));
        //html.find('section.skills div input[type="checkbox"]').click(event => this._onToggleAbilityProficiency(event))
    }

    /**
     * Handle toggling Ability score proficiency level
     * @param {Event} event     The originating click event
     * @private
     */
     _onRollCheck(event) {
        let actorData = this.getData();
        let bonusDataPath = event.currentTarget.dataset.bonus;

        const rollData = parseInt(getProperty(actorData, bonusDataPath));
        console.log(bonusDataPath + " = ", rollData);

        let r = new Roll("1d20 + @prof", {prof: rollData});
        // Execute the roll.
        r.evaluate();

        // Print roll to console.
        r.toMessage({
            flavor: event.currentTarget.innerText
        });
    }

    /**
     * Handle input changes to numeric form fields, allowing them to accept delta-typed inputs
     * @param event
     * @private
     */
     _calculateAttributeMod(value) {
        const stat_base = value

        let stat_mod = 0;
        if (stat_base >= 30) stat_mod = "+10";
        else if (stat_base >= 28) stat_mod = "+9";
        else if (stat_base >= 26) stat_mod = "+8";
        else if (stat_base >= 24) stat_mod = "+7";
        else if (stat_base >= 22) stat_mod = "+6";
        else if (stat_base >= 20) stat_mod = "+5";
        else if (stat_base >= 18) stat_mod = "+4";
        else if (stat_base >= 16) stat_mod = "+3";
        else if (stat_base >= 14) stat_mod = "+2";
        else if (stat_base >= 12) stat_mod = "+1";
        else if (stat_base >= 10) stat_mod = "+0";
        else if (stat_base >= 8) stat_mod = "-1";
        else if (stat_base >= 6) stat_mod = "-2";
        else if (stat_base >= 4) stat_mod = "-3";
        else if (stat_base >= 2) stat_mod = "-4";
        else if (stat_base <= 1) stat_mod = "-5";
        else stat_mod = "+0";

        return stat_mod;
    }
}