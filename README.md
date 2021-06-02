# StarGateRPGSystem
This is system for FoundryVTT based on original sheet implementation for Roll20:
https://github.com/Roll20/roll20-character-sheets/tree/master/Stargate-RPG

It is in super early stage and pretty much only part of visualizaiton is working as iam currently learning FoundryVTT API and stuff myself.
System should ideally contain at least characted sheet port and possibly if i have more time some prepared weapons and items.

Autoupdating will not work now so to install and update it you have to do it manually by downloading this repo and installing it next to other systems usually
somewhere in appdata folder on Windows. 

For Mac this folder is in `/Users/<username>/Library/Application Support/FoundryVTT/Data/systems`

In there create new folder named `stargate_rpg_system` (!! this name have to be exactly this !) and extract content of this repository into it.
After that you should have `system.json` file in path `<foundry_systems_folder>/stargate_rpg_system/system.json`.

After that you can just restart Foundry and you should see new StarGateRPG system installed.

