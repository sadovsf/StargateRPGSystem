import ItemSg from "../item/item.js";

export default class ActorSg extends Actor {

    /* -------------------------------------------- */
    /* Overrides                                    */
    /* -------------------------------------------- */

    /** @override
     * Perform any last data modifications after super.prepareData has finished executing
     */
    prepareData() {
        // Performs the following, in order: data reset, prepareBaseData(), prepareEmbeddedDocuments(), prepareDerivedData()
        super.prepareData();
    }

    /** @inheritdoc */
    getRollData() {
        let rollData = super.getRollData();

        // Set the Tension Die from the scene, and if necessary, from the campaign
        const tensionDie = game.sgrpg.getTensionDie();
        rollData.tensionDie = tensionDie;
        rollData.tensionDice = tensionDie;
        rollData.TD = tensionDie;
        rollData.td = tensionDie;
        rollData.tD = tensionDie;

        return rollData;
    }

    /* -------------------------------------------- */
    /* Normal Functions                             */
    /* -------------------------------------------- */

    /** @override
     */
    prepareData() {
        super.prepareData();
        this.prepareEmbeddedVisuals();
    }

    /* -------------------------------------------- */
    /* Process Base                                 */
    /* -------------------------------------------- */

    /** @override
     * Calculate some base necessities from existing data before moving on to derived proper 
     */
    prepareBaseData() {
        const actorData = this.data;
        const data = actorData.data;

        // Common base data for characters
        if (actorData.type === 'player' || actorData.type === 'npc')
            this._processBaseCommon(actorData);

        // Basic visual data container
        data.visualData = {};
    }

    _processBaseCommon(actorData) {
        const data = actorData.data;

        // Proficiency Level
        let prof = 0;
        switch (actorData.type) {
            case 'player':
                prof = 2 + Math.floor((data.level - 1) / 4);
                break;
            case 'npc':
                prof = 2 + Math.floor((data.cr - 1) / 4);
                break;
            default:
                break;
        }
        // Set the proficiency level to the calculated value
        data.proficiencyLevel = prof + data.proficiencyBonus;
        data.proficiencyFromLevel = prof;

        // Basic ability score modifiers
        for (let [key, ability] of Object.entries(data.attributes)) {
            ability.mod = Math.floor((ability.value - 10) / 2);
            ability.modVisual = (ability.mod >= 0 ? "+" : "") + ability.mod.toString();
        }
    }

    /* -------------------------------------------- */
    /* Process Derived                              */
    /* -------------------------------------------- */

    /** @override
     * Augment the basic actor data with additional dynamic data.
     */
    prepareDerivedData() {
        const actorData = this.data;

        // Make separate methods for each Actor type (character, npc, etc.) to keep
        // things organized.
        if (actorData.type === 'player') this._preparePlayerData(actorData);
        if (actorData.type === 'npc') this._prepareNpcData(actorData);
        if (actorData.type === 'vehicle') this._prepareVehicleData(actorData);
    }

    /**
     * Prepare Player type specific data
     */
    _preparePlayerData(actorData) {
        this._processCommon(actorData);
        this._processArmor(actorData);
    }

    /**
     * Prepare NPC type specific data
     */
    _prepareNpcData(actorData) {
        this._processCommon(actorData);
        this._processArmor(actorData);
        this._processNpc(actorData);
    }

    /**
     * Prepare Vehicle type specific data
     */
    _prepareVehicleData(actorData) {
        this._processMinimal(actorData);
    }

