Hooks.on("renderSceneConfig", (sheet, html, data) => {
    const document = sheet.object;

    const campaignTension = game.settings.get("sgrpg", "campaignTension");
    const sceneTension = data.document.getFlag("sgrpg", "sceneTensionDie") || "";

    html.find(`select[name="journal"]`).parent().after(`\
        <div class="form-group">
            <label>Scene Tension Level</label>
            <div class="form-fields">
                <select type="text" name="flags.sgrpg.sceneTensionDie" data-dtype="String">
                    <option value="" ${sceneTension ? "" : "selected"}>Campaign Base (${campaignTension})</option>
                    <option value="d4" ${sceneTension === "d4" ? "selected" : ""}>Comedic (d4)</option>
                    <option value="d6" ${sceneTension === "d6" ? "selected" : ""}>Standard (d6)</option>
                    <option value="d8" ${sceneTension === "d8" ? "selected" : ""}>Growing (d8)</option>
                    <option value="d10" ${sceneTension === "d10" ? "selected" : ""}>Dire (d10)</option>
                    <option value="d12" ${sceneTension === "d12" ? "selected" : ""}>All is Lost (d12)</option>
                </select>
            </div>
            <p class="notes">The Tension level can be set to differ from the campaign base value when this Scene is active.</p>
        </div>`);

    if (!sheet._minimized) {
        sheet.setPosition(sheet.position);
    }
});