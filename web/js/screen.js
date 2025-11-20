(function(){
  var apiInput = document.getElementById("apiUrl");
  var startBtn = document.getElementById("startBtn");
  var player = document.getElementById("player");
  var countdownBox = document.getElementById("countdown");
  var countValue = document.getElementById("countValue");
  var statusText = document.getElementById("statusText");
  var clockText = document.getElementById("clockText");

  var apiBase = "";
  var pollId = null;
  var currentVideoUrl = null;

  function fmtDuration(s){
    var sec = Math.max(0, Math.floor(s));
    var m = Math.floor(sec / 60);
    var r = sec % 60;
    if(m > 0){
      return m + "m " + String(r).padStart(2,"0") + "s";
    }
    return r + "s";
  }

  function updateClock(){
    clockText.textContent = new Date().toLocaleTimeString();
  }
  updateClock();
  setInterval(updateClock,1000);

  function ensureVideoPlaying(){
    var url = apiBase + "/media/current?ts=" + Date.now();
    if(currentVideoUrl !== url){
      currentVideoUrl = url;
      player.src = url;
    }
    player.play().catch(function(){});
  }

  async function fetchSchedule(){
    try{
      var res = await fetch(apiBase + "/schedule/next", {cache:"no-store"});
      if(!res.ok){return null;}
      return await res.json();
    }catch(e){
      return null;
    }
  }

  async function tick(){
    if(!apiBase){return;}
    var schedule = await fetchSchedule();
    if(!schedule || schedule.error){
      statusText.textContent = "Sin programación";
      countdownBox.style.display = "none";
      return;
    }
    var seconds = schedule.secondsUntilStart;
    var duration = schedule.durationSec || 15;
    var startLocal = new Date(schedule.startTime).toLocaleTimeString();
    var id = schedule.id || "—";

    if(seconds > 60){
      statusText.textContent = "Próximo spot ("+id+") a las " + startLocal + " · faltan " + fmtDuration(seconds);
      countdownBox.style.display = "none";
      player.pause();
    }else if(seconds <= 60 && seconds > 0){
      statusText.textContent = "Próximo spot ("+id+") a las " + startLocal;
      countdownBox.style.display = "block";
      countValue.textContent = fmtDuration(seconds);
      player.pause();
    }else if(seconds <= 0 && seconds > -duration){
      statusText.textContent = "EMITIENDO spot ("+id+") · inicio " + startLocal;
      countdownBox.style.display = "none";
      ensureVideoPlaying();
    }else{
      statusText.textContent = "Slot terminado. Esperando nueva programación.";
      countdownBox.style.display = "none";
      player.pause();
    }
  }

  startBtn.addEventListener("click", function(){
    var val = apiInput.value.trim().replace(/\/$/,"");
    if(!val){
      alert("Configura la API URL primero.");
      return;
    }
    apiBase = val;
    statusText.textContent = "Player conectado. Consultando programación…";
    if(pollId){clearInterval(pollId);}
    pollId = setInterval(tick, 1000);
    tick();
  });
})();
