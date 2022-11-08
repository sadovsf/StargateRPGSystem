import AbilityTemplate from "../pixi/ability-template.js";


export default class ItemSg extends Item {

    /* -------------------------------------------- */
    /* Overrides                                    */
    /* -------------------------------------------- */

    /** @inheritdoc */
    getRollData() {
        let rollData = super.getRollData();

        // Set the Tension Die from the scene, and if necessary, from the campaign
        // Multiple different ways of writing to cover spelling errors
        const tensionDie = game.sgrpg.getTensionDie();
        rollData.tensionDie = tensionDie;
        rollData.tensionDice = tensionDie;
        rollData.TD = tensionDie;
        rollData.td = tensionDie;
        rollData.tD = tensionDie;

        return rollData;
    }

    /** @override
     * Augment the basic Item data model with additional dynamic data.
     */
    prepareDerivedData() {
        // Get the Item's data
        const itemData = this.data;
        const actorData = this.actor ? this.actor.data : {};

        // Bulk calculation
        const data = itemData.data;
        data.bulkTotal = 0;
        if (data.bulk) {
            data.bulkTotal = data.bulk * data.quantity;
        }
        if (data.quantity !== 1) data.isStack = true;

        if (itemData.type === 'weapon') this._processWeapon(itemData);
    }

    /**
     * Process weapon data
     */
    _processWeapon(itemData) {
        const data = itemData.data;

        // Check to see if there's a proper number in the ammo field
        data.hasAmmo = Number.isInteger(data.ammo.value) && Number.isInteger(data.ammo.max);
        if (data.hasAmmo) {
            // Maximum automatic fire the weapon can take
            if (data.autoAttack.ammoCost !== 0) {
                data.autoAttack.maxAutoCount = data.autoAttack.able ? Math.floor(data.ammo.value / data.autoAttack.ammoCost) : null;
            } else {
                data.autoAttack.maxAutoCount = null;
            }

            // Only consider the ammo bulk calculation if ammo and bulk are set, and either nothing is set as the ammo item, or the item is explicitly set as ammo-item-free with only an action
            if (data.ammo.bulk && (!data.ammo.target || data.ammo.target === CONFIG.SGRPG.actionReloadValue)) {
                // Use the ammo numbers to figure out the total bulk of the carried ammo
                let ammoBulk = Math.ceil((data.ammo.bulk * (data.ammo.value / data.ammo.max)) + ((data.ammo.extraMags ?? -1) > 0 ? (data.ammo.bulk * data.ammo.extraMags) : 0));
                if (ammoBulk < 0) ammoBulk = 0; // Clamp the ammo bulk to non-negatives
                data.bulkTotal = (data.bulk + ammoBulk) * data.quantity; // Use the weapon and ammo bulk together as the bulk of a single weapon, then multiply by quantity
            }
        }

        // To-hit bonus
        data.toHit = data.toHitBonus + (this.actor?.data?.data?.attributes ? this.actor.data.data.attributes[data.attackAbility].mod + (data.isProficient ? this.actor.data.data.proficiencyLevel : 0) : 0);
    }

    /** @override
     * Add visual data for sheet use to items after everything else has been processed
     */
    prepareVisualData() {
        const itemData = this.data;

        if (itemData.type === 'armor') this._processArmorVisuals(itemData);
        if (itemData.type === 'weapon') this._processWeaponVisuals(itemData);
    }

    /**
     * Process armor data for visuals
     */
    _processArmorVisuals(itemData) {
        const data = itemData.data;

        // Visual AC modifier
        data.visualAC = data.additive ? (data.acBonus >= 0 ? "+" + data.acBonus.toString() : data.acBonus.toString()) : data.acBonus.toString();
    }

    /**
     * Process weapon data for visuals
     */
    _processWeaponVisuals(itemData) {
        const data = itemData.data;

        // Formulate the visual shown for the weapon's magazines on the character sheet, either showing the ammo and the extra mags, ammo and the extra weapons, or just simple ammo
        if (data.hasAmmo) {
            if (this.actor?.data && this.consumesAmmunition) {
                const ammoItem = this.findAmmunition();
                if (ammoItem?.data)
                    data.visualAmmo = data.ammo.value.toFixed(0) + " /" + ammoItem.data.data.quantity.toFixed(0) + "mag";
                else {
                    data.visualAmmo = data.ammo.value.toFixed(0);
                    console.error("Somehow, the ammo item was received but turned up null: " + ammoItem);
                }
            }
            else if ((data.ammo.extraMags ?? -2) >= 0)
                data.visualAmmo = data.ammo.value.toFixed(0) + " /" + data.ammo.extraMags.toFixed(0) + "mag";
            else if ((data.ammo.extraMags ?? -2) === -1 && data.quantity > 1)
                data.visualAmmo = data.ammo.value.toFixed(0) + " + " + (data.quantity - 1).toFixed(0) + "pcs";
            else
                data.visualAmmo = data.ammo.value.toFixed(0);
        } else { data.visualAmmo = ""; }

        // Visual to-hit bonus
        data.visualToHit = data.toHit >= 0 ? "+" + data.toHit.toString() : data.toHit.toString();
    }

