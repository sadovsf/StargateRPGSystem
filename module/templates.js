/**
 * Define a set of template paths to pre-load
 * Pre-loaded templates are compiled and cached for fast access when rendering
 * @return {Promise}
 */
 export const preloadHandlebarsTemplates = async function() {
    return loadTemplates([

      // Item Sheet Partials
      "systems/sgrpg/templates/sheets/parts/weapon-details.hbs",
      "systems/sgrpg/templates/sheets/parts/equip-details.hbs",
      "systems/sgrpg/templates/sheets/parts/equip-header.hbs",
      "systems/sgrpg/templates/sheets/parts/weapon-header.hbs",

      // Actor Sheet Partials
      "systems/sgrpg/templates/sheets/parts/vehicle-details.hbs",
      "systems/sgrpg/templates/sheets/parts/actor-weapon-inventory.hbs",
      "systems/sgrpg/templates/sheets/parts/actor-equip-inventory.hbs",
      "systems/sgrpg/templates/sheets/parts/actor-bulk-progress.hbs"
    ]);
  };
