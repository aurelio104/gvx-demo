(function(){
  var state = {
    apiBase: "",
    selectedDate: null,
    selectedHour: null,
    selectedSlotKey: null,
    scheduledAtIso: null,
    city: "",
    screen: "",
    file: null,
    trimStart: 0,
    scheduleFromApi: null
  };

  var stepPill1 = document.getElementById("stepPill1");
  var stepPill2 = document.getElementById("stepPill2");
  var stepPill3 = document.getElementById("stepPill3");
  var step1 = document.getElementById("step1");
  var step2 = document.getElementById("step2");
  var step3 = document.getElementById("step3");

  function setStep(n){
    [step1,step2,step3].forEach(function(el){el.classList.remove("active");});
    [stepPill1,stepPill2,stepPill3].forEach(function(el){el.classList.remove("active");});
    if(n===1){step1.classList.add("active");stepPill1.classList.add("active");}
    if(n===2){step2.classList.add("active");stepPill2.classList.add("active");}
    if(n===3){step3.classList.add("active");stepPill3.classList.add("active");}
  }

  var apiInput = document.getElementById("apiUrl");
  var dateInput = document.getElementById("dateInput");
  var citySelect = document.getElementById("citySelect");
  var screenSelect = document.getElementById("screenSelect");
  var hourSelect = document.getElementById("hourSelect");
  var nowLabel = document.getElementById("nowLabel");
  var slotsContainer = document.getElementById("slotsContainer");
  var slotSummary = document.getElementById("slotSummary");
  var status1 = document.getElementById("status1");

  var fileInput = document.getElementById("fileInput");
  var startInput = document.getElementById("startInput");
  var status2 = document.getElementById("status2");
  var previewVideo = document.getElementById("previewVideo");
  var toStep3Btn = document.getElementById("toStep3");

  var summaryText = document.getElementById("summaryText");
  var status3 = document.getElementById("status3");
  var previewFinal = document.getElementById("previewFinal");
  var backTo2 = document.getElementById("backTo2");

  function updateClock(){
    nowLabel.textContent = new Date().toLocaleString();
  }
  updateClock();
  setInterval(updateClock,1000);

  // llenar horas 0-23
  for(var h=0;h<24;h++){
    var opt=document.createElement("option");
    opt.value=String(h);
    opt.textContent=(h<10?"0":"")+h+":00";
    hourSelect.appendChild(opt);
  }

  function initDateHourDefaults(){
    var now = new Date();
    var yyyy = now.getFullYear();
    var mm = String(now.getMonth()+1).padStart(2,"0");
    var dd = String(now.getDate()).padStart(2,"0");
    dateInput.value = yyyy+"-"+mm+"-"+dd;
    state.selectedDate = dateInput.value;
    state.selectedHour = now.getHours();
    hourSelect.value = String(state.selectedHour);
  }
  initDateHourDefaults();

  function loadExistingSchedule(){
    state.scheduleFromApi = null;
    var api = apiInput.value.trim().replace(/\/$/,"");
    state.apiBase = api;
    if(!api){renderSlots();return;}
    fetch(api + "/schedule/next", {cache:"no-store"})
      .then(function(res){
        if(!res.ok) return null;
        return res.json();
      })
      .then(function(data){
        if(data && !data.error){
          state.scheduleFromApi = data;
        }
        renderSlots();
      })
      .catch(function(){
        renderSlots();
      });
  }

  function renderSlots(){
    var dateStr = dateInput.value;
    if(!dateStr){
      slotsContainer.innerHTML = "<div class='tiny'>Selecciona una fecha para ver los slots.</div>";
      return;
    }
    var selectedHour = Number(hourSelect.value || "0");
    state.selectedDate = dateStr;
    state.selectedHour = selectedHour;

    var now = new Date();

    var busyKey = null;
    if(state.scheduleFromApi){
      var s = new Date(state.scheduleFromApi.startTime);
      var sY = s.getFullYear();
      var sM = String(s.getMonth()+1).padStart(2,"0");
      var sD = String(s.getDate()).padStart(2,"0");
      var sDateStr = sY+"-"+sM+"-"+sD;
      if(sDateStr === dateStr && s.getHours() === selectedHour){
        var m = String(s.getMinutes()).padStart(2,"0");
        var sec = String(s.getSeconds()).padStart(2,"0");
        busyKey = String(selectedHour).padStart(2,"0")+":"+m+":"+sec;
      }
    }

    slotsContainer.innerHTML = "";
    for(var minute=0; minute<60; minute++){
      var row = document.createElement("div");
      row.className = "slot-row";
      var label = document.createElement("div");
      label.className = "slot-minute-label";
      label.textContent = String(selectedHour).padStart(2,"0")+":"+String(minute).padStart(2,"0");
      row.appendChild(label);
      [0,15,30,45].forEach(function(sec){
        var key = String(selectedHour).padStart(2,"0")+":"+String(minute).padStart(2,"0")+":"+String(sec).padStart(2,"0");
        var slotTime = new Date(dateStr+"T"+key);
        var btn = document.createElement("button");
        btn.className = "slot";
        btn.textContent = ":"+String(sec).padStart(2,"0");
        btn.dataset.key = key;

        var status = "free";
        if(dateStr === (now.toISOString().slice(0,10)) && slotTime.getTime() <= now.getTime()){
          status = "past";
        }
        if(busyKey && key === busyKey){
          status = "busy";
        }

        btn.classList.add(status);
        if(status !== "free"){btn.disabled = true;}

        if(state.selectedSlotKey === key && status === "free"){
          btn.classList.add("selected");
        }

        row.appendChild(btn);
      });
      slotsContainer.appendChild(row);
    }

    if(state.selectedSlotKey && state.scheduledAtIso){
      slotSummary.textContent = "Slot seleccionado: "+ new Date(state.scheduledAtIso).toLocaleString();
    }else{
      slotSummary.textContent = "Ningún slot seleccionado.";
    }
  }

  slotsContainer.addEventListener("click", function(e){
    var btn = e.target.closest("button.slot");
    if(!btn || btn.disabled){return;}
    var key = btn.dataset.key;
    var dateStr = dateInput.value;
    if(!dateStr){return;}
    var iso = new Date(dateStr+"T"+key).toISOString();
    state.selectedSlotKey = key;
    state.scheduledAtIso = iso;
    renderSlots();
  });

  apiInput.addEventListener("change", loadExistingSchedule);
  dateInput.addEventListener("change", renderSlots);
  hourSelect.addEventListener("change", renderSlots);

  loadExistingSchedule();

  // Paso 1 -> Paso 2
  document.getElementById("toStep2").addEventListener("click", function(){
    status1.textContent = "";
    status1.className = "status";
    var api = apiInput.value.trim().replace(/\/$/,"");
    if(!api){
      status1.textContent = "Configura primero la API URL.";
      status1.classList.add("err");
      return;
    }
    if(!state.scheduledAtIso){
      status1.textContent = "Selecciona un slot de 15 segundos.";
      status1.classList.add("err");
      return;
    }
    state.apiBase = api;
    state.city = citySelect.value;
    state.screen = screenSelect.value;
    setStep(2);
  });

  document.getElementById("backTo1").addEventListener("click", function(){
    setStep(1);
  });

  // Paso 2: subida + preview
  fileInput.addEventListener("change", function(){
    status2.textContent = "";
    status2.className = "status";
    toStep3Btn.disabled = true;
    if(fileInput.files && fileInput.files[0]){
      state.file = fileInput.files[0];
    }else{
      state.file = null;
    }
  });

  document.getElementById("processBtn").addEventListener("click", function(){
    status2.textContent = "";
    status2.className = "status";
    if(!state.file){
      status2.textContent = "Selecciona un archivo de video primero.";
      status2.classList.add("err");
      return;
    }
    var api = state.apiBase;
    if(!api){
      status2.textContent = "Falta API URL.";
      status2.classList.add("err");
      return;
    }
    var start = Number(startInput.value) || 0;
    state.trimStart = start;

    var fd = new FormData();
    fd.append("file", state.file);
    fd.append("start", String(start));

    var btn = this;
    btn.disabled = true;
    btn.textContent = "Procesando…";
    toStep3Btn.disabled = true;

    fetch(api + "/media/trim", {
      method:"POST",
      body:fd
    }).then(function(res){
      if(!res.ok){throw new Error("Error al generar preview");}
      return res.blob();
    }).then(function(blob){
      var url = URL.createObjectURL(blob);
      previewVideo.src = url;
      previewVideo.play().catch(function(){});
      status2.textContent = "Preview generada correctamente. Ahora puedes continuar al paso 3.";
      status2.classList.add("ok");
      toStep3Btn.disabled = false;
    }).catch(function(err){
      console.error(err);
      status2.textContent = err.message || "Error inesperado";
      status2.classList.add("err");
    }).finally(function(){
      btn.disabled = false;
      btn.textContent = "Procesar preview";
    });
  });

  // Botón para pasar a Paso 3
  function fillSummary(){
    var when = state.scheduledAtIso ? new Date(state.scheduledAtIso).toLocaleString() : "—";
    summaryText.textContent =
      "Ciudad: " + state.city + " · Pantalla: " + state.screen +
      " · Slot: " + when +
      " · Duración: 15 segundos.";
  }

  toStep3Btn.addEventListener("click", function(){
    if(!previewVideo.src){
      status2.textContent = "Genera primero la preview antes de continuar.";
      status2.classList.add("err");
      return;
    }
    fillSummary();
    setStep(3);
  });

  // Navegación atrás desde Paso 3
  backTo2.addEventListener("click", function(){
    setStep(2);
  });

  // Botón de pago (Paso 3)
  var payBtn = document.getElementById("payBtn");
  payBtn.addEventListener("click", function(){
    status3.textContent = "";
    status3.className = "status";
    if(!state.file){
      status3.textContent = "Falta el archivo de video (sube en Paso 2).";
      status3.classList.add("err");
      return;
    }
    if(!state.scheduledAtIso){
      status3.textContent = "Falta el slot de 15 segundos.";
      status3.classList.add("err");
      return;
    }
    var api = state.apiBase;
    if(!api){
      status3.textContent = "Falta API URL.";
      status3.classList.add("err");
      return;
    }
    fillSummary();

    var fd = new FormData();
    fd.append("file", state.file);
    fd.append("start", String(state.trimStart || 0));
    fd.append("scheduledAt", state.scheduledAtIso);
    fd.append("city", state.city);
    fd.append("screen", state.screen);

    payBtn.disabled = true;
    payBtn.textContent = "Programando…";

    fetch(api + "/media/trim-set", {
      method:"POST",
      body:fd
    }).then(function(res){
      return res.text().then(function(text){
        if(!res.ok){throw new Error(text || "Error al programar spot");}
        try{return JSON.parse(text);}catch(_){return {raw:text};}
      });
    }).then(function(data){
      status3.textContent = "Pago simulado y spot programado correctamente. ID: " + (data.schedule && data.schedule.id ? data.schedule.id : "—");
      status3.classList.add("ok");
      var url = api + "/media/current?ts=" + Date.now();
      previewFinal.src = url;
      previewFinal.play().catch(function(){});
      setStep(3);
    }).catch(function(err){
      console.error(err);
      status3.textContent = err.message || "Error inesperado";
      status3.classList.add("err");
    }).finally(function(){
      payBtn.disabled = false;
      payBtn.textContent = "Simular pago y programar";
    });
  });

  // Permitir ir a Paso 3 tocando el resumen (si ya hay datos)
  summaryText.addEventListener("click", function(){
    if(summaryText.textContent && summaryText.textContent !== "—"){
      setStep(3);
    }
  });
})();