    /* -------------------------------------------- */
    /* Getters                                      */
    /* -------------------------------------------- */

    /**
     * Does the Item have an area of effect target
     * @type {boolean}
     */
    get hasAreaTarget() {
        const target = this.data.data.target;
        return target && (target.type in CONFIG.SGRPG.areaTargetTypes);
    }

    /**
     * Does the Item implement an attack roll as part of its usage
     * @type {boolean}
     */
    get hasAttack() {
        return typeof this.data.data.attackAbility === "string";
    }

    /**
     * Whether the weapon has a separate ammo item it consumes
     */
    get consumesAmmunition() {
        if (!this.data.data.ammo) {
            return false;
        }
        if (this.data.data.ammo.target === CONFIG.SGRPG.actionReloadValue) {
            return false;
        }
        return this.data.data.ammo.target && Number.isNumeric(this.data.data.ammo.max);
    }

    /* -------------------------------------------- */
    /* Item Use Functions                           */
    /* -------------------------------------------- */

    async roll() {
        if (this.type === "equip" && this.actor && this.data.data.isLightItem) {
            this.actor.changeLightSource(this);
        } else {
            this.displayCard();
        }
    }

    async rollAttack({ mode = "single", fullAutoAttack = 0, fullAutoDamage = 0 } = {}) {
        const weaponTensionHomebrew = game.settings.get("sgrpg", "allowWeaponTensionOnAttack") || false
        const data = this.data.data;
        const td = game.sgrpg.getTensionDie();

        if (!this.actor) {
            return ui.notifications.warn("You can only roll for owned items!");
        }
        if (this.type !== "weapon") {
            return console.error("Weapon attack roll attempted on a non-weapon item: " + this.name);
        }

        if (data.hasAmmo && parseInt(data.ammo.value) === 0) {
            // Item is using ammo but no ammunition is left.
            return ui.notifications.warn("No more ammo for this item!");
        }

        const fullAutoCount = (fullAutoAttack + fullAutoDamage) || 0;
        const abilityMod = this.actor?.data.data.attributes?.[data.attackAbility].mod ?? 0;
        const isProf = data.isProficient;
        // If fired on full auto, check whether the weapon is stabilized, if not, set disadvantage as default
        const disadvDefault = mode === "fullAuto" ? (data.autoAttack.stabilized ? false : true) : false;
        let ammoCost = 0, atkSnd = "", flavorAdd = "";

        let rollMacro = "1d20 + " + data.toHitBonus;
        if (parseInt(abilityMod) !== 0) {
            rollMacro += " + " + abilityMod;
        }
        if (isProf) {
            rollMacro += " + " + (this.actor?.data.data.proficiencyLevel ?? 0);
        }
        const weaponData = {
            weaponRoll: true,
            rangeDefault: "",
            weaponRange: data.range
        };

        switch (mode) {
            case "single":
                ammoCost = 1;
                atkSnd = data.atkSnd;
                break;
            case "burst":
                if (weaponTensionHomebrew) {
                    weaponData.canAddTension = true;
                    weaponData.tensionDefault = "no";
                }
                ammoCost = data.burstAttack.ammoCost;
                atkSnd = data.burstAttack.atkSnd;
                flavorAdd = " with burst";
                break;
            case "fullAuto":
                if (weaponTensionHomebrew)
                    rollMacro += " + " + fullAutoAttack.toFixed(0) + td;
                ammoCost = data.autoAttack.ammoCost * fullAutoCount;
                atkSnd = data.autoAttack.atkSnd;
                flavorAdd = " in full auto";
                break;
        }


        const r = new CONFIG.Dice.D20Roll(rollMacro, this.actor.data.data);
        const configured = await r.configureDialog({
            title: `Attack by ${this.data.name}`,
            defaultRollMode: game.settings.get("core", "rollMode"),
            defaultAction: disadvDefault ? CONFIG.Dice.D20Roll.ADV_MODE.DISADVANTAGE : CONFIG.Dice.D20Roll.ADV_MODE.NORMAL,
            weaponData
        });
        if (configured === null) {
            return;
        }

        // If item has some ammunition defined, consume as needed
        if (data.hasAmmo) {
            const remainingAmmo = parseInt(data.ammo.value);
            if (remainingAmmo <= 0) {
                // Double check that ammo count did not change while in dialog.
                return ui.notifications.warn("No more ammo for this item!");
            }
            if (remainingAmmo - ammoCost < 0) {
                return ui.notifications.warn("Not enough ammo for the attack mode!");
            }
            await this.update({ "data.ammo.value": remainingAmmo - ammoCost });
        }

        let messageData = {
            speaker: ChatMessage.getSpeaker({ actor: this.actor }),
            flavor: "Attacks using " + this.data.name + flavorAdd
        };

        if (atkSnd) { // Check if the sound is set, then check if it exists
            const resp = await fetch(atkSnd, { method: 'HEAD' });
            if (resp.ok) {
                messageData.sound = atkSnd;
            } else {
                ui.notifications.warn("Attack sound path for " + this.data.name + " could not be resolved: " + atkSnd);
            }
        }

        return r.toMessage(messageData);
    }

