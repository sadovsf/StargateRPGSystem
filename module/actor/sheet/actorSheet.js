import ActorSheetFlags from "../../apps/actor-flags.js";

export default class SGActorSheet extends ActorSheet {
    /** @override */
    static get defaultOptions() {
        return mergeObject(super.defaultOptions, {
            width: 875,
            height: 900,
            tabs: [{ navSelector: ".tabs", contentSelector: ".sg-sheet-body", initial: "character" }]
        });

        // https://foundryvtt.wiki/en/development/guides/SD-tutorial/SD07-Extending-the-ActorSheet-class
    }

    get template() {
        return `systems/sgrpg/templates/sheets/${this.actor.data.type}-sheet.hbs`;
    }


    /**
     * Prepare Character type specific data
     */
    _prepareCharacterData(actorData) {
        const data = actorData.data;

        // Loop through ability scores, and add their modifiers to our sheet output.
        for (let [key, ability] of Object.entries(data.attributes)) {
            // Calculate the modifier using d20 rules.
            ability.mod = Math.floor((ability.value - 10) / 2);
        }
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
            isGM: game.user.isGM,
            isVehicle: this.actor.type === 'vehicle',
            rollData: this.actor.getRollData.bind(this.actor),
        };

        // The Actor's data
        const actorData = this.actor.data.toObject(false);
        data.actor = actorData;
        data.data = actorData.data;
        data.data.tensionDie = game.sgrpg.getTensionDie();

        data.items = actorData.items;
        for (let iData of data.items) {
            const item = this.actor.items.get(iData._id);
            iData.hasAmmo = item.consumesAmmunition;
            iData.labels = item.labels;
        }
        data.items.sort((a, b) => (a.sort || 0) - (b.sort || 0));
        this._prepareItemData(data);
        this._prepare_proficient_skills(data);

        data.death_success1 = data.data.deathSaves.sucesses > 0;
        data.death_success2 = data.data.deathSaves.sucesses > 1;
        data.death_success3 = data.data.deathSaves.sucesses > 2;

        data.death_failure1 = data.data.deathSaves.fails > 0;
        data.death_failure2 = data.data.deathSaves.fails > 1;
        data.death_failure3 = data.data.deathSaves.fails > 2;

        data.tensionDie = game.sgrpg.getTensionDie();

        data.config = mergeObject(CONFIG.SGRPG, {
            conditions: {
                normal: "Normal",
                disadvabilitychecks: "Disadv ability checks",
                speedhalved: "Speed halved",
                disadvattackssaves: "Disadv attacks, saves",
                hpmaxhalved: "HP max halved",
                speedzero: "Speed zero",
                death: "Death"
            },
            saves: CONFIG.SGRPG.abilities
        });

