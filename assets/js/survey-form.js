/* ---------------------------------------------------------
   공용 설문/자가점검 폼 렌더러
   - schema: [{ id, type: "text" | "textarea" | "choice", label, helper?,
                placeholder?, numeric4?, options? }]
   - "기타" 옵션이 있는 choice 문항은 선택 시 자유 입력란이 함께 열린다.
--------------------------------------------------------- */

function renderQuestionField(q, index) {
  const wrap = document.createElement("div");
  wrap.className = "qform-item";

  const labelEl = document.createElement("p");
  labelEl.className = "qform-item__label";
  labelEl.textContent = `${index}. ${q.label}`;
  wrap.appendChild(labelEl);

  if (q.helper) {
    const helperEl = document.createElement("p");
    helperEl.className = "qform-item__helper";
    helperEl.textContent = q.helper;
    wrap.appendChild(helperEl);
  }

  if (q.type === "text") {
    const input = document.createElement("input");
    input.type = "text";
    input.className = "qform-text";
    input.name = q.id;
    input.id = `f-${q.id}`;
    if (q.placeholder) input.placeholder = q.placeholder;
    if (q.numeric4) {
      input.inputMode = "numeric";
      input.maxLength = 4;
      input.setAttribute("pattern", "[0-9]{4}");
    }
    wrap.appendChild(input);
  } else if (q.type === "textarea") {
    const textarea = document.createElement("textarea");
    textarea.className = "qform-textarea";
    textarea.name = q.id;
    textarea.id = `f-${q.id}`;
    if (q.placeholder) textarea.placeholder = q.placeholder;
    wrap.appendChild(textarea);
  } else if (q.type === "choice") {
    const optionsWrap = document.createElement("div");
    optionsWrap.className = "qform-options";

    const otherInputs = [];

    q.options.forEach((opt, i) => {
      const optId = `f-${q.id}-${i}`;
      const row = document.createElement("label");
      row.className = "qform-option";
      row.setAttribute("for", optId);

      const radio = document.createElement("input");
      radio.type = "radio";
      radio.name = q.id;
      radio.id = optId;
      radio.value = opt;

      const span = document.createElement("span");
      span.textContent = opt;

      row.appendChild(radio);
      row.appendChild(span);
      optionsWrap.appendChild(row);

      if (opt === "기타") {
        const otherInput = document.createElement("input");
        otherInput.type = "text";
        otherInput.className = "qform-other-input";
        otherInput.name = `${q.id}__other`;
        otherInput.placeholder = "직접 입력";
        otherInput.disabled = true;
        optionsWrap.appendChild(otherInput);
        otherInputs.push(otherInput);
      }
    });

    optionsWrap.querySelectorAll('input[type="radio"]').forEach((radio) => {
      radio.addEventListener("change", () => {
        otherInputs.forEach((el) => {
          const enable = radio.value === "기타";
          el.disabled = !enable;
          if (!enable) el.value = "";
        });
      });
    });

    wrap.appendChild(optionsWrap);
  }

  return wrap;
}

function renderSchema(schema, containerEl) {
  containerEl.innerHTML = "";
  schema.forEach((q, i) => {
    containerEl.appendChild(renderQuestionField(q, i + 1));
  });
}

function collectAnswers(containerEl, schema) {
  const answers = {};
  schema.forEach((q) => {
    if (q.type === "text" || q.type === "textarea") {
      const el = containerEl.querySelector(`[name="${q.id}"]`);
      answers[q.id] = el ? el.value.trim() : "";
    } else if (q.type === "choice") {
      const checked = containerEl.querySelector(`input[name="${q.id}"]:checked`);
      if (!checked) {
        answers[q.id] = "";
      } else if (checked.value === "기타") {
        const otherEl = containerEl.querySelector(`[name="${q.id}__other"]`);
        const otherText = otherEl ? otherEl.value.trim() : "";
        answers[q.id] = otherText ? `기타: ${otherText}` : "기타";
      } else {
        answers[q.id] = checked.value;
      }
    }
  });
  return answers;
}

function countAnswered(answers) {
  return Object.values(answers).filter((v) => v && v.trim().length > 0).length;
}