    async rollDamage({ mode = "single", fullAutoDamage = 0 } = {}) {
        const weaponTensionHomebrew = game.settings.get("sgrpg", "allowWeaponTensionOnAttack") || false
        const data = this.data.data;
        const abilityMod = this.actor?.data.data.attributes?.[data.attackAbility].mod ?? 0;
        const td = game.sgrpg.getTensionDie();
        let dmgRoll = data.dmg;

        if (this.type !== "weapon") {
            return console.error("Weapon damage roll attempted on a non-weapon item: " + this.name);
        }

        if (parseInt(abilityMod) !== 0) {
            dmgRoll += " + " + abilityMod;
        }
        const weaponData = {};

        let dmgSnd = "", flavorAdd = "";
        switch (mode) {
            case "single":
                dmgSnd = data.dmgSnd;
                break;
            case "burst":
                if (weaponTensionHomebrew) {
                    weaponData.canAddTension = true;
                    weaponData.tensionDefault = "yes";
                } else {
                    dmgRoll += " + 1" + td;
                }
                dmgSnd = data.burstAttack.dmgSnd;
                flavorAdd = " on burst fire";
                break;
            case "fullAuto":
                dmgSnd = data.autoAttack.dmgSnd;
                dmgRoll += " + " + fullAutoDamage.toFixed(0) + td;
                flavorAdd = " on full auto";
                break;
        }

        const r = new CONFIG.Dice.DamageRoll(dmgRoll, this.actor.data.data);

        const configured = await r.configureDialog({
            title: `Damage from ${this.data.name}`,
            defaultRollMode: game.settings.get("core", "rollMode"),
            weaponData
        });
        if (configured === null) {
            return;
        }

        let messageData = {
            speaker: ChatMessage.getSpeaker({ actor: this.actor }),
            flavor: "Done damage using " + this.data.name + flavorAdd
        };

        if (dmgSnd) { // Check if the sound is set, then check if it exists
            const resp = await fetch(dmgSnd, { method: 'HEAD' });
            if (resp.ok) {
                messageData.sound = dmgSnd;
            } else {
                ui.notifications.warn("Damage sound path for " + this.data.name + " could not be resolved: " + dmgSnd);
            }
        }

        return r.toMessage(messageData);
    }

    async consume() {
        const remainingCount = parseInt(this.data.data.quantity);
        if (remainingCount < 1) {
            return ui.notifications.warn("You dont have any more of these items to consume!");
        }

        await this.update({
            "data.quantity": remainingCount - 1
        });
        return ui.notifications.info(`Item '${this.data.name}' was consumed, ${remainingCount - 1} usages remain.`);
    }

    /**
     * Find the ammo item for this weapon, if any exists
     * @returns {ItemSg}
     */
    findAmmunition() {
        if (!this.consumesAmmunition) {
            return null;
        }
        return this.actor.items.get(this.data.data.ammo.target);
    }