        return data;
    }

    /**
     * Activate event listeners using the prepared sheet HTML
     * @param html {jQuery}   The prepared HTML object ready to be rendered into the DOM
     */
    activateListeners(html) {
        super.activateListeners(html);
        if (!this.isEditable) return;

        // Rollable skill checks
        html.find('a.txt-btn[type="roll"]').click(event => this._onRollCheck(event));
        html.find('a.txt-btn[type="roll_deathsave"]').click(event => this._onRollDeathSave(event));
        html.find('a.txt-btn[type="roll_init"]').click(event => this._roll_initiative(event));
        html.find('a.txt-btn[type="roll_moxie"]').click(event => this._roll_moxie(event));
        html.find('a.txt-btn[type="reset_deathsave"]').click(event => this._reset_deathsave(event));
        html.find('a[type="roll_attack"]').click(event => this._roll_attack(event));

        html.find('input[data_type="ability_value"]').change(this._onChangeAbilityValue.bind(this));
        html.find('input[data_type="skill_prof"]').click(event => this._onToggleSkillProficiency(event));
        html.find('input[name="data.prof"]').change(event => this._onProfChanged(event));
        html.find('select[data_type="skill_mod"]').change(event => this._onChangeSkillMod(event));
        html.find('a.skill-mod-revert').click(event => this._onSkillRestoreDefaultModClicked(event));

        html.find('.item-consume').click(event => this._onItemConsume(event));
        html.find('.item-edit').click(event => this._onItemEdit(event));
        html.find('.item-delete').click(event => this._onItemDelete(event));
        html.find('.item-roll').click(event => this._onItemRoll(event));
        html.find('.item-reload').click(event => this._onItemReload(event));

        html.find('a.config-button').click(this._onConfigMenu.bind(this));

        html.find(".death-save-checkbox").change(event => this._onDeathSaveCheckboxChanged(event));
    }

    async _onSkillRestoreDefaultModClicked(event) {
        const skillName = event.currentTarget.parentElement.parentElement.dataset.skill;

        const defaultValues = game.system.model.Actor[this.actor.type];
        const defaultSkillMod = defaultValues.skills[skillName].mod;

        await this.actor.update({ [`data.skills.${skillName}.mod`]: defaultSkillMod }, { render: false });

        return this.actor.update(this._compileSkillValues());
    }

    /** @override */
    async _onDropItemCreate(itemData) {
        // if ( itemData.data ) {
        //     // Ignore certain statuses
        //     ["equipped", "proficient", "prepared"].forEach(k => delete itemData.data[k]);
        // }

        // Stack identical equipment
        if (itemData.type === "equip" && itemData.flags.core?.sourceId) {
            const similarItem = this.actor.items.find(i => {
                const sourceId = i.getFlag("core", "sourceId");
                return sourceId && (sourceId === itemData.flags.core?.sourceId) && (i.type === "equip");
            });
            if (similarItem) {
                return similarItem.update({
                    'data.quantity': similarItem.data.data.quantity + Math.max(itemData.data.quantity, 1)
                });
            }
        }

        // Create the owned item as normal
        return super._onDropItemCreate(itemData);
    }

    _prepareItemData(data) {
        let inventory = {
            weapon: [],
            equip: []
        };

        let curBulk = 0;
        for (const item of data.items) {
            if (!Object.keys(inventory).includes(item.type)) {
                console.error("Unknown item type!");
                continue;
            }

            item.isStack = Number.isNumeric(item.data.quantity) && (item.data.quantity !== 1);

            // Calculate item bulk.
            const itemBulk = item.data.bulk || 0;
            const itemCount = (item.isStack ? item.data.quantity : 1);
            curBulk += itemBulk * itemCount;
            if (item.type == "weapon" && item.data.ammo) {
                const ammoBulk = item.data.ammo.bulk;
                const ammoCount = item.data.ammo.value;
                curBulk += ammoBulk * ammoCount;
            }

            // Add item into proper inventory.
            inventory[item.type].push(item);
        }
        curBulk = Math.ceil(curBulk);

        const maxBulk = data.data.bulk + parseInt(data.data.attributes.str.mod);

        data.items = inventory;
        data.currentBulk = curBulk;
        data.currentBulkPerc = Math.min((curBulk / maxBulk) * 100, 100);
        data.isOverloaded = curBulk > maxBulk;
        data.maxBulk = maxBulk;
    }


    _prepare_proficient_skills(data) {
        data.proficient_skills = {};
        for (const skill_id in data.data.skills) {
            const skill = data.data.skills[skill_id];
            if (skill.proficient) {
                data.proficient_skills[skill_id] = foundry.utils.deepClone(skill);
            }
        }
    }

    async _onChangeAbilityValue(event) {
        event.preventDefault();
        const newAttrVal = parseInt(event.currentTarget.value);
        const attrName = event.currentTarget.parentElement.dataset.attr;

        await this.actor.update({
            [`data.attributes.${attrName}.mod`]: this._calculateAttributeMod(newAttrVal),
            [`data.attributes.${attrName}.value`]: newAttrVal
        }, { render: false });

        return this.actor.update(this._compileSkillValues());
    }

    async _onProfChanged(event) {
        event.preventDefault();
        const newProf = parseInt(event.currentTarget.value);

        await this.actor.update({
            "data.prof": newProf
        }, { render: false });

        return this.actor.update(this._compileSkillValues());
    }

    async _onToggleSkillProficiency(event) {
        event.preventDefault();
        const cb = event.currentTarget;

        await this.actor.update({ [cb.name]: cb.checked == true });
        return this.actor.update(this._compileSkillValues());
    }

    async _onChangeSkillMod(event) {
        event.preventDefault();
        const select = event.currentTarget;

        await this.actor.update({ [select.name]: select.value });
        return this.actor.update(this._compileSkillValues());
    }

    _compileSkillValues() {
        const actorData = this.getData();
        const skillList = getProperty(actorData, "data.skills");
        const savesList = getProperty(actorData, "data.saves");
        const currentProfValue = parseInt(getProperty(actorData, "data.prof"));

        let modify = {};
        for (const skillName in skillList) {
            const skill = skillList[skillName]
            const skillModName = getProperty(actorData, `data.skills.${skillName}.mod`);
            let baseVal = parseInt(getProperty(actorData, `data.attributes.${skillModName}.mod`));
            if (skill.proficient) {
                baseVal += currentProfValue;
            }
            modify[`data.skills.${skillName}.value`] = baseVal < 0 ? baseVal.toString() : "+" + baseVal;
        }

        for (const saveName in savesList) {
            const save = savesList[saveName]
            const saveModName = getProperty(actorData, `data.saves.${saveName}.mod`);
            let baseVal = parseInt(getProperty(actorData, `data.attributes.${saveModName}.mod`));
            if (save.proficient) {
                baseVal += currentProfValue;
            }
            modify[`data.saves.${saveName}.value`] = baseVal < 0 ? baseVal.toString() : "+" + baseVal;
        }


        return modify;
    }

    /**
     * Handle editing an existing Owned Item for the Actor
     * @param {Event} event   The originating click event
     * @private
     */
    _onItemEdit(event) {
        event.preventDefault();
        const div = event.currentTarget.parentElement.parentElement;
        const item = this.actor.items.get(div.dataset.itemId);
        return item.sheet.render(true);
    }

    _onItemConsume(event) {
        event.preventDefault();
        const div = event.currentTarget.parentElement.parentElement;
        const item = this.actor.items.get(div.dataset.itemId);
        return item.consume();
    }

    async _onItemReload(event) {
        event.preventDefault();
        const div = event.currentTarget.parentElement.parentElement;
        const item = this.actor.items.get(div.dataset.itemId);

        if (item.data.data.ammo.value == item.data.data.ammo.max) {
            return ui.notifications.info("Weapon is already reloaded.");
        }

        const ammoItem = item.findAmmunition();
        if (!ammoItem) {
            if (item.data.data.ammo.target == CONFIG.SGRPG.actionReloadValue) {
                // Weapon has no magazine, allow free reload.
                return item.update({ "data.ammo.value": item.data.data.ammo.max });
            }
            return ui.notifications.info(`Unable to find magazine to reload '${item.name}'.`);
        }

        const magCount = ammoItem.data.data.quantity || 0;
        if (magCount <= 0) {
            return ui.notifications.info(`No more magazines left for '${item.name}' in inventory.`);
        }

        await ammoItem.update({
            "data.quantity": magCount - 1
        }, { render: false });

        return item.update({ "data.ammo.value": item.data.data.ammo.max });
    }

    /* -------------------------------------------- */

    /**
     * Handle deleting an existing Owned Item for the Actor
     * @param {Event} event   The originating click event
     * @private
     */
    _onItemDelete(event) {
        event.preventDefault();
        const div = event.currentTarget.parentElement.parentElement;
        const item = this.actor.items.get(div.dataset.itemId);

        if (confirm(`Do you really want to delete '${item.name}' from inventory?`) !== true) {
            return;
        }

        if (item) return item.delete();
    }

    _onItemRoll(event) {
        event.preventDefault();
        const div = event.currentTarget.parentElement.parentElement;
        const item = this.actor.items.get(div.dataset.itemId);
        if (item) return item.roll()
    }

    /**
     * Handle toggling Ability score proficiency level
     * @param {Event} event     The originating click event
     * @private
     */
    async _onRollCheck(event) {
        event.preventDefault();

        let actorData = this.getData();
        let bonusDataPath = event.currentTarget.dataset.bonus;

        let rollData = parseInt(getProperty(actorData, bonusDataPath));
        if (rollData >= 0) {
            // Make sure there is always sign.
            rollData = "+" + rollData;
        }


        let r = new CONFIG.Dice.D20Roll("1d20 @prof", { prof: rollData });
        const configured = await r.configureDialog({
            title: `Roll check for ${event.currentTarget.innerText}`,
            defaultRollMode: "normal"
        });
        if (configured === null) {
            return;
        }

        // Print roll to console.
        r.toMessage({
            speaker: ChatMessage.getSpeaker({ actor: this.actor }),
            flavor: event.currentTarget.innerText
        });
    }

    _onRollDeathSave(event) {
        event.preventDefault();

        let r = new Roll("1d20");
        r.evaluate();
        const rollResult = r.total;

        const data = this.actor.data.data.deathSaves;
        const curSucess = parseInt(data.sucesses);
        const curFails = parseInt(data.fails);
        const curHealth = parseInt(this.actor.data.data.health.value);

        if (rollResult == 1) {
            // 2 fails.
            if (curHealth == 0 && curFails >= 1) {
                this.actor.update({
                    "data.deathSaves.fails": curFails + 2,
                    "data.condition": "death"
                });
            } else {
                this.actor.update({ ["data.deathSaves.fails"]: curFails + 2 });
            }
        }
        else if (rollResult == 20) {
            // sucess + heal.
            const maxHealth = parseInt(this.actor.data.data.health.max);
            this.actor.update({
                "data.deathSaves.fails": 0,
                "data.deathSaves.sucesses": 0,
                "data.health.value": curHealth + 1 <= maxHealth ? curHealth + 1 : curHealth
            });
        }
        else if (rollResult >= 10) {
            // sucess.
            if (curSucess >= 2) {
                this.actor.update({
                    "data.deathSaves.fails": 0,
                    "data.deathSaves.sucesses": 0
                });
            }
            else {
                this.actor.update({ [`data.deathSaves.sucesses`]: curSucess + 1 });
            }
        }
        else {
            // fail.
            if (curHealth == 0 && curFails >= 2) {
                this.actor.update({
                    "data.deathSaves.fails": curFails + 1,
                    "data.condition": "death"
                });
            } else {
                this.actor.update({ ["data.deathSaves.fails"]: curFails + 1 });
            }
        }

        r.toMessage({
            speaker: ChatMessage.getSpeaker({ actor: this.actor }),
            flavor: "Death save"
        });
    }

    _reset_deathsave(event) {
        event.preventDefault();
        return this.actor.update({
            "data.deathSaves.fails": 0,
            "data.deathSaves.sucesses": 0
        });
    }

    _roll_initiative(event) {
        return this.actor.rollInitiative({ createCombatants: true });
    }

    _roll_moxie(event) {
        return ui.notifications.warn("Moxie combat is not implemented, please use different way");
    }

    /**
     * Handle spawning the TraitSelector application which allows a checkbox of multiple trait options
     * @param {Event} event   The click event which originated the selection
     * @private
     */
    _onConfigMenu(event) {
        event.preventDefault();
        const button = event.currentTarget;
        let app;
        console.log(button.dataset.action)
        switch (button.dataset.action) {
            case "flags":
                app = new ActorSheetFlags(this.object);
                break;
        }
        app?.render(true);
    }

    _onDeathSaveCheckboxChanged(event) {
        event.preventDefault();

        const isSucess = event.currentTarget.classList.contains("sucess");
        const chbs = $(event.currentTarget.parentElement).find('input[type="checkbox"]');

        let val = 0;
        chbs.each((i, cb) => {
            if (cb.checked) val++;
        });

        if (isSucess) {
            return this.actor.update({ "data.deathSaves.sucesses": val });
        }
        else {
            return this.actor.update({ "data.deathSaves.fails": val });
        }
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