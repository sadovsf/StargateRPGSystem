// Namespace Configuration Values
export const SGRPG = {};


SGRPG.abilities = {
    "str": "Strength",
    "dex": "Dexterity",
    "con": "Constitution",
    "int": "Inteligence",
    "wis": "Wisdom",
    "cha": "Charisma"
  };


SGRPG.attackTypes = {
    piercing: "Piercing",
    bludgeoning: "Bludgeoning",
}


// Configure Optional Character Flags
SGRPG.characterFlags = {
  "initiativeAdv": {
    name: "Advantage on initiative",
    hint: "Provided by feats or items",
    section: "Feats",
    type: Boolean
  }
};