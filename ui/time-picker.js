let activePicker = null;
let nextId = 0;

// Keep the HH:MM input contract used by profile and observation persistence.
export function enhanceTimeInputs(root) {
  root.querySelectorAll?.('input[type="time"]').forEach(input => {
    const wrapper = document.createElement("div");
    wrapper.className = "time-picker";
    input.before(wrapper);
    wrapper.append(input);
    input.type = "text";
    input.inputMode = "numeric";
    input.placeholder = "HH:MM";
    input.pattern = "([01][0-9]|2[0-3]):[0-5][0-9]";
    input.maxLength = 5;
    input.setAttribute("aria-label", "Measurement time (HH:MM)");

    const toggle = document.createElement("button");
    toggle.type = "button";
    toggle.className = "time-picker-toggle";
    toggle.setAttribute("aria-label", "Choose time");
    toggle.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><circle cx="12" cy="12" r="8"/><path d="M12 7v5l3 2"/></svg>';
    const panel = document.createElement("div");
    panel.id = `time-picker-${++nextId}`;
    panel.className = "time-picker-panel";
    panel.hidden = true;
    panel.setAttribute("role", "group");
    panel.setAttribute("aria-label", "Choose measurement time");
    toggle.setAttribute("aria-controls", panel.id);
    toggle.setAttribute("aria-expanded", "false");
    panel.innerHTML = '<div class="time-picker-heading">Measurement time</div><div class="time-picker-columns"></div><div class="time-picker-footer"><button type="button" class="time-picker-clear">Clear</button><button type="button" class="time-picker-done">Done</button></div>';
    wrapper.append(toggle, panel);
    const columns = panel.querySelector(".time-picker-columns");
    const choices = [];
    const wheels = [];
    const rowHeight = 40;
    const readParts = () => {
      const parts = /^([01]\d|2[0-3]):[0-5]\d$/.test(input.value) ? input.value.split(":") : ["08", "00"];
      parts[1] = String(Math.min(55, Math.round(Number(parts[1]) / 5) * 5)).padStart(2, "0");
      return parts;
    };
    for (const [part, count, step, label] of [[0, 24, 1, "Hours"], [1, 60, 5, "Minutes"]]) {
      const column = document.createElement("div");
      column.className = "time-picker-column";
      const heading = document.createElement("div");
      heading.className = "time-picker-label";
      heading.textContent = label;
      const list = document.createElement("div");
      list.className = "time-picker-options";
      list.setAttribute("role", "listbox");
      list.setAttribute("aria-label", label);
      list.tabIndex = 0;
      let timer;
      let interacting = false;
      const select = index => {
        const parts = readParts();
        parts[part] = String(index * step).padStart(2, "0");
        input.value = parts.join(":");
        input.dispatchEvent(new Event("input", { bubbles: true }));
        input.dispatchEvent(new Event("change", { bubbles: true }));
        sync();
      };
      const settle = () => {
        clearTimeout(timer);
        if (!interacting || panel.hidden) return;
        interacting = false;
        const index = Math.max(0, Math.min(count / step - 1, Math.round(list.scrollTop / rowHeight)));
        select(index);
        list.scrollTo({ top: index * rowHeight, behavior: "smooth" });
      };
      list.addEventListener("wheel", () => { interacting = true; }, { passive: true });
      list.addEventListener("pointerdown", () => { interacting = true; });
      list.addEventListener("scroll", () => {
        clearTimeout(timer);
        if (interacting) timer = setTimeout(settle, 160);
      });
      list.addEventListener("keydown", event => {
        if (!["ArrowUp", "ArrowDown", "Home", "End"].includes(event.key)) return;
        event.preventDefault();
        const current = Number(readParts()[part]) / step;
        const index = event.key === "Home" ? 0 : event.key === "End" ? count / step - 1
          : Math.max(0, Math.min(count / step - 1, current + (event.key === "ArrowDown" ? 1 : -1)));
        interacting = false;
        select(index);
        list.scrollTo({ top: index * rowHeight, behavior: "smooth" });
      });
      wheels.push({ list, part, step, reset: () => { clearTimeout(timer); interacting = false; }, settle });
      for (let value = 0; value < count; value += step) {
        const button = document.createElement("button");
        const padded = String(value).padStart(2, "0");
        button.type = "button";
        button.tabIndex = -1;
        button.id = `${panel.id}-${part}-${value}`;
        button.setAttribute("role", "option");
        button.textContent = padded;
        button.setAttribute("aria-label", `${label}: ${padded}`);
        button.onclick = () => {
          interacting = false;
          clearTimeout(timer);
          select(value / step);
          list.scrollTo({ top: value / step * rowHeight, behavior: "smooth" });
        };
        choices.push({ button, part, padded });
        list.append(button);
      }
      const drum = document.createElement("div");
      drum.className = "time-picker-drum";
      drum.append(list);
      column.append(heading, drum);
      columns.append(column);
    }
    function sync() {
      const parts = readParts();
      choices.forEach(({ button, part, padded }) => {
        button.setAttribute("aria-selected", String(parts[part] === padded));
        if (parts[part] === padded) button.parentElement.setAttribute("aria-activedescendant", button.id);
      });
    }
    function close() {
      wheels.forEach(wheel => wheel.reset());
      panel.hidden = true;
      toggle.setAttribute("aria-expanded", "false");
      if (activePicker === close) activePicker = null;
    }
    toggle.onclick = () => {
      if (!panel.hidden) return close();
      activePicker?.();
      activePicker = close;
      sync();
      panel.hidden = false;
      panel.classList.remove("is-above");
      const fieldRect = input.getBoundingClientRect();
      const panelHeight = panel.getBoundingClientRect().height;
      if (fieldRect.bottom + panelHeight + 8 > window.innerHeight && fieldRect.top > panelHeight + 8) {
        panel.classList.add("is-above");
      }
      toggle.setAttribute("aria-expanded", "true");
      const parts = readParts();
      wheels.forEach(({ list, part, step, reset }) => {
        reset();
        list.scrollTop = Number(parts[part]) / step * rowHeight;
      });
    };
    wrapper.addEventListener("focusout", event => {
      if (!wrapper.contains(event.relatedTarget)) close();
    });
    wrapper.addEventListener("keydown", event => {
      if (event.key === "Escape" && !panel.hidden) {
        event.preventDefault();
        close();
        toggle.focus();
      }
    });
    panel.querySelector(".time-picker-done").onclick = () => {
      wheels.forEach(wheel => wheel.settle());
      close();
      toggle.focus();
    };
    panel.querySelector(".time-picker-clear").onclick = () => {
      input.value = "";
      input.dispatchEvent(new Event("input", { bubbles: true }));
      input.dispatchEvent(new Event("change", { bubbles: true }));
      close();
      input.focus();
    };
  });
}
