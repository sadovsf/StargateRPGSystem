import ActorSheetFlags from "../apps/actor-flags.js";

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

    getData(options) {
        const baseData = super.getData();
        baseData.dtypes = ["String", "Number", "Boolean"];

        let sheetData = {};

        // Insert the basics
        sheetData.actor = baseData.data;
        sheetData.items = baseData.items;

        // Insert necessary misc data
        sheetData.options = baseData.options;
        sheetData.cssClass = baseData.cssClass;
        sheetData.editable = baseData.editable;
        sheetData.limited = baseData.limited;
        sheetData.title = baseData.title;
        sheetData.dtypes = baseData.dtypes;

        // Prepare items
        if (this.actor.data.type == 'player') {
            this._prepareCharacterItems(sheetData);
        }
        if (this.actor.data.type == 'npc') {
            this._prepareCharacterItems(sheetData);
        }
        if (this.actor.data.type == 'vehicle') {
            this._prepareVehicleItems(sheetData);
        }

        // Grab the actual template data and effects
        sheetData.data = baseData.data.data;
        sheetData.effects = baseData.effects;

        // Structural sheet stuff
        sheetData.tensionDie = game.sgrpg.getTensionDie();
        sheetData.selectables = {
            proficiencySelects: {
                0: "Untrained",
                1: "Proficient",
                2: "Exceptional"
            }
        };
        sheetData.bulkMeter = {
            currentBulkPerc: Math.min((sheetData.data.bulkUsed / sheetData.data.bulkMax) * 100, 100),
            currentBulk: sheetData.data.bulkUsed,
            maxBulk: sheetData.data.bulkMax,
            isOverloaded: sheetData.data.bulkOverload
        };

        // Configuration data
        sheetData.config = mergeObject(CONFIG.SGRPG, {
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


        return sheetData;
    }

    /**
     * Properly sort items into their respective lists
     */
    _prepareCharacterItems(sheetData) {
        const actorData = sheetData.actor;

        // Initialize containers.
        const gear = [];
        const weapons = [];
        const armors = [];

        // Iterate through items, allocating to containers
        for (let i of sheetData.items) {
            let item = i.data;
            i.img = i.img || DEFAULT_TOKEN;

            // Switch-case to append the item to the proper list
            switch (i.type) {
                case 'item':
                    gear.push(i);
                    break;
                case 'weapon':
                    weapons.push(i);
                    break;
                case 'armor':
                    armors.push(i);
                    break;
                default:
                    gear.push(i);
                    console.warn("Unknown item type in character data, pushed into gear: " + i.name);
                    break;
            }
        }

        // Assign and return
        actorData.gear = gear;
        actorData.weapons = weapons;
        actorData.armors = armors;
    }

    /**
     * Properly sort items into their respective lists, but for vehicles
     */
    _prepareVehicleItems(sheetData) {
        const actorData = sheetData.actor;

        // Initialize containers.
        const gear = [];
        const weapons = [];

        // Iterate through items, allocating to containers
        for (let i of sheetData.items) {
            let item = i.data;
            i.img = i.img || DEFAULT_TOKEN;

            // Switch-case to append the item to the proper list
            switch (i.type) {
                case 'item':
                    gear.push(i);
                    break;
                case 'weapon':
                    weapons.push(i);
                    break;
                default:
                    gear.push(i);
                    break;
            }
        }

        // Assign and return
        actorData.gear = gear;
        actorData.weapons = weapons;
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
        //html.find('a[type="roll_attack"]').click(event => this._roll_attack(event));
        html.find('a.skill-mod-revert').click(event => this._onSkillRestoreDefaultModClicked(event));

        html.find('.item-consume').click(event => this._onItemConsume(event));
        html.find('.item-edit').click(event => this._onItemEdit(event));
        html.find('.item-delete').click(event => this._onItemDelete(event));
        html.find('.item-roll').click(event => this._onItemRoll(event));
        html.find('.item-reload').click(event => this._onItemReload(event));

        html.find('a.config-button').click(this._onConfigMenu.bind(this));

        html.find(".death-save-checkbox").change(event => this._onDeathSaveCheckboxChanged(event));
    }

    /**
     * Handle resetting the skill attribute to default
     */
    async _onSkillRestoreDefaultModClicked(event) {
        const skillName = event.currentTarget.parentElement.parentElement.dataset.skill;

        const defaultValues = game.system.model.Actor[this.actor.type];
        const defaultSkillAttribute = defaultValues.skills[skillName].attribute;

        return this.actor.update({ [`data.skills.${skillName}.attribute`]: defaultSkillAttribute });
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

        // TODO: Call this stuff from item directly, do not handle the process itself in sheet

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
        const curSuccess = parseInt(data.successes);
        const curFails = parseInt(data.fails);
        const curHealth = parseInt(this.actor.data.data.health.value);

        // TODO: Handle stuff in actor, do not process the actual event in sheet

        return;

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
            // success + heal.
            const maxHealth = parseInt(this.actor.data.data.health.max);
            this.actor.update({
                "data.deathSaves.fails": 0,
                "data.deathSaves.successes": 0,
                "data.health.value": curHealth + 1 <= maxHealth ? curHealth + 1 : curHealth
            });
        }
        else if (rollResult >= 10) {
            // success.
            if (curSuccess >= 2) {
                this.actor.update({
                    "data.deathSaves.fails": 0,
                    "data.deathSaves.successes": 0
                });
            }
            else {
                this.actor.update({ [`data.deathSaves.successes`]: curSuccess + 1 });
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
            "data.deathSaves.successes": 0
        });
    }

    _roll_initiative(event) {
        return this.actor.rollInitiative({ createCombatants: true });
    }

    _roll_moxie(event) {
        // TODO: Setting in combat to flip between encounter types
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

        const isSuccess = event.currentTarget.classList.contains("success");
        const checked = event.currentTarget.checked;
        const value = checked ? event.currentTarget.value : event.currentTarget.value - 1;

        if (isSuccess) {
            return this.actor.update({ "data.deathSaves.successes": value });
        }
        else {
            return this.actor.update({ "data.deathSaves.fails": value });
        }
    }
}