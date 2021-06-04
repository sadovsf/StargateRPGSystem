export default class SGActorSheet extends ActorSheet {
    /** @override */
    static get defaultOptions() {
        return mergeObject(super.defaultOptions, {
            width: 875,
            height: 900,
            tabs: [{navSelector: ".tabs", contentSelector: ".sg-sheet-body", initial: "character"}]
        });

        // https://foundryvtt.wiki/en/development/guides/SD-tutorial/SD07-Extending-the-ActorSheet-class

    }

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

        data.config = {
            tensionDice: {
                d4: "d4",
                d6: "d6",
                d8: "d8",
                d10: "d10",
                d12: "d12"
            },
            conditions: {
                normal: "Normal",
                disadvabilitychecks: "Disadv ability checks",
                speedhalved: "Speed halved",
                disadvattackssaves: "Disadv attacks, saves",
                hpmaxhalved: "HP max halved",
                speedzero: "Speed zero",
                death: "Death"
            },
            saves: {
                str: "Strength",
                dex: "Dexterity",
                con: "Constitution",
                int: "Inteligence",
                wis: "Wisdom",
                cha: "Charisma"
            }
        },

        console.log(data.data);
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
        html.find('a.txt-btn[type="roll"]').click(event => this._onRollCheck(event));
        html.find('div.attr input').change(this._onChangeAttrValue.bind(this));
        html.find('section.skills div input[type="checkbox"]').click(event => this._onToggleAbilityProficiency(event))
        html.find('section.saves div input[type="checkbox"]').click(event => this._onToggleAbilityProficiency(event))
        html.find('div.prof div.section input[name="data.prof"]').change(event => this._onProfChanged(event))
    }

    async _onChangeAttrValue(event) {
        event.preventDefault();
        const newAttrVal = parseInt(event.currentTarget.value);
        const attrName = event.currentTarget.parentElement.dataset.attr;

        await this.actor.update({
            [`data.attributes.${attrName}.mod`]: this._calculateAttributeMod(newAttrVal),
            [`data.attributes.${attrName}.value`]: newAttrVal
        }, {render: false});

        return this.actor.update(this._compileSkillValues());
    }

    async _onProfChanged(event) {
        event.preventDefault();
        const newProf = parseInt(event.currentTarget.value);

        await this.actor.update({
            "data.prof": newProf
        }, {render: false});

        return this.actor.update(this._compileSkillValues());
    }

    async _onToggleAbilityProficiency(event) {
        event.preventDefault();
        const cb = event.currentTarget;

        await this.actor.update({[cb.name]: cb.checked == true });
        return this.actor.update(this._compileSkillValues());
    }

    _compileSkillValues() {
        const actorData = this.getData();
        const skillList = getProperty(actorData, "data.skills");
        const savesList = getProperty(actorData, "data.saves");
        const currentProfValue = parseInt(getProperty(actorData, "data.prof"));

        let modify = {};
        for(const skillName in skillList) {
            const skill = skillList[skillName]
            const skillModName = getProperty(actorData, `data.skills.${skillName}.mod`);
            let baseVal = parseInt(getProperty(actorData, `data.attributes.${skillModName}.mod`));
            if (skill.proficient) {
                baseVal += currentProfValue;
            }
            modify[`data.skills.${skillName}.value`] = baseVal < 0 ? baseVal.toString() : "+"+baseVal;
        }

        for(const saveName in savesList) {
            const save = savesList[saveName]
            const saveModName = getProperty(actorData, `data.saves.${saveName}.mod`);
            let baseVal = parseInt(getProperty(actorData, `data.attributes.${saveModName}.mod`));
            if (save.proficient) {
                baseVal += currentProfValue;
            }
            modify[`data.saves.${saveName}.value`] = baseVal < 0 ? baseVal.toString() : "+"+baseVal;
        }


        return modify;
    }

    /**
     * Handle toggling Ability score proficiency level
     * @param {Event} event     The originating click event
     * @private
     */
     _onRollCheck(event) {
        event.preventDefault();

        let actorData = this.getData();
        let bonusDataPath = event.currentTarget.dataset.bonus;

        let rollData = parseInt(getProperty(actorData, bonusDataPath));
        if (rollData >= 0) {
            // Make sure there is always sign.
            rollData = "+" + rollData;
        }

        let r = new Roll("1d20 @prof", {prof: rollData});
        // Execute the roll.
        r.evaluate();

        // Print roll to console.
        r.toMessage({
            speaker: ChatMessage.getSpeaker({ actor: this.actor }),
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