    /**
     * Prepare data based on common template
     */
    _processCommon(actorData) {
        const data = actorData.data;

        // Process skills
        for (let [key, skill] of Object.entries(data.skills)) {
            // Calculate the modifier using d20 rules.
            skill.total = data.attributes[skill.attribute].mod + data.proficiencyLevel * skill.proficient;
            skill.totalVisual = (skill.total >= 0 ? "+" : "") + skill.total.toString();
        }

        // Process saves
        for (let [key, save] of Object.entries(data.saves)) {
            // Calculate the modifier using d20 rules.
            save.total = data.attributes[key].mod + data.proficiencyLevel * save.proficient;
            save.totalVisual = (save.total >= 0 ? "+" : "") + save.total.toString();
        }

        // Get max HP
        let hp = 0;
        switch (actorData.type) {
            case 'player':
                let hitDieValue = -1;
                let index = data.hd.trim().search(/d/i); // Search for the letter d in the string
                if (index >= 0) {
                    hitDieValue = parseInt(data.hd.trim().slice(index + 1));
                }
                data.hitDieValue = hitDieValue;
                hp = data.health.maxBonus + (data.health.maxLevelBonus * data.level) + hitDieValue + (hitDieValue / 2 + 1) * (data.level - 1) + data.attributes.con.mod * data.level;
                data.visualData.hitDieLevels = (hitDieValue / 2 + 1) * (data.level - 1);
                data.visualData.hitDieTotal = `${hitDieValue} + ${(hitDieValue / 2 + 1) * (data.level - 1)}`;
                data.visualData.conBonus = data.attributes.con.mod * data.level;
                break;
            default:
                hp = data.health.maxBonus;
                break;
        }
        data.health.max = hp;

        // Get max determination
        data.determination.max = data.proficiencyLevel + data.determination.maxBonus;

        // Initiative and moxie
        data.initiative = (data.attributes.dex.mod > data.attributes.wis.mod ? data.attributes.dex.mod : data.attributes.wis.mod) + data.initiativeBonus;
        data.moxie = (data.attributes.int.mod > data.attributes.cha.mod ? data.attributes.int.mod : data.attributes.cha.mod) + data.moxieBonus;

        data.visualData.initiative = `${(data.attributes.dex.mod > data.attributes.wis.mod ? "Dex" : "Wis")}: ${(data.attributes.dex.mod > data.attributes.wis.mod ? data.attributes.dex.mod : data.attributes.wis.mod)}`;
        data.visualData.moxie = `${(data.attributes.int.mod > data.attributes.cha.mod ? "Int" : "Cha")}: ${(data.attributes.int.mod > data.attributes.cha.mod ? data.attributes.int.mod : data.attributes.cha.mod)}`;

        // Very basic bulk, speed, and AC
        data.bulkMax = data.bulkBonus + data.attributes.str.mod;
        data.speed = data.speedBase;
        data.ac = 10 + data.acBonus + data.attributes.dex.mod;

        // Max automatic shots
        data.maxAutomaticShots = data.attributes.str.mod + data.miscSettings.extraAutoFire;

        // Used bulk
        // Only consider carried items that are not part of the base kit or a worn armor
        const bulkItems = this.items.filter(element => element.data.data.carried && !element.data.data.partOfBaseKit && !element.data.data.worn);
        let usedBulk = 0;
        for (let item of bulkItems) {
            usedBulk += item.data.data.bulkTotal;
        }
        data.bulkUsed = usedBulk;
        data.bulkOverload = usedBulk > data.bulkMax;
    }

    /**
     * Process data for actors with only minimal data
     */
    _processMinimal(actorData) {
        const data = actorData.data;

        // Get max HP
        data.health.max = data.health.maxBonus;

        // Get AC
        data.ac = data.acBonus;

        // Get speed
        data.speed = data.speedBase;

        // Get bulk
        data.bulkMax = data.bulkBonus;

        // Used bulk
        // Only consider carried items that are not part of the base kit
        const bulkItems = this.items.filter(element => element.data.data.carried && !element.data.data.partOfBaseKit);
        let usedBulk = 0;
        for (let item of bulkItems) {
            usedBulk += item.data.data.bulk * item.data.data.quantity;
        }
        data.bulkUsed = usedBulk;
        data.bulkOverload = usedBulk > data.bulkMax;
    }

    /**
     * Process data that's only used for NPC's
     */
    _processNpc(actorData) {
        const data = actorData.data;

        // Get proficient skills
        data.proficientSkills = {};
        for (let [key, skill] of Object.entries(data.skills)) {
            if (skill.proficient > 0) {
                data.proficientSkills[key] = skill;
            }
        }
    }

    /**
     * Process data that has to do with armor
     */
    _processArmor(actorData) {
        const data = actorData.data;

        const wornArmors = this.items.filter(element => element.data.type === 'armor' && element.data.data.carried && element.data.data.worn);
        let baseAC = 0, additiveAC = 0, baseBulk = 0, additiveBulk = 0, heavyArmor = false, overStrength = false;
        for (let armor of wornArmors) {
            const armorData = armor.data.data;
            if (armorData.additive) {
                additiveAC += armorData.acBonus;
                additiveBulk += armorData.bulkBonus;
            } else {
                if (baseAC < armorData.acBonus) {
                    baseAC = armorData.acBonus;
                    baseBulk = armorData.bulkBonus;
                };
            }
            if (armorData.heavyArmor) heavyArmor = true;
            if (armorData.strRequired > data.attributes.str.value) overStrength = true;
        }

        // Set the proper values
        data.bulkMax = baseBulk + additiveBulk + data.bulkBonus + data.attributes.str.mod;
        data.speed = overStrength ? 1 : data.speedBase - (heavyArmor ? 2 : 0);
        data.ac = baseAC + additiveAC + data.acBonus + (heavyArmor ? 0 : data.attributes.dex.mod);
        data.bulkOverload = data.usedBulk > data.bulkMax;

        // Store visual sheet data
        data.visualData.armorAC = baseAC;
        data.visualData.armorAdditional = additiveAC;
        data.visualData.dexBonus = (heavyArmor ? 0 : data.attributes.dex.mod);
        data.visualData.heavyArmor = heavyArmor;
        data.visualData.overStrength = overStrength;
        data.visualData.armorLimitsSpeed = (overStrength ? "Badly" : (heavyArmor ? "Yes" : "No"));

        data.visualData.armorBulk = baseBulk;
        data.visualData.armorBulkPlus = additiveBulk;
    }

