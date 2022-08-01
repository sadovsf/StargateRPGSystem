
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
                hp = data.health.maxBonus + hitDieValue + (hitDieValue / 2 + 1) * (data.level - 1) + data.attributes.con.mod * data.level;
                data.visualData.hitDieLevels = (hitDieValue / 2 + 1) * (data.level - 1);
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
            usedBulk += item.data.data.bulk * item.data.data.quantity;
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
        const tmpMax = parseInt(this.data.data.temp_health.max) || 0;
        const dh = Math.clamped(this.data.data.health.value - (amount - dt), 0, this.data.data.health.max + tmpMax);

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
}