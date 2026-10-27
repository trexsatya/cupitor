// Adds a strikethrough format to the CKEditor 5 instance used by manual cards.
// The classic build does not always bundle CKEditor's native Strikethrough plugin.
const ATTRIBUTE = "cupCardStrike";

export function toggleRichCardStrikethrough(editor) {
    const nativeCommand = editor.commands.get("strikethrough");
    if (nativeCommand) {
        editor.execute("strikethrough");
        editor.editing.view.focus();
        return;
    }

    const model = editor.model;
    const selection = model.document.selection;
    const enable = selection.getAttribute(ATTRIBUTE) !== true;
    model.change(writer => {
        if (selection.isCollapsed) {
            if (enable) writer.setSelectionAttribute(ATTRIBUTE, true);
            else writer.removeSelectionAttribute(ATTRIBUTE);
            return;
        }
        // Formatting must only touch text ranges that allow this attribute.
        for (const range of model.schema.getValidRanges(selection.getRanges(), ATTRIBUTE)) {
            if (enable) writer.setAttribute(ATTRIBUTE, true, range);
            else writer.removeAttribute(ATTRIBUTE, range);
        }
    });
    editor.editing.view.focus();
}

export function installRichCardStrikethrough(editor) {
    const nativeCommand = editor.commands.get("strikethrough");
    if (!nativeCommand) {
        editor.model.schema.extend("$text", { allowAttributes: ATTRIBUTE });
        editor.conversion.for("downcast").attributeToElement({ model: ATTRIBUTE, view: "s" });
        editor.conversion.for("upcast").elementToAttribute({ view: "s", model: ATTRIBUTE });
    }

    const toolbar = editor.ui.view.toolbar.element;
    const items = toolbar.querySelector(".ck-toolbar__items") || toolbar;
    const button = document.createElement("button");
    button.type = "button";
    button.className = "ck ck-button ck-off";
    button.title = "Strikethrough";
    button.setAttribute("aria-label", "Strikethrough");
    button.setAttribute("aria-pressed", "false");
    button.setAttribute("data-cke-tooltip-text", "Strikethrough");
    button.innerHTML = '<span class="ck ck-button__label" style="display:inline;font-weight:bold;text-decoration:line-through;font-size:16px">S</span>';

    const update = () => {
        const active = nativeCommand
            ? !!nativeCommand.value
            : editor.model.document.selection.getAttribute(ATTRIBUTE) === true;
        button.classList.toggle("ck-on", active);
        button.classList.toggle("ck-off", !active);
        button.setAttribute("aria-pressed", String(active));
        button.disabled = nativeCommand ? !nativeCommand.isEnabled : false;
    };

    // Keep the model selection when the user taps the formatting toolbar.
    button.addEventListener("pointerdown", event => event.preventDefault());
    button.addEventListener("click", () => {
        toggleRichCardStrikethrough(editor);
        update();
    });
    editor.model.document.selection.on("change:range", update);
    editor.model.document.selection.on("change:attribute", update);
    if (nativeCommand) {
        nativeCommand.on("change:value", update);
        nativeCommand.on("change:isEnabled", update);
    }

    // Keep this frequently-used formatting action beside Bold / Italic.
    const italic = [...items.querySelectorAll("button")].find(element =>
        /italic/i.test(element.getAttribute("aria-label") || element.title || "")
    );
    if (italic) italic.after(button);
    else items.prepend(button);
    update();
    return button;
}
