

/**
 * Override the default Initiative formula to customize special behaviors of the system.
 * Apply advantage, proficiency, or bonuses where appropriate
 * Apply the dexterity score as a decimal tiebreaker if requested
 * See Combat._getInitiativeFormula for more detail.
 */
 export const _getInitiativeFormula = function() {
    const actor = this.actor;
    if ( !actor ) return "1d20";
    const init = actor.data.data.initiative;

    // Construct initiative formula parts
    let nd = 1;
    let mods = "";
    if (actor.getFlag("sgrpg", "initiativeAdv")) {
      nd = 2;
      mods += "kh";
    }

    // Optionally apply Dexterity tiebreaker
    return `${nd}d20${mods} + ${init}`;
  };