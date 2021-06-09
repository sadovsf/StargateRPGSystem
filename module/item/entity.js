import AbilityTemplate from "../pixi/ability-template.js";


export default class ItemSg extends Item {

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

    async roll() {
        this.displayCard();
    }

    async rollAttack() {
        const abilityName = this.data.data.attackAbility;
        const hasAmmo = this.data.data.ammo !== null;

        if (! this.actor) {
            return ui.notifications.warn("You can only roll for owned items!");
        }

        if (hasAmmo && parseInt(this.data.data.ammo) == 0) {
            // Item is using ammo but no ammunition is left.
            return ui.notifications.warn("No more ammo for this item!");
        }

        const abilityMod = this.actor.data.data.attributes[abilityName].mod;
        const isProf = this.data.data.isProficient;

        let rollMacro = "1d20 + " + this.data.data.toHit;
        if (abilityMod != 0) {
            rollMacro += " + " + abilityMod;
        }
        if (isProf != 0) {
            rollMacro += " + " + this.actor.data.data.prof;
        }

        const r = new CONFIG.Dice.D20Roll(rollMacro, this.actor.data.data);
        const configured = await r.configureDialog({
            title: `Attack by ${this.data.name}`,
            defaultRollMode: "normal"
        });
        if (configured === null) {
            return;
        }

        // If item has some ammunition defined, consume 1.
        if (hasAmmo) {
            const remainingAmmo = parseInt(this.data.data.ammo);
            if (remainingAmmo <= 0) {
                // Double check that ammo count did not change while in dialog.
                return ui.notifications.warn("No more ammo for this item!");
            }
            await this.update({"data.ammo": remainingAmmo - 1});
        }

        r.toMessage({
            speaker: ChatMessage.getSpeaker({ actor: this.actor }),
            flavor: "Attacks using " + this.data.name
        });
    }

    async rollDamage() {
        const dmgRoll = this.data.data.dmg;
        const r = new CONFIG.Dice.DamageRoll(dmgRoll, this.actor.data.data);

        const configured = await r.configureDialog({
            title: `Damage from ${this.data.name}`,
            defaultRollMode: "normal"
        });
        if (configured === null) {
            return;
        }

        r.toMessage({
            speaker: ChatMessage.getSpeaker({ actor: this.actor }),
            flavor: "Done damage using " + this.data.name
        });
    }

    async consume() {
        const remainingCount = parseInt(this.data.data.quantity);
        if (remainingCount < 1) {
            return ui.notifications.warn("You dont have any more of these items to consume!");
        }

        await this.update({
            "data.quantity": remainingCount - 1
        });
        return ui.notifications.info(`Item '${this.data.name}' was used, ${remainingCount - 1} usages remain.`);
    }

    /**
     * Display the chat card for an Item as a Chat Message
     * @param {object} options          Options which configure the display of the item chat card
     * @param {string} rollMode         The message visibility mode to apply to the created card
     * @param {boolean} createMessage   Whether to automatically create a ChatMessage entity (if true), or only return
     *                                  the prepared message data (if false)
     */
    async displayCard({rollMode, createMessage=true}={}) {
        // Render the chat card template
        const token = this.actor.token;
        const templateData = {
            actor: this.actor,
            tokenId: token?.uuid || null,
            item: this.data,
            data: this.getChatData(),
            hasAttack: this.hasAttack,
            hasAreaTarget: game.user.can("TEMPLATE_CREATE") && this.hasAreaTarget,
        };
        const html = await renderTemplate("systems/sgrpg/templates/chat/item-card.html", templateData);

        // Create the ChatMessage data object
        const chatData = {
            user: game.user._id,
            type: CONST.CHAT_MESSAGE_TYPES.OTHER,
            content: html,
            flavor: this.data.data.chatFlavor || this.name,
            speaker: ChatMessage.getSpeaker({actor: this.actor, token}),
            flags: {"core.canPopout": true}
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
    getChatData(htmlOptions={}) {
        const data = foundry.utils.deepClone(this.data.data);

        // Rich text description
        data.description = TextEditor.enrichHTML(data.description, htmlOptions);
        return data;
    }


    static chatListeners(html) {
        html.on('click', '.card-buttons button', this._onChatCardAction.bind(this));
        html.on('click', '.item-name', this._onChatCardToggleContent.bind(this));
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
        const message =  game.messages.get(messageId);
        const action = button.dataset.action;

        // Validate permission to proceed with the roll
        //const isTargetted = action === "save";
        //if ( !( isTargetted || game.user.isGM || message.isAuthor ) ) return;

        // Recover the actor for the chat card
        const actor = await this._getChatCardActor(card);
        if ( !actor ) return;

        // Get the Item from stored flag data or by the item ID on the Actor
        const item = actor.items.get(card.dataset.itemId);
        if ( !item ) {
            return ui.notifications.error("No associated item or item no longer exists!")
        }
        console.log(item);

        // Handle different actions
        switch ( action ) {
          case "attack":
            await item.rollAttack(event); break;
          case "damage":
            await item.rollDamage({
              critical: event.altKey,
              event: event,
            });
            break;
          case "consume":
              await item.consume(event);
              break
          case "placeTemplate":
            const template = AbilityTemplate.fromItem(item);
            if ( template ) template.drawPreview();
            break;
        }

        // Re-enable the button
        button.disabled = false;
    }

    /**
     * Get the Actor which is the author of a chat card
     * @param {HTMLElement} card    The chat card being used
     * @return {Actor|null}         The Actor entity or null
     * @private
     */
    static async _getChatCardActor(card) {

        // Case 1 - a synthetic actor from a Token
        if ( card.dataset.tokenId ) {
            const token = await fromUuid(card.dataset.tokenId);
            if ( !token ) return null;
            return token.actor;
        }

        // Case 2 - use Actor ID directory
        const actorId = card.dataset.actorId;
        return game.actors.get(actorId) || null;
    }
}