    async reloadWeapon() {
        const item = this;
        const data = item.data.data;

        if (data.ammo.value === data.ammo.max) {
            return ui.notifications.info("Weapon is already reloaded.");
        }

        const ammoItem = item.findAmmunition();
        if (!ammoItem) {
            // If no ammo item is found, check if the target matches the standard action reload value or is empty for a reload that doesn't consume separate items
            if (data.ammo.target === CONFIG.SGRPG.actionReloadValue || data.ammo.target === null) {
                if (data.ammo.extraMags === null || data.ammo.extraMags === undefined || data.ammo.extraMags <= -2) {
                    // Weapon has no magazines set, allow free reloading without consuming anything
                    return item.update({ "data.ammo.value": data.ammo.max });
                } else {
                    if (data.ammo.extraMags === -1) {
                        // If mags are set to negative 1, check if there is an extra weapon, then consume that
                        // In place for single shot weapons, like the common disposable anti-tank launchers
                        if (data.quantity > 1) {
                            ui.notifications.info(`Single shot weapon, reloading by consuming one quantity.`);
                            return item.update({ "data.ammo.value": data.ammo.max, "data.quantity": data.quantity - 1 });
                        } else {
                            return ui.notifications.info(`Single shot weapon, no more remain.`);
                        }
                    }
                    else if (data.ammo.extraMags === 0) {
                        // Weapon has a set number of additional magazines in store
                        return ui.notifications.info(`No extra magazines remaining for '${item.name}'.`);
                    } else {
                        // Decrease the number of mags by one and fill the ammo
                        return item.update({ "data.ammo.value": data.ammo.max, "data.ammo.extraMags": data.ammo.extraMags - 1 });
                    }
                }

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

        return item.update({ "data.ammo.value": data.ammo.max });
    }

    /**
     * Display the chat card for an Item as a Chat Message
     * @param {object} options          Options which configure the display of the item chat card
     * @param {string} rollMode         The message visibility mode to apply to the created card
     * @param {boolean} createMessage   Whether to automatically create a ChatMessage entity (if true), or only return
     *                                  the prepared message data (if false)
     */
    async displayCard({ rollMode, createMessage = true } = {}) {
        // Render the chat card template
        const token = this.actor.token;
        const maxAutoCount = this.type !== 'weapon' ? 0 : (this.data.data.autoAttack.maxAutoCount < this.actor?.data.data.maxAutomaticShots ? this.data.data.autoAttack.maxAutoCount : (this.actor?.data.data.maxAutomaticShots ?? 0));

        const templateData = {
            actor: this.actor?.data,
            tokenId: token?.uuid || null,
            item: this.data,
            data: this.getChatData(),
            hasAttack: this.hasAttack,
            hasAreaTarget: game.user.can("TEMPLATE_CREATE") && this.hasAreaTarget,
            maxAutoCount,
            tensionHomebrew: game.settings.get("sgrpg", "allowWeaponTensionOnAttack") || false
        };
        const html = await renderTemplate("systems/sgrpg/templates/chat/item-card.html", templateData);

        // Create the ChatMessage data object
        const chatData = {
            user: game.user.id,
            type: CONST.CHAT_MESSAGE_TYPES.OTHER,
            content: html,
            flavor: this.data.data.chatFlavor || this.name,
            speaker: ChatMessage.getSpeaker({ actor: this.actor, token }),
            flags: { "core.canPopout": true },
        };

        // Apply the roll mode to adjust message visibility
        ChatMessage.applyRollMode(chatData, rollMode || game.settings.get("core", "rollMode"));

        // Create the Chat Message or return its data
        return createMessage ? ChatMessage.create(chatData) : chatData;
    }

    /**
     * Prepare an object of chat data used to display a card for the Item in the chat log
     * @param {Object} htmlOptions    Options used by the TextEditor.enrichHTML function
     * @return {Object}               An object of chat data to render
     */
    getChatData(htmlOptions = {}) {
        const data = foundry.utils.deepClone(this.data.data);

        // Rich text description
        data.description = TextEditor.enrichHTML(data.description, htmlOptions);
        data.labels = this._getItemLabels(this.data);
        data.showDescription = game.settings.get("sgrpg", "showDescriptionDefault");
        return data;
    }


    static chatListeners(html) {
        html.on('click', '.card-buttons button', this._onChatCardAction.bind(this));
        html.on('click', '.item-name', this._onChatCardToggleContent.bind(this));
        html.on('change', '.full-auto-count', this._onChatCardChangeFullAuto.bind(this));
    }

    /**
     * Handle toggling the visibility of chat card content when the name is clicked
     * @param {Event} event   The originating click event
     * @private
     */
    static _onChatCardToggleContent(event) {
        event.preventDefault();
        const header = event.currentTarget;
        const card = header.closest(".chat-card");
        const content = card.querySelector(".card-content");
        content.style.display = content.style.display === "none" ? "block" : "none";
    }

    static async _onChatCardAction(event) {
        event.preventDefault();

        // Extract card data
        const button = event.currentTarget;
        button.disabled = true;

        const card = button.closest(".chat-card");
        const messageId = card.closest(".message").dataset.messageId;
        const message = game.messages.get(messageId);
        const action = button.dataset.action;
        const mode = button.dataset.mode ?? "single";
        const attackCount = parseInt($(card).find(".autoAttackCount")[0]?.value) || 0;
        const damageCount = parseInt($(card).find(".autoDamageCount")[0]?.value) || 0;

        // Validate permission to proceed with the roll
        //const isTargetted = action === "save";
        if (!( /*isTargetted ||*/ game.user.isGM || message.isAuthor)) return;

        // Recover the actor for the chat card
        const actor = await this._getChatCardActor(card);
        if (!actor) return;

        // Get the Item from stored flag data or by the item ID on the Actor
        /** @type {ItemSg} */
        const item = actor.items.get(card.dataset.itemId);
        if (!item) {
            return ui.notifications.error("No associated item or item no longer exists!")
        }

        // Handle different actions
        switch (action) {
            case "attack":
                await item.rollAttack({ mode, fullAutoAttack: attackCount, fullAutoDamage: damageCount });
                break;
            case "damage":
                await item.rollDamage({ mode, fullAutoDamage: damageCount });
                break;
            case "consume":
                await item.consume(event);
                break
            case "placeTemplate":
                const template = AbilityTemplate.fromItem(item);
                if (template) template.drawPreview();
                break;
        }

        // Re-enable the button
        button.disabled = false;
    }

    static async _onChatCardChangeFullAuto(event) {

        // Extract card data
        const field = event.currentTarget;
        const fieldData = field.parentElement.dataset;

        if (fieldData.useAutoBalance == "false") {
            // If set to not auto-balance, return out
            return;
        }

        const card = field.closest(".chat-card");
        const messageId = card.closest(".message").dataset.messageId;
        const message = game.messages.get(messageId);
        const attackField = $(card).find(".autoAttackCount")[0] ?? null;
        const damageField = $(card).find(".autoDamageCount")[0] ?? null;

        if (!(attackField && damageField)) {
            console.warn("Attempted to change the full-auto count without finding all the fields: " + attackField + " " + damageField);
        }
        let differential = fieldData.maxFullAuto - field.value;

        if (differential < 0) {
            ui.notifications.info("Tried adding too many dice, clamping to maximum.");
            field.value = fieldData.maxFullAuto;
            differential = 0;
        } else if (differential > fieldData.maxFullAuto) {
            ui.notifications.info("Tried to go into negative dice, clamping to zero.");
            field.value = 0;
            differential = fieldData.maxFullAuto;
        }

        if (field.className.includes("autoAttackCount")) {
            damageField.value = differential;
        } else if (field.className.includes("autoDamageCount")) {
            attackField.value = differential;
        }
    }

    /**
     * Get the Array of item properties which are used in the small sidebar of the description tab
     * @return {Array}
     * @private
     */
    _getItemLabels(item) {
        const labels = [];

        if (item.type === "weapon") {
            if (item.data.ammo && item.data.ammo.target) {
                // Items consumes some ammo, push reload action informations if any.
                if (item.data.ammo.reload) {
                    labels.push("Reload: " + item.data.ammo.reload);
                }
            }
            if (item.data.details.special?.length) {
                labels.push(item.data.details.special);
            }

            if (item.data.details.type) {
                labels.push("Damage: " + item.data.details.type);
            }
            if (item.data.details.sec_type) {
                labels.push("Sec.damage: " + item.data.details.sec_type);
            }
        }

        return labels;
    }

    /**
     * Get the Actor which is the author of a chat card
     * @param {HTMLElement} card    The chat card being used
     * @return {Actor|null}         The Actor entity or null
     * @private
     */
    static async _getChatCardActor(card) {

        // Case 1 - a synthetic actor from a Token
        if (card.dataset.tokenId) {
            const token = await fromUuid(card.dataset.tokenId);
            if (!token) return null;
            return token.actor;
        }

        // Case 2 - use Actor ID directory
        const actorId = card.dataset.actorId;
        return game.actors.get(actorId) || null;
    }
}
