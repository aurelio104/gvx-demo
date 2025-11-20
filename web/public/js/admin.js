(function(){
  var nowLabel = document.getElementById("nowLabel");
  function updateNow(){
    var d = new Date();
    nowLabel.textContent = d.toLocaleString();
  }
  updateNow();
  setInterval(updateNow, 1000);

  // Set defaults para fecha y hora: ahora + 2 minutos
  var dateInput = document.getElementById("date");
  var timeInput = document.getElementById("time");
  var base = new Date(new Date().getTime() + 2 * 60 * 1000);
  dateInput.valueAsNumber = base.setHours(0,0,0,0) + (new Date()).getTimezoneOffset()*60*1000; // aproximado
  var hh = String(base.getHours()).padStart(2,"0");
  var mm = String(base.getMinutes()).padStart(2,"0");
  var ss = String(base.getSeconds()).padStart(2,"0");
  timeInput.value = hh + ":" + mm + ":" + ss;

  var apiInput = document.getElementById("apiUrl");
  var fileInput = document.getElementById("file");
  var startInput = document.getElementById("start");
  var sendBtn = document.getElementById("sendBtn");
  var statusEl = document.getElementById("status");
  var preview = document.getElementById("preview");
  var scheduleLabel = document.getElementById("scheduleLabel");

  function makeScheduledIso(){
    var date = dateInput.value;
    var time = timeInput.value || "00:00:00";
    if(!date){return null;}
    var combined = date + "T" + time;
    var dt = new Date(combined);
    if(isNaN(dt.getTime())){return null;}
    return dt.toISOString();
  }

  function loadPreview(){
    var api = apiInput.value.trim().replace(/\/$/,"");
    if(!api){return;}
    preview.src = api + "/media/current?ts=" + Date.now();
  }
  loadPreview();

  sendBtn.addEventListener("click", function(){
    statusEl.textContent = "";
    statusEl.className = "status";
    var api = apiInput.value.trim().replace(/\/$/,"");
    if(!api){
      statusEl.textContent = "Falta API URL.";
      statusEl.classList.add("err");
      return;
    }
    var file = fileInput.files && fileInput.files[0];
    if(!file){
      statusEl.textContent = "Selecciona un archivo de video.";
      statusEl.classList.add("err");
      return;
    }
    var scheduledIso = makeScheduledIso();
    if(!scheduledIso){
      statusEl.textContent = "Fecha u hora inválida.";
      statusEl.classList.add("err");
      return;
    }

    var localText = new Date(scheduledIso).toLocaleString();
    scheduleLabel.textContent = "Programado para: " + localText;

    var start = Number(startInput.value) || 0;

    sendBtn.disabled = true;
    sendBtn.textContent = "Procesando…";

    var fd = new FormData();
    fd.append("file", file);
    fd.append("start", String(start));
    fd.append("scheduledAt", scheduledIso);

    fetch(api + "/media/trim-set", {
      method: "POST",
      body: fd
    })
      .then(function(res){
        return res.text().then(function(text){
          if(!res.ok){
            throw new Error(text || "Error al programar video");
          }
          try{return JSON.parse(text);}catch(_){return {raw:text};}
        });
      })
      .then(function(data){
        statusEl.textContent = "Spot programado correctamente para " + localText + ".";
        statusEl.classList.add("ok");
        loadPreview();
      })
      .catch(function(err){
        console.error(err);
        statusEl.textContent = err.message || "Error inesperado";
        statusEl.classList.add("err");
      })
      .finally(function(){
        sendBtn.disabled = false;
        sendBtn.textContent = "Programar spot";
      });
  });
})();