    /* -------------------------------------------- */
    /* Process Visuals                              */
    /* -------------------------------------------- */

    prepareEmbeddedVisuals() {
        for (let item of this.items) {
            item.prepareVisualData();
        }
    }

    /* -------------------------------------------- */
    /* Private Functions                            */
    /* -------------------------------------------- */

    /**
     * Update tokens associated with this actor with lighting data
     * @param {any} lightdata Data to use for update
     * @private
     */
    async _updateTokenLighting(lightdata) {
        const actor = this;
        let foundtoken = null;
        if (actor.token) {
            foundtoken = actor.token;
        }
        else {
            let tokenarray = actor.getActiveTokens(true);
            if (tokenarray.length > 0 && tokenarray[0]?.data?.actorLink === true)
                foundtoken = tokenarray[0].document;
        }

        if (foundtoken) {
            await foundtoken.update({ "light": lightdata });
        }

        // Update prototype token, if applicable
        if (!this.isToken) {
            await this.update({
                "token.light": lightdata
            });
        }
    }

    /* -------------------------------------------- */
    /* Data Modification                            */
    /* -------------------------------------------- */

    /**
       * Apply a certain amount of damage or healing to the health pool for Actor
       * @param {number} amount       An amount of damage (positive) or healing (negative) to sustain
       * @param {number} multiplier   A multiplier which allows for resistance, vulnerability, or healing
       * @return {Promise<Actor>}     A Promise which resolves once the damage has been applied
       */
    async applyDamage(amount = 0, multiplier = 1) {
        amount = Math.floor(parseInt(amount) * multiplier);

        // Deduct damage from temp HP first
        const tmp = parseInt(this.data.data.temp_health.value) || 0;
        const dt = amount > 0 ? Math.min(tmp, amount) : 0;

        // Remaining goes to health
        // const tmpMax = parseInt(this.data.data.temp_health.max) || 0;
        const dh = Math.clamped(this.data.data.health.value - (amount - dt), 0, this.data.data.health.max);

        // Update the Actor
        const updates = {
            "data.temp_health.value": tmp - dt,
            "data.health.value": dh
        };

        // Delegate damage application to a hook
        // TODO replace this in the future with a better modifyTokenAttribute function in the core
        const allowed = Hooks.call("modifyTokenAttribute", {
            attribute: "health",
            value: amount,
            isDelta: false,
            isBar: true
        }, updates);
        return allowed !== false ? this.update(updates) : this;
    }

    /**
     * Change which illumination item the actor is using, or turn them all off
     * @param {ItemSg} lightsource
     */
    async changeLightSource(lightsource) {
        if (!lightsource) {
            console.error("Attempted to change a light source without providing light source for actor: " + this);
            return;
        }
        let updatedlightdata = {
            "dim": 0, "bright": 0, "angle": 360, "color": "#ffffff", "alpha": 0.25, "animation": {
                "type": "", "speed": 5, "intensity": 5
            }
        };

        let lightsources = this.items.filter(element => element.type === "equip" && element.data.data.isLightItem);

        if (!lightsource.data.data.lighted) { // Light the light source
            updatedlightdata = {
                "dim": lightsource.data.data.dimLight, "bright": lightsource.data.data.brightLight, "angle": lightsource.data.data.lightAngle,
                "color": lightsource.data.data.lightColor, "alpha": lightsource.data.data.lightAlpha, "animation": {
                    "type": lightsource.data.data.lightAnimationType, "speed": lightsource.data.data.lightAnimationSpeed, "intensity": lightsource.data.data.lightAnimationIntensity
                }
            };
            const index = lightsources.findIndex(element => element.id == lightsource.id);
            if (index > -1)
                lightsources.splice(index, 1); // Exclude from dousing
            await lightsource.update({ "_id": lightsource.id, "data.lighted": true });
        }

        let doused = [];
        for (let l of lightsources) { // Douse all other light sources, including the caller if it was previously lighted
            doused.push({ "_id": l.id, "data.lighted": false });
        }
        await this.updateEmbeddedDocuments("Item", doused);
        await this._updateTokenLighting(updatedlightdata);
    }

