/* =========================================================
   고객센터 문의 폼
   서버 디스크에 아무것도 저장하지 않습니다.

   수신 주소: theesgcom@gmail.com

   연결 방법 (둘 중 하나)
   1) Formspree — 기본
      https://formspree.io 에서 새 폼을 만들고,
      Email Notifications 수신자를 theesgcom@gmail.com 으로 지정한 뒤
      아래 formspree 값의 YOUR_FORM_ID 를 발급된 ID로 바꿉니다.
      예) "https://formspree.io/f/xpzgabcd"
      고객 확인 메일은 Formspree Autoresponse 에서
      {{email}} / {{name}} / {{inquiry_type}} 를 사용합니다.

   2) Make (구 Integromat)
      provider 를 "make" 로 바꾸고 make 에 Webhook URL을 넣습니다.
      예) "https://hook.eu1.make.com/xxxxxxxx"
      시나리오:
        Webhooks → 이메일(To: theesgcom@gmail.com, 문의 본문)
                 → 이메일(To: {{email}}, 접수 확인. name, inquiry_type, message 사용)
   ========================================================= */
(function () {
  var RECIPIENT = "theesgcom@gmail.com";

  var CONFIG = {
    provider: "formspree",
    formspree: "https://formspree.io/f/YOUR_FORM_ID",
    make: ""
  };

  var TYPES = {
    b2b: "B2B 대량 구매 / 단체 납품 문의",
    csr: "Safe With You 사회공헌 / 파트너십 제휴",
    product: "숨스크 제품 / 안전키트 일반 문의",
    etc: "기타 일반 문의"
  };

  var form = document.getElementById("inquiry-form");
  if (!form) return;

  var select = form.querySelector("[name='inquiry_type']");
  var statusBox = document.getElementById("form-status");
  var doneBox = document.getElementById("form-done");
  var submitBtn = form.querySelector(".contact-submit");

  function applyTypeFromQuery() {
    var code = new URLSearchParams(window.location.search).get("type");
    if (!code || !TYPES[code]) return;
    select.value = TYPES[code];
  }

  function fieldOf(name) {
    return form.querySelector("[data-field='" + name + "']");
  }

  function setError(name, message) {
    var wrap = fieldOf(name);
    var slot = wrap ? wrap.querySelector(".contact-error") : null;
    var control = form.elements[name];
    if (wrap) wrap.classList.toggle("is-invalid", Boolean(message));
    if (slot) slot.textContent = message || "";
    if (control && control.setAttribute) {
      if (message) control.setAttribute("aria-invalid", "true");
      else control.removeAttribute("aria-invalid");
    }
  }

  function clearErrors() {
    ["inquiry_type", "name", "email", "phone", "message", "privacy"].forEach(function (name) {
      setError(name, "");
    });
  }

  function validate() {
    clearErrors();
    var data = readPayload();
    var first = null;

    function fail(name, message) {
      setError(name, message);
      if (!first) first = form.elements[name];
    }

    if (!data.inquiry_type) fail("inquiry_type", "문의 유형을 선택해 주세요.");
    if (!data.name) fail("name", "담당자 성함을 입력해 주세요.");
    if (!data.email) fail("email", "회신받을 이메일을 입력해 주세요.");
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) fail("email", "이메일 형식을 확인해 주세요.");
    if (!data.phone) fail("phone", "연락처를 입력해 주세요.");
    else if (data.phone.replace(/\D/g, "").length < 8) fail("phone", "연락처 번호를 확인해 주세요.");
    if (!data.message) fail("message", "문의 내용을 입력해 주세요.");
    if (!form.elements.privacy.checked) fail("privacy", "개인정보 수집 및 이용에 동의해 주세요.");

    if (first && first.focus) first.focus();
    return !first;
  }

  function readPayload() {
    return {
      name: form.elements.name.value.trim(),
      email: form.elements.email.value.trim(),
      phone: form.elements.phone.value.trim(),
      inquiry_type: form.elements.inquiry_type.value,
      message: form.elements.message.value.trim(),
      organization: form.elements.organization.value.trim(),
      quantity: form.elements.quantity.value.trim(),
      to: RECIPIENT
    };
  }

  function endpoint() {
    if (CONFIG.provider === "make") {
      return CONFIG.make && CONFIG.make.indexOf("http") === 0 ? CONFIG.make : "";
    }
    if (!CONFIG.formspree || CONFIG.formspree.indexOf("YOUR_FORM_ID") !== -1) return "";
    return CONFIG.formspree;
  }

  function showStatus(kind, text) {
    statusBox.hidden = false;
    statusBox.className = "contact-status is-" + kind;
    statusBox.textContent = text;
  }

  function setLoading(on) {
    submitBtn.disabled = on;
    submitBtn.classList.toggle("is-loading", on);
    submitBtn.setAttribute("aria-busy", String(on));
    submitBtn.querySelector(".contact-submit__label").textContent = on ? "보내는 중" : "문의하기";
  }

  function mailtoFallback(payload) {
    var body = [
      "문의 유형: " + payload.inquiry_type,
      "담당자: " + payload.name,
      "기관/기업: " + (payload.organization || "-"),
      "이메일: " + payload.email,
      "연락처: " + payload.phone,
      "예상 수량: " + (payload.quantity || "-"),
      "",
      payload.message
    ].join("\n");
    var href = "mailto:" + RECIPIENT
      + "?subject=" + encodeURIComponent("[ESG 라이프쉴드] " + payload.inquiry_type)
      + "&body=" + encodeURIComponent(body);
    window.location.href = href;
  }

  function finish(payload) {
    form.hidden = true;
    doneBox.hidden = false;
    doneBox.querySelector("[data-done-mail]").textContent = payload.email;
  }

  async function send(payload) {
    var url = endpoint();
    if (!url) {
      setLoading(false);
      showStatus("ok", "메일 앱이 열립니다. 발송을 마치면 " + RECIPIENT + " 으로 전달됩니다. Formspree 또는 Make 주소를 넣으면 이 페이지에서 바로 접수됩니다.");
      mailtoFallback(payload);
      return;
    }

    var body = {
      name: payload.name,
      email: payload.email,
      phone: payload.phone,
      inquiry_type: payload.inquiry_type,
      message: payload.message,
      organization: payload.organization,
      quantity: payload.quantity,
      to: RECIPIENT,
      _subject: "[ESG 라이프쉴드] " + payload.inquiry_type + " - " + payload.name,
      _replyto: payload.email
    };

    var response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Accept": "application/json"
      },
      body: JSON.stringify(body)
    });

    if (!response.ok) {
      throw new Error("submit failed");
    }
    finish(payload);
  }

  applyTypeFromQuery();

  form.addEventListener("submit", function (event) {
    event.preventDefault();
    statusBox.hidden = true;
    if (form.elements._gotcha && form.elements._gotcha.value) {
      finish(readPayload());
      return;
    }
    if (!validate()) return;

    var payload = readPayload();
    setLoading(true);
    send(payload).catch(function () {
      setLoading(false);
      showStatus("err", "전송하지 못했습니다. 잠시 후 다시 시도하거나 " + RECIPIENT + " 으로 보내 주세요.");
    });
  });
})();