    /**
     * Refresh the token light source based on which illumination item is active, if any
     */
    refreshLightSource() {
        let updatedlightdata = {
            "dim": 0, "bright": 0, "angle": 360, "color": "#ffffff", "alpha": 0.25, "animation": {
                "type": "", "speed": 5, "intensity": 5
            }
        };

        let lightsources = this.items.filter(element => element.type === "equip" && element.data.data.isLightItem);
        let activesource = lightsources.find(element => element.data.data.lighted == true);
        if (activesource) {
            updatedlightdata = {
                "dim": lightsource.data.data.dimLight, "bright": lightsource.data.data.brightLight, "angle": lightsource.data.data.lightAngle,
                "color": lightsource.data.data.lightColor, "alpha": lightsource.data.data.lightAlpha, "animation": {
                    "type": lightsource.data.data.lightAnimationType, "speed": lightsource.data.data.lightAnimationSpeed, "intensity": lightsource.data.data.lightAnimationIntensity
                }
            };
        }

        return this._updateTokenLighting(updatedlightdata);
    }

    /**
     * Pop up a dialog to specify which heal, then roll and apply it
     */
    async rollHealing() {
        if (this.type !== "player") {
            return console.error("Tried to rest heal a non-character: " + this.name);
        }

        const data = this.data.data;
        if (data.health.value >= data.health.max) {
            return ui.notifications.info("Already at maximum health!");
        }

        const betterMod = data.attributes.con.mod > data.proficiencyLevel ? data.attributes.con.mod : data.proficiencyLevel;
        const templateData = {
            "actor": this,
            "shortRestHeal": `${data.hd} + ${betterMod}`,
            "longRestHeal": `${data.level}${data.hd} + ${betterMod}`
        };

        const contents = await renderTemplate("systems/sgrpg/templates/popups/healing-popup.html", templateData);
        let resolvedroll = new Promise((resolve) => {
            let confirmed = false;
            let restType = "";
            let dlog = new Dialog({
                title: "Resting Heal",
                content: contents,
                buttons: {
                    one: {
                        icon: '<i class="fas fa-clock"></i>',
                        label: "Short Rest",
                        callback: () => { restType = "Short"; confirmed = true; }
                    },
                    two: {
                        icon: '<i class="fas fa-bed"></i>',
                        label: "Long Rest",
                        callback: () => { restType = "Long"; confirmed = true; }
                    }
                },
                default: "one",
                render: html => { },
                close: html => {
                    resolve({ "confirmed": confirmed, "restType": restType });
                }
            });
            dlog.render(true);
        });
        const results = await resolvedroll;

        if (results.confirmed && results.restType) {
            let r = new Roll(results.restType === "Long" ? templateData.longRestHeal : templateData.shortRestHeal);
            await r.evaluate();
            const rollResult = r.total;
            r.toMessage({
                speaker: ChatMessage.getSpeaker({ actor: this }),
                flavor: results.restType + " Rest Healing"
            });
            this.applyDamage(rollResult, -1); // Negative multiplier, as the function does damage so negative heals the character
        }
    }

    /**
     * Automatically roll and record the result of a death save
     */
    async rollDeathSave() {
        let r = new Roll("1d20");
        await r.evaluate();
        const rollResult = r.total;

        const data = this.data.data.deathSaves;
        const curSuccess = parseInt(data.successes);
        const curFails = parseInt(data.fails);
        const curHealth = parseInt(this.data.data.health.value);

        if (rollResult == 1) {
            // 2 fails.
            if (curHealth == 0 && curFails >= 1) {
                this.update({
                    "data.deathSaves.fails": curFails + 2,
                    "data.condition": "death"
                });
            } else {
                this.update({ ["data.deathSaves.fails"]: curFails + 2 });
            }
        }
        else if (rollResult == 20) {
            // success + heal.
            const maxHealth = parseInt(this.data.data.health.max);
            this.update({
                "data.deathSaves.fails": 0,
                "data.deathSaves.successes": 0,
                "data.health.value": curHealth + 1 <= maxHealth ? curHealth + 1 : curHealth
            });
        }
        else if (rollResult >= 10) {
            // success.
            if (curSuccess >= 2) {
                this.update({
                    "data.deathSaves.fails": 0,
                    "data.deathSaves.successes": 0
                });
            }
            else {
                this.update({ [`data.deathSaves.successes`]: curSuccess + 1 });
            }
        }
        else {
            // fail.
            if (curHealth == 0 && curFails >= 2) {
                this.update({
                    "data.deathSaves.fails": curFails + 1,
                    "data.condition": "death"
                });
            } else {
                this.update({ ["data.deathSaves.fails"]: curFails + 1 });
            }
        }

        return r.toMessage({
            speaker: ChatMessage.getSpeaker({ actor: this }),
            flavor: "Death Save"
        });
    }
}