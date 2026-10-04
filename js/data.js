
// Lokale kalenderdag als "YYYY-MM-DD" -- NIET hetzelfde als
// date.toISOString().split('T')[0], die geeft de UTC-dag. Voor gebruikers
// ten oosten van UTC (o.a. Nederland, UTC+1/+2) loopt de kalenderdag lokaal
// al door terwijl het in UTC nog de vorige dag is (bv. tussen 00:00-02:00
// zomertijd) -- toISOString() gaf dan bv. "zaterdag" terwijl het lokaal al
// zondag was, met precies dat effect op alle "vandaag"/"morgen"-datumsleutels
// door de hele app (trainingDays, foodDays, prime_today, streak, enz.). Deze
// functie schuift het tijdzone-verschil eerst weg zodat de datumstring wél
// de lokale kalenderdag geeft. Gebruikt i.p.v. rechtstreeks
// date.toISOString().split('T')[0] overal waar een datum als sleutel wordt
// opgeslagen of vergeleken.
function localDateStr(d) {
  d = d || new Date();
  const tzOffsetMs = d.getTimezoneOffset() * 60000;
  return new Date(d.getTime() - tzOffsetMs).toISOString().split('T')[0];
}

// Ligt deze datum vast -- mag er niets meer aan voeding/training voor die
// dag gewijzigd worden? Dat geldt in twee gevallen: de dag is al (volledig)
// afgesloten via de dagelijkse check-out (dan staat de datum in history), Of
// de dag ligt gewoon al in het verleden (vóór vandaag) -- ook als er nooit
// een check-out voor is gedaan (bv. een gemiste dag). Zonder die tweede
// voorwaarde bleven eerdere, nooit-afgesloten dagen in Weekplanning gewoon
// vrij bewerkbaar, wat een voorbije dag met terugwerkende kracht kon laten
// veranderen. Gebruikt door renderLogItemCard() (food.js),
// wpBouwOefeningenAfvinken()/exCard() (weekplanning.js/training.js) om
// vinkjes/bewerk-/verwijderknoppen uit te schakelen, en door de
// dagkaart-acties (toevoegen/kopiëren/wissen) in weekplanning.js/foodweek.js.
function isDagAfgesloten(dateStr) {
  return dateStr < localDateStr() || history.some(h => h.date === dateStr);
}

// Mag een oefening/voedingsitem voor deze datum als "gedaan"/"gegeten"
// aangevinkt worden? Dat kan ALLEEN voor vandaag, en alleen zolang vandaag
// nog niet is afgesloten -- een voorbije dag ligt al vast (isDagAfgesloten),
// en een TOEKOMSTIGE dag kan per definitie nog niet "gedaan" zijn (die moet
// nog komen). Los van isDagAfgesloten(), die alléén voorbije/afgesloten
// dagen blokkeert en toekomstige dagen bewust WEL openlaat voor plannen
// (oefeningen/maaltijden toevoegen, programma inroosteren, kopiëren) --
// zie wpdBouwDagKaart/fwBouwDagKaart. Afvinken is dus strenger dan plannen.
function magAfvinken(dateStr) {
  return dateStr === localDateStr() && !isDagAfgesloten(dateStr);
}

// ========== EXTRA OEFENINGEN ==========
const EXTRA_EXERCISES = [
  { group:'Borst', group_en:'Chest', icon:'💪', color:'#744210', exercises:[
    { id:'ex-bp',   name:'Bench Press',         icon:'💪', sets:3, reps:'8-10', rest:'90 sec', youtube:'https://www.youtube.com/watch?v=SCVCLChPQFY', photo:'images/oefeningen/bench-press.jpg'},
    { id:'ex-dbp',  name:'Dumbbell Press',       icon:'💪', sets:3, reps:'10-12', rest:'75 sec', youtube:'https://www.youtube.com/watch?v=VmB1G1K7v94', photo:'images/oefeningen/dumbbell-press.jpg'},
    { id:'ex-pu',   name:'Push-ups',             icon:'🤸', sets:3, reps:'12-15', rest:'60 sec', youtube:'https://www.youtube.com/watch?v=IODxDxX7oi4', photo:'images/oefeningen/push-ups.jpg'},
    { id:'ex-ibp',  name:'Incline Bench Press',  icon:'📐', sets:3, reps:'10', rest:'90 sec', youtube:'https://www.youtube.com/watch?v=DbFgADa2PL8', photo:'images/oefeningen/incline-bench-press.jpg'},
    { id:'ex-cf',   name:'Cable Fly',            icon:'🔗', sets:3, reps:'12-15', rest:'60 sec', youtube:'https://www.youtube.com/watch?v=Iwe6AmxVf7o', photo:'images/oefeningen/cable-fly.jpg'},
    { id:'ex-dbfly',name:'Dumbbell Fly',         icon:'🦋', sets:3, reps:'12-15', rest:'60 sec', youtube:'https://www.youtube.com/watch?v=eozdVDA78K0', photo:'images/oefeningen/dumbbell-fly.jpg'},
    { id:"ex-idp", name:"Incline Dumbbell Press", icon:"📐", sets:3, reps:"8-12", rest:"90 sec", tip:"Zet de bank op 30-45°. Laat de dumbbells gecontroleerd zakken tot borsthoogte en duw ze schuin omhoog.", tip_en:"Set the bench to 30-45°. Lower the dumbbells under control to chest level and press them up.", youtube:"https://www.youtube.com/watch?v=5iACxPVXKGg", photo:"images/oefeningen/incline-dumbbell-press.jpg"},
    { id:"ex-cpm", name:"Chest Press (machine)", icon:"⚙️", sets:3, reps:"10-12", rest:"75 sec", tip:"Stel de zitting zo in dat de handvaten op borsthoogte zitten. Duw rustig naar voren en strek je ellebogen niet helemaal.", tip_en:"Adjust the seat so the handles are at chest height. Press forward smoothly and do not fully lock out your elbows.", youtube:"https://www.youtube.com/watch?v=pLofEAcfsO8", photo:"images/oefeningen/chest-press-machine.jpg"},
    { id:"ex-pd", name:"Pec Deck (machine)", icon:"🦋", sets:3, reps:"12-15", rest:"60 sec", tip:"Rug tegen het kussen, schouders naar achteren. Breng je armen samen voor je borst en voel de spanning in je borstspieren.", tip_en:"Keep your back on the pad and shoulders back. Bring your arms together in front of your chest and feel your chest working.", youtube:"https://www.youtube.com/watch?v=hZ0CGRaKwbQ", photo:"images/oefeningen/pec-deck.jpg"},
    { id:"ex-dcbp", name:"Decline Bench Press", icon:"⬇️", sets:3, reps:"8-10", rest:"90 sec", tip:"Traint vooral de onderkant van de borst. Gebruik een spotter of veiligheidsbeugels en laat de stang gecontroleerd zakken.", tip_en:"Targets the lower chest. Use a spotter or safety arms and lower the bar under control.", youtube:"https://www.youtube.com/watch?v=16yItsCGnsw", photo:"images/oefeningen/decline-bench-press.jpg"},
    { id:"ex-cx", name:"Cable Crossover", icon:"🔗", sets:3, reps:"12-15", rest:"60 sec", tip:"Kabels hoog, een lichte stap naar voren. Breng je handen in een boog naar elkaar toe voor je lichaam.", tip_en:"Cables set high, one small step forward. Bring your hands together in an arc in front of your body.", youtube:"https://www.youtube.com/watch?v=taI4XduLpTk", photo:"images/oefeningen/cable-crossover.jpg"},
    { id:"ex-dpo", name:"Dumbbell Pullover", icon:"🔄", sets:3, reps:"10-12", rest:"75 sec", tip:"Lig dwars op de bank en houd één dumbbell met beide handen vast. Laat hem in een boog achter je hoofd zakken, ellebogen licht gebogen.", tip_en:"Lie across the bench holding one dumbbell with both hands. Lower it in an arc behind your head with slightly bent elbows.", youtube:"https://www.youtube.com/watch?v=wveUmKmIBcI", photo:"images/oefeningen/dumbbell-pullover.jpg"},
    { id:"ex-kpu", name:"Knee Push-ups", icon:"🤸", sets:3, reps:"10-15", rest:"60 sec", tip:"Zoals een gewone push-up, maar op je knieën. Houd je lichaam recht van knieën tot schouders.", tip_en:"Like a regular push-up, but on your knees. Keep your body in a straight line from knees to shoulders.", youtube:"https://www.youtube.com/watch?v=1nAsgpufzhc", photo:"images/oefeningen/knee-push-ups.jpg"},
    { id:"ex-lmp", name:"Landmine Press", icon:"💥", sets:3, reps:"10", rest:"60 sec", tip:"Zet het uiteinde van de stang in een landmine-houder of hoek. Duw het schuin omhoog vanaf je schouder.", tip_en:"Anchor one end of the bar in a landmine holder or corner. Press the other end up and forward from your shoulder.", youtube:"https://www.youtube.com/watch?v=3gYz0bLG-wY", photo:"images/oefeningen/landmine-press.jpg"},
  ]},
  { group:'Rug', group_en:'Back', icon:'🎿', color:'#553c9a', exercises:[
    { id:'ex-dr',   name:'Dumbbell Row',         icon:'🎿', sets:3, reps:'10-12', rest:'75 sec', youtube:'https://www.youtube.com/watch?v=pYcpY20QaE8', photo:'images/oefeningen/dumbbell-row.jpg'},
    { id:'ex-br',   name:'Barbell Row',          icon:'🏋️', sets:3, reps:'8-10', rest:'90 sec', youtube:'https://www.youtube.com/watch?v=FWJR5Ve8bnQ', photo:'images/oefeningen/barbell-row.jpg'},
    { id:'ex-pul',  name:'Pull-ups',             icon:'🤸', sets:3, reps:'6-10', rest:'90 sec', youtube:'https://www.youtube.com/watch?v=eGo4IYlbE5g', photo:'images/oefeningen/pull-ups.jpg'},
    { id:'ex-chu',  name:'Chin-ups',             icon:'🤸', sets:3, reps:'6-10', rest:'90 sec', youtube:'https://www.youtube.com/watch?v=brhRXlOhsAM', photo:'images/oefeningen/chin-up.png'},
    { id:'ex-ld',   name:'Lat Pulldown',         icon:'⬇️', sets:3, reps:'10-12', rest:'75 sec', youtube:'https://www.youtube.com/watch?v=CAwf7n6Luuc', photo:'images/oefeningen/lat-pulldown.jpg'},
    { id:'ex-scr',  name:'Seated Cable Row',     icon:'🔗', sets:3, reps:'10-12', rest:'75 sec', youtube:'https://www.youtube.com/watch?v=GZbfZ033f74', photo:'images/oefeningen/seated-cable-row.jpg'},
    { id:'ex-bext', name:'Back Extension',       icon:'🏋️', sets:3, reps:'12-15', rest:'60 sec', youtube:'https://www.youtube.com/watch?v=ph3pddpKzzw', photo:'images/oefeningen/back-extension.jpg'},
    { id:"ex-tbr", name:"T-Bar Row", icon:"🚣", sets:3, reps:"8-10", rest:"90 sec", tip:"Heupen naar achteren, rug recht. Trek het gewicht naar je onderbuik en knijp je schouderbladen samen.", tip_en:"Hinge at the hips with a flat back. Pull the weight to your lower stomach and squeeze your shoulder blades together.", youtube:"https://www.youtube.com/results?search_query=T-Bar%20Row%20proper%20form", photo:"images/oefeningen/t-bar-row.jpg"},
    { id:"ex-sacr", name:"Single-arm Cable Row", icon:"🔗", sets:3, reps:"10-12 per arm", rest:"60 sec", tip:"Trek de kabel naar je heup en houd je romp stil. Evenveel herhalingen aan beide kanten.", tip_en:"Pull the cable to your hip and keep your torso still. Same number of reps on both sides.", youtube:"https://www.youtube.com/results?search_query=Single-arm%20Cable%20Row%20proper%20form", photo:"images/oefeningen/single-arm-cable-row.jpg"},
    { id:"ex-sapd", name:"Straight-arm Pulldown", icon:"⬇️", sets:3, reps:"12-15", rest:"60 sec", tip:"Armen bijna gestrekt. Duw de stang in een boog naar je bovenbenen; de beweging komt uit je rugspieren.", tip_en:"Arms almost straight. Push the bar down in an arc to your thighs; the movement comes from your lats.", youtube:"https://www.youtube.com/results?search_query=Straight-arm%20Pulldown%20proper%20form", photo:"images/oefeningen/straight-arm-pulldown.jpg"},
    { id:"ex-csr", name:"Chest-supported Row", icon:"🎿", sets:3, reps:"10-12", rest:"75 sec", tip:"Borst tegen het kussen. Trek de gewichten naar je ribben en houd je nek ontspannen.", tip_en:"Chest against the pad. Pull the weights to your ribs and keep your neck relaxed.", youtube:"https://www.youtube.com/results?search_query=Chest-supported%20Row%20proper%20form", photo:"images/oefeningen/chest-supported-row.jpg"},
    { id:"ex-ir", name:"Inverted Row", icon:"↔️", sets:3, reps:"8-12", rest:"75 sec", tip:"Lichaam in een rechte lijn onder een stang. Trek je borst naar de stang toe.", tip_en:"Body in a straight line under a bar. Pull your chest up to the bar.", youtube:"https://www.youtube.com/results?search_query=Inverted%20Row%20proper%20form", photo:"images/oefeningen/inverted-row.jpg"},
    { id:"ex-gm", name:"Good Morning", icon:"🌅", sets:3, reps:"10-12", rest:"75 sec", tip:"Stang op je schouders, knieën licht gebogen. Buig vanuit je heupen voorover met een rechte rug.", tip_en:"Bar on your shoulders, knees slightly bent. Hinge forward from the hips with a flat back.", youtube:"https://www.youtube.com/results?search_query=Good%20Morning%20proper%20form", photo:"images/oefeningen/good-morning.jpg"},
    { id:"ex-rp", name:"Rack Pull", icon:"🏗️", sets:3, reps:"6-8", rest:"120 sec", tip:"Deadlift vanaf een verhoogde positie. Rug recht en het gewicht dicht bij je lichaam.", tip_en:"A deadlift from an elevated start. Keep your back flat and the bar close to your body.", youtube:"https://www.youtube.com/results?search_query=Rack%20Pull%20proper%20form", photo:"images/oefeningen/rack-pull.jpg"},
    { id:"ex-mr", name:"Meadows Row", icon:"🧲", sets:3, reps:"8-10 per arm", rest:"75 sec", tip:"Eén kant van de stang in een landmine-houder. Sta zijwaarts en trek de stang naar je heup.", tip_en:"One end of the bar anchored in a landmine. Stand side-on and pull the bar to your hip.", youtube:"https://www.youtube.com/results?search_query=Meadows%20Row%20proper%20form", photo:"images/oefeningen/meadows-row.jpg"},
  ]},
  { group:'Schouders', group_en:'Shoulders', icon:'🙌', color:'#97266d', exercises:[
    { id:'ex-ohp',  name:'Overhead Press',       icon:'🙌', sets:3, reps:'8-10', rest:'90 sec', youtube:'https://www.youtube.com/watch?v=2yjwXTZQDDI', photo:'images/oefeningen/overhead-press.jpg'},
    { id:'ex-dsp',  name:'Dumbbell Shoulder Press', icon:'💪', sets:3, reps:'10-12', rest:'75 sec', youtube:'https://www.youtube.com/watch?v=B-aVuyhvLHU', photo:'images/oefeningen/dumbbell-shoulder-press.jpg'},
    { id:'ex-sbp',  name:'Shoulder Bench Press',icon:'🏋️', sets:4, reps:'8-10', rest:'90 sec', youtube:'https://www.youtube.com/watch?v=Wqnal9E2RYI', photo:'images/oefeningen/shoulder-bench-press.jpg'},
    { id:'ex-lr',   name:'Lateral Raises',       icon:'↔️', sets:3, reps:'12-15', rest:'60 sec', youtube:'https://www.youtube.com/watch?v=3VcKaXpzqRo', photo:'images/oefeningen/lateral-raises.jpg'},
    { id:'ex-fp',   name:'Face Pull',            icon:'🎯', sets:3, reps:'15', rest:'60 sec', youtube:'https://www.youtube.com/watch?v=rep-qVOkqgk', photo:'images/oefeningen/face-pull.jpg'},
    { id:'ex-rf',   name:'Reverse Fly',          icon:'🦋', sets:3, reps:'15', rest:'60 sec', youtube:'https://www.youtube.com/watch?v=Pq-mQ76-VWg', photo:'images/oefeningen/reverse-fly.jpg'},
    { id:"ex-ap", name:"Arnold Press", icon:"🙌", sets:3, reps:"8-12", rest:"75 sec", tip:"Begin met handpalmen naar je toe en draai ze tijdens het drukken naar voren.", tip_en:"Start with palms facing you and rotate them forward as you press.", youtube:"https://www.youtube.com/results?search_query=Arnold%20Press%20proper%20form", photo:"images/oefeningen/arnold-press.jpg"},
    { id:"ex-fr", name:"Front Raise", icon:"⬆️", sets:3, reps:"10-12", rest:"60 sec", tip:"Til de dumbbells gestrekt voor je op tot schouderhoogte, zonder te zwaaien.", tip_en:"Raise the dumbbells straight in front of you to shoulder height without swinging.", youtube:"https://www.youtube.com/results?search_query=Front%20Raise%20proper%20form", photo:"images/oefeningen/front-raise.jpg"},
    { id:"ex-clr", name:"Cable Lateral Raise", icon:"↗️", sets:3, reps:"12-15", rest:"60 sec", tip:"Til de kabel zijwaarts tot schouderhoogte, elleboog licht gebogen.", tip_en:"Raise the cable out to the side to shoulder height with a slightly bent elbow.", youtube:"https://www.youtube.com/results?search_query=Cable%20Lateral%20Raise%20proper%20form", photo:"images/oefeningen/cable-lateral-raise.jpg"},
    { id:"ex-msp", name:"Machine Shoulder Press", icon:"⚙️", sets:3, reps:"10-12", rest:"75 sec", tip:"Stel de zitting in en duw de handvaten rustig boven je hoofd.", tip_en:"Adjust the seat and press the handles smoothly overhead.", youtube:"https://www.youtube.com/results?search_query=Machine%20Shoulder%20Press%20proper%20form", photo:"images/oefeningen/machine-shoulder-press.jpg"},
    { id:"ex-pp", name:"Pike Push-up", icon:"🔺", sets:3, reps:"8-12", rest:"60 sec", tip:"Heupen hoog in een omgekeerde V. Laat je hoofd naar de grond zakken en duw terug.", tip_en:"Hips high in an inverted V. Lower your head toward the floor and press back up.", youtube:"https://www.youtube.com/results?search_query=Pike%20Push-up%20proper%20form", photo:"images/oefeningen/pike-push-up.jpg"},
  ]},
  { group:'Benen', group_en:'Legs', icon:'🦵', color:'#2c5282', exercises:[
    { id:'ex-sqbw', name:'Squats',               icon:'🦵', sets:3, reps:'15-20', rest:'60 sec', youtube:'https://www.youtube.com/watch?v=aclHkVaku9U', photo:'images/oefeningen/squats.jpg'},
    { id:'ex-sq',   name:'Barbell Squat',        icon:'🏋️', sets:4, reps:'8-10', rest:'90 sec', youtube:'https://www.youtube.com/watch?v=ultWZbUMPL8', photo:'images/oefeningen/barbell-squat.jpg'},
    { id:'ex-dbsq', name:'Dumbbell Squat',       icon:'🏋️', sets:3, reps:'12-15', rest:'75 sec', youtube:'https://www.youtube.com/watch?v=U4pFSHFdDQc', photo:'images/oefeningen/dumbbell-squat.jpg'},
    { id:'ex-gs',   name:'Goblet Squat',         icon:'🏋️', sets:3, reps:'10-12', rest:'75 sec', youtube:'https://www.youtube.com/watch?v=MxsFDhcyFyE', photo:'images/oefeningen/goblet-squat.jpg'},
    { id:'ex-lp',   name:'Leg Press',            icon:'🦵', sets:3, reps:'10-12', rest:'90 sec', youtube:'https://www.youtube.com/watch?v=IZxyjW7MPJQ', photo:'images/oefeningen/leg-press.jpg'},
    { id:'ex-lun',  name:'Lunges',               icon:'🚶', sets:3, reps:'12/been', rest:'75 sec', youtube:'https://www.youtube.com/watch?v=QOVaHwm-Q6U', photo:'images/oefeningen/lunges.jpg'},
    { id:'ex-dblun',name:'Dumbbell Lunges',      icon:'🚶', sets:3, reps:'12/been', rest:'75 sec', youtube:'https://www.youtube.com/watch?v=D7KaRcUTQeE', photo:'images/oefeningen/dumbbell-lunges.jpg'},
    { id:'ex-rdl',  name:'Romanian Deadlift',    icon:'🦵', sets:3, reps:'10-12', rest:'90 sec', youtube:'https://www.youtube.com/watch?v=JCXUYuzwNrM', photo:'images/oefeningen/romanian-deadlift.jpg'},
    { id:'ex-lc',   name:'Leg Curl (machine)',   icon:'🦵', sets:3, reps:'12-15', rest:'60 sec', youtube:'https://www.youtube.com/watch?v=1Tq3QdYUuHs', photo:'images/oefeningen/leg-curl-machine.jpg'},
    { id:"ex-bss", name:"Bulgarian Split Squat", icon:"🇧🇬", sets:3, reps:"8-10 per been", rest:"90 sec", tip:"Achterste voet op een bank. Zak recht naar beneden met je romp rechtop.", tip_en:"Rear foot on a bench. Lower straight down with an upright torso.", youtube:"https://www.youtube.com/results?search_query=Bulgarian%20Split%20Squat%20proper%20form", photo:"images/oefeningen/bulgarian-split-squat.jpg"},
    { id:"ex-le", name:"Leg Extension", icon:"🦵", sets:3, reps:"12-15", rest:"60 sec", tip:"Strek je benen gecontroleerd en houd bovenaan kort vast.", tip_en:"Extend your legs under control and hold briefly at the top.", youtube:"https://www.youtube.com/results?search_query=Leg%20Extension%20proper%20form", photo:"images/oefeningen/leg-extension.jpg"},
    { id:"ex-slc", name:"Seated Leg Curl", icon:"🦵", sets:3, reps:"12-15", rest:"60 sec", tip:"Trek je hielen naar je billen en laat gecontroleerd terugkomen.", tip_en:"Pull your heels toward your glutes and return under control.", youtube:"https://www.youtube.com/results?search_query=Seated%20Leg%20Curl%20proper%20form", photo:"images/oefeningen/seated-leg-curl.jpg"},
    { id:"ex-wl", name:"Walking Lunges", icon:"🚶", sets:3, reps:"10 per been", rest:"75 sec", tip:"Maak grote stappen, knie boven je enkel en romp rechtop.", tip_en:"Take long steps, keep your knee over your ankle and your torso upright.", youtube:"https://www.youtube.com/results?search_query=Walking%20Lunges%20proper%20form", photo:"images/oefeningen/walking-lunges.jpg"},
    { id:"ex-su", name:"Step-ups", icon:"🪜", sets:3, reps:"10 per been", rest:"60 sec", tip:"Zet je hele voet op de verhoging en duw jezelf omhoog met het voorste been.", tip_en:"Place your whole foot on the step and drive up with the front leg.", youtube:"https://www.youtube.com/results?search_query=Step-ups%20proper%20form", photo:"images/oefeningen/step-ups.jpg"},
    { id:"ex-hs", name:"Hack Squat", icon:"🏋️", sets:3, reps:"8-12", rest:"90 sec", tip:"Rug tegen het kussen, voeten iets naar voren. Zak tot je bovenbenen evenwijdig aan de grond zijn.", tip_en:"Back against the pad, feet slightly forward. Lower until your thighs are parallel to the floor.", youtube:"https://www.youtube.com/results?search_query=Hack%20Squat%20proper%20form", photo:"images/oefeningen/hack-squat.jpg"},
    { id:"ex-fs", name:"Front Squat", icon:"🏋️", sets:3, reps:"6-10", rest:"90 sec", tip:"Stang op je voorste schouders, ellebogen hoog. Houd je romp zo rechtop mogelijk.", tip_en:"Bar on your front shoulders, elbows high. Keep your torso as upright as possible.", youtube:"https://www.youtube.com/results?search_query=Front%20Squat%20proper%20form", photo:"images/oefeningen/front-squat.jpg"},
    { id:"ex-rl", name:"Reverse Lunge", icon:"↩️", sets:3, reps:"10 per been", rest:"75 sec", tip:"Stap naar achteren en zak recht naar beneden. Duw je terug met het voorste been.", tip_en:"Step back and lower straight down. Drive back up with the front leg.", youtube:"https://www.youtube.com/results?search_query=Reverse%20Lunge%20proper%20form", photo:"images/oefeningen/reverse-lunge.jpg"},
    { id:"ex-ss", name:"Sumo Squat", icon:"🦵", sets:3, reps:"12-15", rest:"75 sec", tip:"Voeten breed, tenen naar buiten. Zak diep met een dumbbell tussen je benen.", tip_en:"Wide stance, toes out. Squat deep holding a dumbbell between your legs.", youtube:"https://www.youtube.com/results?search_query=Sumo%20Squat%20proper%20form", photo:"images/oefeningen/sumo-squat.jpg"},
    { id:"ex-ws", name:"Wall Sit", icon:"🧱", sets:3, reps:"30-60 sec", rest:"60 sec", tip:"Rug tegen de muur, knieën in 90°. Houd de positie vast.", tip_en:"Back against the wall, knees at 90°. Hold the position.", youtube:"https://www.youtube.com/results?search_query=Wall%20Sit%20proper%20form", photo:"images/oefeningen/wall-sit.jpg"},
  ]},
  { group:'Core', group_en:'Core', icon:'🎯', color:'#c05621', exercises:[
    { id:'ex-pl',   name:'Plank',                icon:'🎯', sets:3, reps:'45 sec', rest:'45 sec', youtube:'https://www.youtube.com/watch?v=ASdvN_XEl_c', photo:'images/oefeningen/plank.jpg'},
    { id:'ex-spl',  name:'Side Plank',           icon:'↕️', sets:3, reps:'30 sec', rest:'45 sec', youtube:'https://www.youtube.com/watch?v=K2iEFHkuCHM', photo:'images/oefeningen/side-plank.jpg'},
    { id:'ex-cr',   name:'Crunches',             icon:'🔄', sets:3, reps:'20', rest:'45 sec', youtube:'https://www.youtube.com/watch?v=Xyd_fa5zoEU', photo:'images/oefeningen/crunches.jpg'},
    { id:'ex-aw',   name:'Ab Wheel',             icon:'⚙️', sets:3, reps:'8-10', rest:'60 sec', youtube:'https://www.youtube.com/watch?v=vGFQeQ8YkQ4', photo:'images/oefeningen/ab-wheel.jpg'},
    { id:'ex-db',   name:'Dead Bug',             icon:'🐛', sets:3, reps:'8/kant', rest:'45 sec', youtube:'https://www.youtube.com/watch?v=SdDPV3zZRUU', photo:'images/oefeningen/dead-bug.jpg'},
    { id:'ex-abs',  name:'Serie abs exercises',  name_en:'Abs circuit', icon:'🔥', sets:3, reps:'circuit', rest:'60 sec', youtube:'https://www.youtube.com/watch?v=Xyd_fa5zoEU', photo:'images/oefeningen/serie-abs-exercises.jpg'},
    { id:'ex-lr2',  name:'Leg Raises',           icon:'🦵', sets:3, reps:'15', rest:'45 sec', youtube:'https://www.youtube.com/watch?v=l4kQd9eWclE', photo:'images/oefeningen/leg-raises.jpg'},
    { id:'ex-bc2',  name:'Bicycle Crunches',     icon:'🚴', sets:3, reps:'20', rest:'45 sec', youtube:'https://www.youtube.com/watch?v=9FGilxCbdz8', photo:'images/oefeningen/bicycle-crunches.jpg'},
    { id:'ex-rt',   name:'Russian Twist',        icon:'🔄', sets:3, reps:'20', rest:'45 sec', youtube:'https://www.youtube.com/watch?v=wkD8rjkodUI', photo:'images/oefeningen/russian-twist.jpg'},
    { id:'ex-mc',   name:'Mountain Climbers',    icon:'🧗', sets:3, reps:'30 sec', rest:'45 sec', youtube:'https://www.youtube.com/watch?v=nmwgirgXLYM', photo:'images/oefeningen/mountain-climbers.jpg'},
    { id:'ex-hkr',  name:'Hanging Knee Raises',  icon:'🤸', sets:3, reps:'12-15', rest:'60 sec', youtube:'https://www.youtube.com/watch?v=Pr1ieGZ5atk', photo:'images/oefeningen/hanging-knee-raises.jpg'},
    { id:'ex-fk',   name:'Flutter Kicks',        icon:'🦵', sets:3, reps:'30 sec', rest:'45 sec', youtube:'https://www.youtube.com/watch?v=ANVdMDaYRts', photo:'images/oefeningen/flutter-kicks.jpg'},
    { id:'ex-vup',  name:'V-ups',                icon:'✌️', sets:3, reps:'15', rest:'45 sec', youtube:'https://www.youtube.com/watch?v=iP2fjvG0g3w', photo:'images/oefeningen/v-ups.jpg'},
    { id:"ex-hh", name:"Hollow Hold", icon:"🌙", sets:3, reps:"20-30 sec", rest:"45 sec", tip:"Lig op je rug, til schouders en benen licht op en druk je onderrug in de grond.", tip_en:"Lie on your back, lift your shoulders and legs slightly and press your lower back into the floor.", youtube:"https://www.youtube.com/results?search_query=Hollow%20Hold%20proper%20form", photo:"images/oefeningen/hollow-hold.jpg"},
    { id:"ex-pall", name:"Pallof Press", icon:"🧲", sets:3, reps:"10 per kant", rest:"45 sec", tip:"Sta zijwaarts aan de kabel. Duw je handen naar voren en laat je romp niet meedraaien.", tip_en:"Stand side-on to the cable. Press your hands forward and resist rotation.", youtube:"https://www.youtube.com/results?search_query=Pallof%20Press%20proper%20form", photo:"images/oefeningen/pallof-press.jpg"},
    { id:"ex-cc", name:"Cable Crunch", icon:"🔗", sets:3, reps:"12-15", rest:"60 sec", tip:"Knielend aan de kabel. Rol je romp omlaag en span je buik aan.", tip_en:"Kneel at the cable. Curl your torso down and tighten your abs.", youtube:"https://www.youtube.com/results?search_query=Cable%20Crunch%20proper%20form", photo:"images/oefeningen/cable-crunch.jpg"},
    { id:"ex-bd", name:"Bird Dog", icon:"🐦", sets:3, reps:"10 per kant", rest:"45 sec", tip:"Op handen en knieën. Strek tegenovergestelde arm en been en houd je rug vlak.", tip_en:"On all fours. Extend the opposite arm and leg and keep your back flat.", youtube:"https://www.youtube.com/results?search_query=Bird%20Dog%20proper%20form", photo:"images/oefeningen/bird-dog.jpg"},
    { id:"ex-tt", name:"Toe Touches", icon:"🦶", sets:3, reps:"15", rest:"45 sec", tip:"Lig op je rug met gestrekte benen omhoog. Til je schouders op en reik naar je tenen.", tip_en:"Lie on your back with legs up. Lift your shoulders and reach for your toes.", youtube:"https://www.youtube.com/results?search_query=Toe%20Touches%20proper%20form", photo:"images/oefeningen/toe-touches.jpg"},
    { id:"ex-rc", name:"Reverse Crunch", icon:"🔄", sets:3, reps:"12-15", rest:"45 sec", tip:"Trek je knieën naar je borst en til je billen licht op, zonder te zwaaien.", tip_en:"Pull your knees to your chest and lift your hips slightly, without swinging.", youtube:"https://www.youtube.com/results?search_query=Reverse%20Crunch%20proper%20form", photo:"images/oefeningen/reverse-crunch.jpg"},
    { id:"ex-sit", name:"Sit-ups", icon:"⬆️", sets:3, reps:"15-20", rest:"45 sec", tip:"Rol je romp gecontroleerd omhoog en trek niet aan je nek.", tip_en:"Curl your torso up under control and do not pull on your neck.", youtube:"https://www.youtube.com/results?search_query=Sit-ups%20proper%20form", photo:"images/oefeningen/sit-ups.jpg"},
    { id:"ex-wwi", name:"Windshield Wipers", icon:"🚗", sets:3, reps:"10 per kant", rest:"60 sec", tip:"Lig op je rug met je benen omhoog. Laat ze als een ruitenwisser van links naar rechts zakken.", tip_en:"Lie on your back with your legs up. Lower them side to side like windshield wipers.", youtube:"https://www.youtube.com/results?search_query=Windshield%20Wipers%20proper%20form"},
    { id:"ex-lsit", name:"L-sit", icon:"🅻", sets:3, reps:"10-20 sec", rest:"60 sec", tip:"Steun op je handen of parallelle stangen, benen gestrekt voor je. Houd vast.", tip_en:"Support yourself on your hands or parallel bars with your legs straight in front. Hold.", youtube:"https://www.youtube.com/results?search_query=L-sit%20proper%20form"},
    { id:"ex-sup", name:"Superman", icon:"🦸", sets:3, reps:"12", rest:"45 sec", tip:"Lig op je buik, til armen en benen tegelijk op en houd even vast.", tip_en:"Lie on your stomach, lift your arms and legs at the same time and hold briefly.", youtube:"https://www.youtube.com/results?search_query=Superman%20proper%20form", photo:"images/oefeningen/superman.jpg"},
  ]},
  { group:'Full body', group_en:'Full body', icon:'🔑', color:'#276749', exercises:[
    { id:'ex-dl',   name:'Deadlift',             icon:'🔑', sets:4, reps:'4-6', rest:'3 min', youtube:'https://www.youtube.com/watch?v=op9kVnSso6Q', photo:'images/oefeningen/deadlift.jpg'},
    { id:'ex-fc',   name:'Farmer Carry',         icon:'🧳', sets:3, reps:'40m', rest:'90 sec', youtube:'https://www.youtube.com/watch?v=rt17lmnaLSM', photo:'images/oefeningen/farmer-carry.jpg'},
    { id:'ex-ke',   name:'Kettlebell Swing',     icon:'🫙', sets:3, reps:'15', rest:'60 sec', youtube:'https://www.youtube.com/watch?v=YSxHifyI6s8', photo:'images/oefeningen/kettlebell-swing.jpg'},
    { id:'ex-bc',   name:'Burpees',              icon:'💥', sets:3, reps:'10', rest:'60 sec', youtube:'https://www.youtube.com/watch?v=TU8QYVW0gDU', photo:'images/oefeningen/burpees.jpg'},
    { id:'ex-grip', name:'Handtrainer',          name_en:'Grip trainer', icon:'✊', sets:3, reps:'20/hand', rest:'45 sec', youtube:'https://www.youtube.com/watch?v=o4wQ0XiGOkg', photo:'images/oefeningen/handtrainer.jpg'},
    { id:"ex-thr", name:"Thruster", icon:"🚀", sets:3, reps:"8-10", rest:"90 sec", tip:"Squat met het gewicht op je schouders en duw het gewicht bij het opstaan boven je hoofd.", tip_en:"Squat with the weight at your shoulders and press it overhead as you stand.", youtube:"https://www.youtube.com/results?search_query=Thruster%20proper%20form", photo:"images/oefeningen/thruster.jpg"},
    { id:"ex-bj", name:"Box Jump", icon:"📦", sets:3, reps:"6-8", rest:"90 sec", tip:"Spring met beide voeten op de box en land zacht. Stap erna terug.", tip_en:"Jump onto the box with both feet and land softly. Step back down.", youtube:"https://www.youtube.com/results?search_query=Box%20Jump%20proper%20form", photo:"images/oefeningen/box-jump.jpg"},
    { id:"ex-bro", name:"Battle Ropes", icon:"🪢", sets:3, reps:"30 sec", rest:"60 sec", tip:"Half gehurkt, laat de touwen afwisselend of tegelijk golven maken.", tip_en:"In a half squat, make waves with the ropes, alternating or together.", youtube:"https://www.youtube.com/results?search_query=Battle%20Ropes%20proper%20form", photo:"images/oefeningen/battle-ropes.jpg"},
    { id:"ex-mbs", name:"Medicine Ball Slam", icon:"💥", sets:3, reps:"10-12", rest:"60 sec", tip:"Til de bal boven je hoofd en gooi hem met kracht naar de grond.", tip_en:"Lift the ball overhead and slam it into the floor with force.", youtube:"https://www.youtube.com/results?search_query=Medicine%20Ball%20Slam%20proper%20form", photo:"images/oefeningen/medicine-ball-slam.jpg"},
    { id:"ex-cap", name:"Clean and Press", icon:"🏋️", sets:3, reps:"6-8", rest:"90 sec", tip:"Trek de stang van de grond naar je schouders en duw hem boven je hoofd.", tip_en:"Pull the bar from the floor to your shoulders and press it overhead.", youtube:"https://www.youtube.com/results?search_query=Clean%20and%20Press%20proper%20form", photo:"images/oefeningen/clean-and-press.jpg"},
    { id:"ex-tgu", name:"Turkish Get-up", icon:"🧎", sets:3, reps:"3-5 per kant", rest:"90 sec", tip:"Sta op vanuit liggen met een gewicht boven je hoofd. Rustig en gecontroleerd.", tip_en:"Stand up from lying down with a weight overhead. Slow and controlled.", youtube:"https://www.youtube.com/results?search_query=Turkish%20Get-up%20proper%20form", photo:"images/oefeningen/turkish-get-up.jpg"},
    { id:"ex-sp", name:"Sled Push", icon:"🛷", sets:3, reps:"20 m", rest:"90 sec", tip:"Leun voorover, armen gestrekt en duw de slee met korte, krachtige stappen.", tip_en:"Lean forward with straight arms and push the sled with short, powerful steps.", youtube:"https://www.youtube.com/results?search_query=Sled%20Push%20proper%20form", photo:"images/oefeningen/sled-push.jpg"},
    { id:"ex-bcr", name:"Bear Crawl", icon:"🐻", sets:3, reps:"20 m", rest:"60 sec", tip:"Op handen en voeten met de knieën net boven de grond, kruip vooruit.", tip_en:"On hands and feet with knees just off the floor, crawl forward.", youtube:"https://www.youtube.com/results?search_query=Bear%20Crawl%20proper%20form", photo:"images/oefeningen/bear-crawl.jpg"},
    { id:"ex-jj", name:"Jumping Jacks", icon:"🤸", sets:3, reps:"30 sec", rest:"30 sec", tip:"Spring met armen en benen tegelijk uit elkaar en weer samen.", tip_en:"Jump your arms and legs out and together at the same time.", youtube:"https://www.youtube.com/results?search_query=Jumping%20Jacks%20proper%20form", photo:"images/oefeningen/jumping-jacks.jpg"},
    { id:"ex-sc", name:"Sandbag Carry", icon:"🎒", sets:3, reps:"20 m", rest:"60 sec", tip:"Draag de zandzak tegen je borst of op je schouder met een rechte rug.", tip_en:"Carry the sandbag against your chest or on your shoulder with a straight back.", youtube:"https://www.youtube.com/results?search_query=Sandbag%20Carry%20proper%20form", photo:"images/oefeningen/sandbag-carry.jpg"},
  ]},
  { group:'Biceps', group_en:'Biceps', icon:'💪', color:'#b7791f', exercises:[
    { id:'ex-bbc',  name:'Barbell Curl',          icon:'💪', sets:3, reps:'10-12', rest:'60 sec', youtube:'https://www.youtube.com/watch?v=kwG2ipFRgfo', photo:'images/oefeningen/barbell-curl.jpg'},
    { id:'ex-dbc',  name:'Dumbbell Curl',          icon:'💪', sets:3, reps:'10-12', rest:'60 sec', youtube:'https://www.youtube.com/watch?v=ykJmrZ5v0Oo', photo:'images/oefeningen/dumbbell-curl.jpg'},
    { id:'ex-hac',  name:'Hammer Curl',            icon:'🔨', sets:3, reps:'10-12', rest:'60 sec', youtube:'https://www.youtube.com/watch?v=zC3nLlEvin4', photo:'images/oefeningen/hammer-curl.jpg'},
    { id:'ex-prc',  name:'Preacher Curl',          icon:'💪', sets:3, reps:'10-12', rest:'60 sec', youtube:'https://www.youtube.com/watch?v=fIWP-FRFNU0', photo:'images/oefeningen/preacher-curl.jpg'},
    { id:'ex-cac',  name:'Cable Curl',             icon:'🔗', sets:3, reps:'12-15', rest:'60 sec', youtube:'https://www.youtube.com/watch?v=NFzTWp2qpiE', photo:'images/oefeningen/cable-curl.jpg'},
    { id:'ex-conc', name:'Concentration Curl',     icon:'💪', sets:3, reps:'12/arm', rest:'45 sec', youtube:'https://www.youtube.com/watch?v=0AUGkch3tzc', photo:'images/oefeningen/concentration-curl.jpg'},
    { id:"ex-idc", name:"Incline Dumbbell Curl", icon:"💪", sets:3, reps:"10-12", rest:"60 sec", tip:"Op een schuine bank laat je de armen hangen. Curl omhoog zonder je schouders te bewegen.", tip_en:"On an incline bench let your arms hang. Curl up without moving your shoulders.", youtube:"https://www.youtube.com/results?search_query=Incline%20Dumbbell%20Curl%20proper%20form", photo:"images/oefeningen/incline-dumbbell-curl.jpg"},
    { id:"ex-ezc", name:"EZ-bar Curl", icon:"💪", sets:3, reps:"10-12", rest:"60 sec", tip:"Grip op de gebogen stang. Curl omhoog met de ellebogen langs je lichaam.", tip_en:"Grip the EZ bar. Curl up with your elbows tucked at your sides.", youtube:"https://www.youtube.com/results?search_query=EZ-bar%20Curl%20proper%20form", photo:"images/oefeningen/ez-bar-curl.jpg"},
    { id:"ex-spc", name:"Spider Curl", icon:"🕷️", sets:3, reps:"10-12", rest:"60 sec", tip:"Lig met je borst op een schuine bank en curl met hangende armen.", tip_en:"Lie chest-down on an incline bench and curl with hanging arms.", youtube:"https://www.youtube.com/results?search_query=Spider%20Curl%20proper%20form", photo:"images/oefeningen/spider-curl.jpg"},
    { id:"ex-zc", name:"Zottman Curl", icon:"🔁", sets:3, reps:"8-10", rest:"60 sec", tip:"Curl omhoog met handpalmen naar boven, draai bovenaan en laat omlaag met handpalmen naar beneden.", tip_en:"Curl up with palms up, rotate at the top and lower with palms down.", youtube:"https://www.youtube.com/results?search_query=Zottman%20Curl%20proper%20form", photo:"images/oefeningen/zottman-curl.jpg"},
    { id:"ex-revc", name:"Reverse Curl", icon:"🔄", sets:3, reps:"10-12", rest:"60 sec", tip:"Grip met handpalmen naar beneden. Curl omhoog; dit traint ook je onderarmen.", tip_en:"Overhand grip. Curl up; this also trains your forearms.", youtube:"https://www.youtube.com/results?search_query=Reverse%20Curl%20proper%20form", photo:"images/oefeningen/reverse-curl.jpg"},
  ]},
  { group:'Triceps', group_en:'Triceps', icon:'💥', color:'#9b2c2c', exercises:[
    { id:'ex-tpd',  name:'Tricep Pushdown',        icon:'⬇️', sets:3, reps:'12-15', rest:'60 sec', youtube:'https://www.youtube.com/watch?v=2-LAMcpzODU', photo:'images/oefeningen/tricep-pushdown.jpg'},
    { id:'ex-skc',  name:'Skull Crushers',         icon:'💀', sets:3, reps:'10-12', rest:'75 sec', youtube:'https://www.youtube.com/watch?v=d_KZxkY_0cM', photo:'images/oefeningen/skull-crushers.jpg'},
    { id:'ex-dip1', name:'Dips 1 (bank)',           icon:'🤸', sets:3, reps:'12-15', rest:'60 sec', youtube:'https://www.youtube.com/watch?v=0326dy_-CzM', photo:'images/oefeningen/dips-1-bank.jpg'},
    { id:'ex-dip2', name:'Dips 2 (parallel bars)', icon:'🤸', sets:3, reps:'8-12', rest:'75 sec', youtube:'https://www.youtube.com/watch?v=wjUmnZH528Y', photo:'images/oefeningen/dips-2-parallel-bars.jpg'},
    { id:'ex-ote',  name:'Overhead Tricep Extension', icon:'🙌', sets:3, reps:'12-15', rest:'60 sec', youtube:'https://www.youtube.com/watch?v=YbX7Wd8jQ-Q', photo:'images/oefeningen/overhead-tricep-extension.jpg'},
    { id:'ex-cgbp', name:'Close Grip Bench Press', icon:'🏋️', sets:3, reps:'8-10', rest:'90 sec', youtube:'https://www.youtube.com/watch?v=nEF0bv2FW94', photo:'images/oefeningen/close-grip-bench-press.jpg'},
    { id:'ex-kbk',  name:'Kickbacks',              icon:'💪', sets:3, reps:'12-15', rest:'45 sec', youtube:'https://www.youtube.com/watch?v=6SS6K3lAwZ8', photo:'images/oefeningen/kickbacks.jpg'},
    { id:"ex-dpu", name:"Diamond Push-ups", icon:"💎", sets:3, reps:"8-12", rest:"60 sec", tip:"Handen onder je borst met duimen en wijsvingers tegen elkaar. Ellebogen langs je lichaam.", tip_en:"Hands under your chest with thumbs and index fingers touching. Keep your elbows close to your body.", youtube:"https://www.youtube.com/results?search_query=Diamond%20Push-ups%20proper%20form", photo:"images/oefeningen/diamond-push-ups.jpg"},
    { id:"ex-coe", name:"Cable Overhead Extension", icon:"🔗", sets:3, reps:"12-15", rest:"60 sec", tip:"Kabel achter je hoofd; strek je armen boven je hoofd en houd je ellebogen stil.", tip_en:"Cable behind your head; extend your arms overhead and keep your elbows still.", youtube:"https://www.youtube.com/results?search_query=Cable%20Overhead%20Extension%20proper%20form", photo:"images/oefeningen/cable-overhead-extension.jpg"},
    { id:"ex-sapush", name:"Single-arm Pushdown", icon:"⬇️", sets:3, reps:"12-15 per arm", rest:"60 sec", tip:"Duw de kabel met één hand omlaag, elleboog langs je lichaam.", tip_en:"Push the cable down with one hand, elbow tucked at your side.", youtube:"https://www.youtube.com/results?search_query=Single-arm%20Pushdown%20proper%20form", photo:"images/oefeningen/single-arm-pushdown.jpg"},
    { id:"ex-jm", name:"JM Press", icon:"🏋️", sets:3, reps:"8-10", rest:"90 sec", tip:"Tussen een close-grip bench en skull crusher in: zak de stang richting je kin en duw terug.", tip_en:"A mix of close-grip bench and skull crusher: lower the bar toward your chin and press back up.", youtube:"https://www.youtube.com/results?search_query=JM%20Press%20proper%20form", photo:"images/oefeningen/jm-press.jpg"},
  ]},
  { group:'Trapezius', group_en:'Trapezius', icon:'🦍', color:'#4a5568', exercises:[
    { id:'ex-dbs',  name:'Dumbbell Shrugs',        icon:'🤷', sets:3, reps:'15-20', rest:'60 sec', youtube:'https://www.youtube.com/watch?v=g6qbq4Lf1FI', photo:'images/oefeningen/dumbbell-shrugs.jpg'},
    { id:'ex-bbs',  name:'Barbell Shrugs',         icon:'🤷', sets:4, reps:'12-15', rest:'60 sec', youtube:'https://www.youtube.com/watch?v=cJRVVxmytaM', photo:'images/oefeningen/barbell-shrugs.jpg'},
    { id:'ex-uro',  name:'Upright Row',            icon:'⬆️', sets:3, reps:'10-12', rest:'75 sec', youtube:'https://www.youtube.com/watch?v=UBMIAhCpFDk', photo:'images/oefeningen/upright-row.jpg'},
    { id:'ex-casr', name:'Cable Shrug',            icon:'🔗', sets:3, reps:'15-20', rest:'45 sec', youtube:'https://www.youtube.com/watch?v=e3LTd0gJpGQ', photo:'images/oefeningen/cable-shrug.png'},
    { id:'ex-curo', name:'Cable Upright Row',       icon:'🔗', sets:3, reps:'12-15', rest:'60 sec', youtube:'https://www.youtube.com/watch?v=UBMIAhCpFDk', photo:'images/oefeningen/cable-upright-row.jpg'},
    { id:'ex-fpr',  name:'Farm Walk (trap focus)',  icon:'🧳', sets:3, reps:'30m', rest:'90 sec', youtube:'https://www.youtube.com/watch?v=rt17lmnaLSM', photo:'images/oefeningen/farm-walk-trap-focus.jpg'},
    { id:"ex-pyr", name:"Prone Y Raise", icon:"🇾", sets:3, reps:"10-12", rest:"45 sec", tip:"Lig op je buik of schuine bank en til je armen in een Y-vorm op.", tip_en:"Lie face down or on an incline bench and raise your arms into a Y shape.", youtube:"https://www.youtube.com/results?search_query=Prone%20Y%20Raise%20proper%20form", photo:"images/oefeningen/prone-y-raise.jpg"},
    { id:"ex-bos", name:"Bent-over Shrug", icon:"🤷", sets:3, reps:"12-15", rest:"60 sec", tip:"Licht voorovergebogen. Trek je schouders omhoog richting je oren.", tip_en:"Slightly bent over. Shrug your shoulders toward your ears.", youtube:"https://www.youtube.com/results?search_query=Bent-over%20Shrug%20proper%20form", photo:"images/oefeningen/bent-over-shrug.jpg"},
  ]},
  { group:"Billen", group_en:"Glutes", icon:"🍑", color:"#9b2c2c", exercises:[
    { id:"ex-ht", name:"Hip Thrust", icon:"🍑", sets:4, reps:"8-12", rest:"90 sec", tip:"Schouderbladen op een bank. Duw je heupen omhoog en knijp bovenaan je billen samen.", tip_en:"Shoulder blades on a bench. Drive your hips up and squeeze your glutes at the top.", youtube:"https://www.youtube.com/results?search_query=Hip%20Thrust%20proper%20form", photo:"images/oefeningen/hip-thrust.jpg"},
    { id:"ex-gb", name:"Glute Bridge", icon:"🍑", sets:3, reps:"12-15", rest:"60 sec", tip:"Lig op je rug, voeten dicht bij je billen. Duw je heupen omhoog en houd 1-2 seconden vast.", tip_en:"Lie on your back with your feet close to your glutes. Lift your hips and hold for 1-2 seconds.", youtube:"https://www.youtube.com/results?search_query=Glute%20Bridge%20proper%20form", photo:"images/oefeningen/glute-bridge.jpg"},
    { id:"ex-ck", name:"Cable Kickback", icon:"🔗", sets:3, reps:"12-15 per been", rest:"60 sec", tip:"Enkelband aan de kabel. Schop je been gestrekt naar achteren zonder je rug hol te maken.", tip_en:"Ankle strap on the cable. Kick your leg straight back without arching your lower back.", youtube:"https://www.youtube.com/results?search_query=Cable%20Kickback%20proper%20form", photo:"images/oefeningen/cable-kickback.jpg"},
    { id:"ex-blw", name:"Banded Lateral Walk", icon:"↔️", sets:3, reps:"12 stappen per kant", rest:"45 sec", tip:"Weerstandsband boven je knieën, halve squat. Stap zijwaarts en houd spanning op de band.", tip_en:"Resistance band above your knees, half squat. Step sideways and keep tension on the band.", youtube:"https://www.youtube.com/results?search_query=Banded%20Lateral%20Walk%20proper%20form", photo:"images/oefeningen/banded-lateral-walk.jpg"},
    { id:"ex-dk", name:"Donkey Kicks", icon:"🐴", sets:3, reps:"15 per been", rest:"45 sec", tip:"Op handen en knieën. Duw je hiel omhoog naar het plafond en knijp je bil samen.", tip_en:"On all fours. Press your heel up toward the ceiling and squeeze your glute.", youtube:"https://www.youtube.com/results?search_query=Donkey%20Kicks%20proper%20form", photo:"images/oefeningen/donkey-kicks.jpg"},
    { id:"ex-fh", name:"Fire Hydrants", icon:"🐕", sets:3, reps:"15 per been", rest:"45 sec", tip:"Op handen en knieën. Til je gebogen been zijwaarts op, je heupen blijven stil.", tip_en:"On all fours. Lift your bent leg out to the side while your hips stay still.", youtube:"https://www.youtube.com/results?search_query=Fire%20Hydrants%20proper%20form", photo:"images/oefeningen/fire-hydrants.jpg"},
    { id:"ex-cs", name:"Clamshell", icon:"🐚", sets:3, reps:"15 per kant", rest:"45 sec", tip:"Lig op je zij met gebogen knieën. Open je bovenste knie zonder je heupen te draaien.", tip_en:"Lie on your side with bent knees. Open your top knee without rotating your hips.", youtube:"https://www.youtube.com/results?search_query=Clamshell%20proper%20form", photo:"images/oefeningen/clamshell.jpg"},
    { id:"ex-sd", name:"Sumo Deadlift", icon:"🏋️", sets:3, reps:"6-8", rest:"120 sec", tip:"Voeten breed, grip tussen je benen. Duw de vloer weg en houd je rug recht.", tip_en:"Wide stance, grip between your legs. Push the floor away and keep your back flat.", youtube:"https://www.youtube.com/results?search_query=Sumo%20Deadlift%20proper%20form", photo:"images/oefeningen/sumo-deadlift.jpg"},
    { id:"ex-ha", name:"Hip Abduction (machine)", icon:"⚙️", sets:3, reps:"12-15", rest:"60 sec", tip:"Duw je benen tegen de kussens naar buiten en laat rustig terugkomen.", tip_en:"Push your legs out against the pads and return slowly.", youtube:"https://www.youtube.com/results?search_query=Hip%20Abduction%20(machine)%20proper%20form", photo:"images/oefeningen/hip-abduction-machine.jpg"},
    { id:"ex-slht", name:"Single-leg Hip Thrust", icon:"🍑", sets:3, reps:"10 per been", rest:"60 sec", tip:"Eén been gestrekt. Duw je heup omhoog met het steunbeen en houd je bekken vlak.", tip_en:"One leg extended. Drive your hips up with the support leg and keep your pelvis level.", youtube:"https://www.youtube.com/results?search_query=Single-leg%20Hip%20Thrust%20proper%20form", photo:"images/oefeningen/single-leg-hip-thrust.jpg"},
  ]},
  { group:"Kuiten", group_en:"Calves", icon:"🦵", color:"#2c7a7b", exercises:[
    { id:"ex-stcr", name:"Standing Calf Raise", icon:"🦶", sets:4, reps:"12-15", rest:"45 sec", tip:"Duw jezelf omhoog op je tenen, houd even vast en zak diep door.", tip_en:"Rise up onto your toes, hold briefly and lower deep.", youtube:"https://www.youtube.com/results?search_query=Standing%20Calf%20Raise%20proper%20form", photo:"images/oefeningen/standing-calf-raise.jpg"},
    { id:"ex-secr", name:"Seated Calf Raise", icon:"🦶", sets:4, reps:"15", rest:"45 sec", tip:"Knieën onder het kussen. Duw je hielen omhoog en zak gecontroleerd terug.", tip_en:"Knees under the pad. Press your heels up and lower under control.", youtube:"https://www.youtube.com/results?search_query=Seated%20Calf%20Raise%20proper%20form", photo:"images/oefeningen/seated-calf-raise.jpg"},
    { id:"ex-slcr", name:"Single-leg Calf Raise", icon:"🦶", sets:3, reps:"12 per been", rest:"45 sec", tip:"Op één been op een trede, houd je vast aan een steun. Gebruik het volledige bereik.", tip_en:"Stand on one leg on a step, holding a support. Use the full range of motion.", youtube:"https://www.youtube.com/results?search_query=Single-leg%20Calf%20Raise%20proper%20form", photo:"images/oefeningen/single-leg-calf-raise.jpg"},
    { id:"ex-dcr", name:"Donkey Calf Raise", icon:"🐴", sets:3, reps:"15", rest:"45 sec", tip:"Voorovergebogen met gewicht op je heupen. Duw omhoog op je tenen.", tip_en:"Bent forward with weight on your hips. Press up onto your toes.", youtube:"https://www.youtube.com/results?search_query=Donkey%20Calf%20Raise%20proper%20form", photo:"images/oefeningen/donkey-calf-raise.jpg"},
  ]},
  { group:"Onderarmen", group_en:"Forearms", icon:"✊", color:"#975a16", exercises:[
    { id:"ex-wc", name:"Wrist Curl", icon:"✊", sets:3, reps:"15-20", rest:"45 sec", tip:"Onderarmen op je bovenbenen, handpalmen omhoog. Buig alleen je polsen.", tip_en:"Forearms on your thighs, palms up. Curl only your wrists.", youtube:"https://www.youtube.com/results?search_query=Wrist%20Curl%20proper%20form", photo:"images/oefeningen/wrist-curl.jpg"},
    { id:"ex-rwc", name:"Reverse Wrist Curl", icon:"✊", sets:3, reps:"15-20", rest:"45 sec", tip:"Handpalmen omlaag; til de dumbbell op met alleen je polsen.", tip_en:"Palms down; lift the dumbbell using only your wrists.", youtube:"https://www.youtube.com/results?search_query=Reverse%20Wrist%20Curl%20proper%20form", photo:"images/oefeningen/reverse-wrist-curl.jpg"},
    { id:"ex-dh", name:"Dead Hang", icon:"🧗", sets:3, reps:"20-40 sec", rest:"60 sec", tip:"Hang aan een stang met gestrekte armen en een stevige grip.", tip_en:"Hang from a bar with straight arms and a firm grip.", youtube:"https://www.youtube.com/results?search_query=Dead%20Hang%20proper%20form", photo:"images/oefeningen/dead-hang.jpg"},
    { id:"ex-pinch", name:"Plate Pinch", icon:"🤏", sets:3, reps:"20-30 sec", rest:"45 sec", tip:"Knijp twee schijven met de gladde kant naar buiten tussen duim en vingers.", tip_en:"Pinch two plates smooth-side out between your thumb and fingers.", youtube:"https://www.youtube.com/results?search_query=Plate%20Pinch%20proper%20form", photo:"images/oefeningen/plate-pinch.jpg"},
  ]},
  { group:'Cardio', group_en:'Cardio', icon:'🏃', color:'#4a7c59', exercises:[
    { id:'ex-wa',   name:'Wandelen',             name_en:'Walking', icon:'\u{1F6B6}', sets:'', reps:'', rest:'', stappen:'8.000-10.000 stappen per dag', stappen_en:'8,000-10,000 steps per day', youtube:'https://www.youtube.com/watch?v=_kGESn8ArrU', photo:'images/oefeningen/wandelen.jpg'},
    { id:'ex-fi',   name:'Fietsen',             name_en:'Cycling', icon:'🚴', sets:1, reps:'30 min', rest:'—', youtube:'https://www.youtube.com/watch?v=_kGESn8ArrU', photo:'images/oefeningen/fietsen.jpg'},
    { id:'ex-ri',   name:'Roeien (machine)',     name_en:'Rowing (machine)', icon:'🚣', sets:1, reps:'20 min', rest:'—', youtube:'https://www.youtube.com/watch?v=_kGESn8ArrU', photo:'images/oefeningen/roeien-machine.jpg'},
    { id:"ex-hl", name:"Hardlopen", icon:"🏃", sets:1, reps:"20-30 min", rest:"—", tip:"Rustig tempo waarbij je nog kunt praten.", tip_en:"Easy pace where you can still hold a conversation.", youtube:"https://www.youtube.com/results?search_query=Hardlopen%20proper%20form", photo:"images/oefeningen/hardlopen.jpg"},
    { id:"ex-zw", name:"Zwemmen", icon:"🏊", sets:1, reps:"20-30 min", rest:"—", tip:"Wissel schoolslag en borstcrawl af.", tip_en:"Alternate breaststroke and front crawl.", youtube:"https://www.youtube.com/results?search_query=Zwemmen%20proper%20form", photo:"images/oefeningen/zwemmen.jpg"},
    { id:"ex-ct", name:"Crosstrainer", icon:"🚶", sets:1, reps:"20 min", rest:"—", tip:"Rechtop, volledige bewegingen met armen en benen.", tip_en:"Stay upright and use full arm and leg movements.", youtube:"https://www.youtube.com/results?search_query=Crosstrainer%20proper%20form", photo:"images/oefeningen/crosstrainer.jpg"},
    { id:"ex-ts", name:"Touwtje springen", icon:"🪢", sets:3, reps:"1-2 min", rest:"45 sec", tip:"Kleine sprongetjes op je voorvoeten, je polsen draaien het touw.", tip_en:"Small hops on the balls of your feet, turn the rope with your wrists.", youtube:"https://www.youtube.com/results?search_query=Touwtje%20springen%20proper%20form", photo:"images/oefeningen/touwtje-springen.jpg"},
    { id:"ex-to", name:"Trap oplopen (Stairmaster)", icon:"🪜", sets:1, reps:"15-20 min", rest:"—", tip:"Zet je hele voet op de trede en houd je romp rechtop.", tip_en:"Place your whole foot on the step and keep your torso upright.", youtube:"https://www.youtube.com/results?search_query=Trap%20oplopen%20(Stairmaster)%20proper%20form", photo:"images/oefeningen/trap-oplopen-stairmaster.jpg"},
    { id:"ex-hiit", name:"Intervaltraining (HIIT)", icon:"⚡", sets:8, reps:"30 sec werk / 30 sec rust", rest:"—", tip:"Wissel korte, hoge intensiteit af met korte rust.", tip_en:"Alternate short, high-intensity efforts with short rests.", youtube:"https://www.youtube.com/results?search_query=Intervaltraining%20(HIIT)%20proper%20form", photo:"images/oefeningen/intervaltraining-hiit.jpg"},
    { id:"ex-hik", name:"Hiken / bergwandelen", icon:"🥾", sets:1, reps:"60 min", rest:"—", tip:"Stevige schoenen; ga rustig bergop en drink genoeg.", tip_en:"Wear sturdy shoes; climb steadily and drink enough water.", youtube:"https://www.youtube.com/results?search_query=Hiken%20%2F%20bergwandelen%20proper%20form", photo:"images/oefeningen/hiken-bergwandelen.jpg"},
    { id:"ex-spin", name:"Spinning", icon:"🚴", sets:1, reps:"30-45 min", rest:"—", tip:"Zadel en stuur goed afstellen; wissel zitten en staan in de klim af.", tip_en:"Set the saddle and handlebars properly; alternate seated and standing climbs.", youtube:"https://www.youtube.com/results?search_query=Spinning%20proper%20form", photo:"images/oefeningen/spinning.jpg"},
  ]},
  { group:"Mobiliteit en rekken", group_en:"Mobility and stretching", icon:"🧘", color:"#2b6cb0", exercises:[
    { id:"ex-cat", name:"Cat-Cow", icon:"🐱", sets:2, reps:"10 herhalingen", rest:"—", tip:"Op handen en knieën: wissel een holle en bolle rug af met je ademhaling.", tip_en:"On all fours: alternate arching and rounding your back with your breathing.", youtube:"https://www.youtube.com/results?search_query=Cat-Cow%20proper%20form", photo:"images/oefeningen/cat-cow.jpg"},
    { id:"ex-child", name:"Child's Pose", icon:"🧘", sets:2, reps:"30 sec", rest:"—", tip:"Zit op je hielen en strek je armen voor je uit; laat je borst zakken.", tip_en:"Sit back on your heels, reach your arms forward and let your chest sink.", youtube:"https://www.youtube.com/results?search_query=Child's%20Pose%20proper%20form", photo:"images/oefeningen/child-s-pose.jpg"},
    { id:"ex-hfs", name:"Hip Flexor Stretch", icon:"🧎", sets:2, reps:"30 sec per kant", rest:"—", tip:"Een knie op de grond, duw je heup naar voren tot je rek voelt aan de voorkant.", tip_en:"One knee on the floor, push your hip forward until you feel a stretch at the front.", youtube:"https://www.youtube.com/results?search_query=Hip%20Flexor%20Stretch%20proper%20form", photo:"images/oefeningen/hip-flexor-stretch.jpg"},
    { id:"ex-hstr", name:"Hamstring Stretch", icon:"🦵", sets:2, reps:"30 sec per been", rest:"—", tip:"Been gestrekt, buig voorover vanuit je heupen met een rechte rug.", tip_en:"Leg straight, hinge forward from your hips with a flat back.", youtube:"https://www.youtube.com/results?search_query=Hamstring%20Stretch%20proper%20form", photo:"images/oefeningen/hamstring-stretch.jpg"},
    { id:"ex-wgs", name:"World's Greatest Stretch", icon:"🌍", sets:2, reps:"5 per kant", rest:"—", tip:"Diepe lunge, draai je bovenlichaam open en reik naar het plafond.", tip_en:"Deep lunge, rotate your upper body open and reach to the ceiling.", youtube:"https://www.youtube.com/results?search_query=World's%20Greatest%20Stretch%20proper%20form", photo:"images/oefeningen/world-s-greatest-stretch.jpg"},
    { id:"ex-pig", name:"Pigeon Pose", icon:"🕊️", sets:2, reps:"30-60 sec per kant", rest:"—", tip:"Voorste been gebogen voor je, achterbeen gestrekt; laat je heup zakken.", tip_en:"Front leg bent in front of you, back leg extended; let your hip sink.", youtube:"https://www.youtube.com/results?search_query=Pigeon%20Pose%20proper%20form", photo:"images/oefeningen/pigeon-pose.jpg"},
    { id:"ex-dd", name:"Downward Dog", icon:"🐕", sets:2, reps:"30 sec", rest:"—", tip:"Heupen hoog in een omgekeerde V, hielen richting de grond.", tip_en:"Hips high in an inverted V, heels toward the floor.", youtube:"https://www.youtube.com/results?search_query=Downward%20Dog%20proper%20form", photo:"images/oefeningen/downward-dog.jpg"},
    { id:"ex-cob", name:"Cobra", icon:"🐍", sets:2, reps:"20 sec", rest:"—", tip:"Lig op je buik en duw je borst omhoog; je heupen blijven op de grond.", tip_en:"Lie on your stomach and push your chest up while your hips stay on the floor.", youtube:"https://www.youtube.com/results?search_query=Cobra%20proper%20form", photo:"images/oefeningen/cobra.jpg"},
    { id:"ex-foam", name:"Foam Rolling (rug)", icon:"🧻", sets:1, reps:"1-2 min", rest:"—", tip:"Rol rustig met de foamroller onder je bovenrug; vermijd je onderrug.", tip_en:"Roll slowly with the foam roller under your upper back; avoid your lower back.", youtube:"https://www.youtube.com/results?search_query=Foam%20Rolling%20(rug)%20proper%20form", photo:"images/oefeningen/foam-rolling-rug.jpg"},
  ]},
  { group:"Warming-up", group_en:"Warm-up", icon:"🔥", color:"#c05621", exercises:[
    { id:"ex-acirc", name:"Arm Circles", icon:"🔄", sets:2, reps:"15 per richting", rest:"30 sec", tip:"Maak grote cirkels met gestrekte armen, eerst vooruit en dan achteruit.", tip_en:"Make big circles with straight arms, first forward then backward.", youtube:"https://www.youtube.com/results?search_query=Arm%20Circles%20proper%20form", photo:"images/oefeningen/arm-circles.jpg"},
    { id:"ex-lswing", name:"Leg Swings", icon:"🦵", sets:2, reps:"10 per been", rest:"30 sec", tip:"Zwaai je been gecontroleerd voor-achter en houd je ergens aan vast.", tip_en:"Swing your leg forward and back under control while holding a support.", youtube:"https://www.youtube.com/results?search_query=Leg%20Swings%20proper%20form", photo:"images/oefeningen/leg-swings.jpg"},
    { id:"ex-bpa", name:"Band Pull-apart", icon:"🎗️", sets:3, reps:"15", rest:"30 sec", tip:"Trek de band met gestrekte armen uit elkaar tot borsthoogte.", tip_en:"Pull the band apart with straight arms at chest height.", youtube:"https://www.youtube.com/results?search_query=Band%20Pull-apart%20proper%20form", photo:"images/oefeningen/band-pull-apart.jpg"},
    { id:"ex-gact", name:"Glute Activation (banded)", icon:"🍑", sets:2, reps:"15", rest:"30 sec", tip:"Band boven je knieën; duw je knieën naar buiten tijdens een glute bridge of squat.", tip_en:"Band above your knees; push your knees out during a glute bridge or squat.", youtube:"https://www.youtube.com/results?search_query=Glute%20Activation%20(banded)%20proper%20form"},
    { id:"ex-sdis", name:"Shoulder Dislocates (band)", icon:"🔄", sets:2, reps:"10", rest:"30 sec", tip:"Houd een band breed vast en breng hem met gestrekte armen van voor naar achter je lichaam.", tip_en:"Hold a band wide and bring it from front to back over your head with straight arms.", youtube:"https://www.youtube.com/results?search_query=Shoulder%20Dislocates%20(band)%20proper%20form"},
  ]},
];

// Cache-busting: zelfde reden als PRODUCT_PHOTO_VERSION hierboven -- ophogen
// zodra een foto in EXTRA_EXERCISES vervangen wordt.
const EXTRA_EXERCISE_PHOTO_VERSION = 7;
EXTRA_EXERCISES.forEach(group => group.exercises.forEach(ex => { if (ex.photo && ex.photo.startsWith('images/')) ex.photo += '?v=' + EXTRA_EXERCISE_PHOTO_VERSION; }));


// ========== OEFENINGEN PER TYPE ==========
const EXERCISES = {
  herstel: [
    { name:'Wandelen', name_en:'Walking', icon:'🚶', sets:1, reps:'30 min', rest:'—',
      tip:'Rustig tempo, frisse lucht. Geen prestatie-druk — dit is actief herstel.',
      tip_en:'Easy pace, fresh air. No pressure to perform — this is active recovery.',
      youtube:'https://www.youtube.com/watch?v=aXItOY0sLRY',
      photo:'https://images.pexels.com/photos/1108101/pexels-photo-1108101.jpeg?auto=compress&cs=tinysrgb&w=400&h=300&fit=crop',
      alts:[
        { name:'Fietsen (rustig)', name_en:'Cycling (easy)', icon:'🚴', sets:1, reps:'30 min', rest:'—', tip:'Laag tempo, geen inspanning. Bloed in beweging houden.', tip_en:'Low pace, no effort. Keep the blood flowing.', youtube:'https://www.youtube.com/watch?v=aXItOY0sLRY', photo:'https://images.pexels.com/photos/1108101/pexels-photo-1108101.jpeg?auto=compress&cs=tinysrgb&w=400&h=300&fit=crop'},
        { name:'Zwemmen (rustig)', name_en:'Swimming (easy)', icon:'🏊', sets:1, reps:'20 min', rest:'—', tip:'Kalm baantjes trekken. Gewrichtsvriendelijk herstel.', tip_en:'Calm laps. Joint-friendly recovery.', youtube:'https://www.youtube.com/watch?v=aXItOY0sLRY', photo:'https://images.pexels.com/photos/1108101/pexels-photo-1108101.jpeg?auto=compress&cs=tinysrgb&w=400&h=300&fit=crop'},
      ]},
    { name:'Foam rollen', name_en:'Foam rolling', icon:'🌀', sets:1, reps:'10-15 min', rest:'—',
      tip:'Rol langzaam over gespannen spiergroepen. Houd 30 sec op pijnlijke punten.',
      tip_en:'Roll slowly over tight muscle groups. Hold 30 sec on tender spots.',
      youtube:'https://www.youtube.com/watch?v=eTCo_3sAE2s',
      photo:'https://images.pexels.com/photos/3822906/pexels-photo-3822906.jpeg?auto=compress&cs=tinysrgb&w=400&h=300&fit=crop',
      alts:[
        { name:'Massage bal', name_en:'Massage ball', icon:'⚽', sets:1, reps:'10 min', rest:'—', tip:'Gebruik een tennisbal of lacrosse bal op voeten en billen.', tip_en:'Use a tennis or lacrosse ball on feet and glutes.', youtube:'https://www.youtube.com/watch?v=eTCo_3sAE2s', photo:'https://images.pexels.com/photos/3822906/pexels-photo-3822906.jpeg?auto=compress&cs=tinysrgb&w=400&h=300&fit=crop'},
      ]},
    { name:'Nek & schouder stretch', name_en:'Neck & shoulder stretch', icon:'🤸', sets:3, reps:'30 sec', rest:'15 sec',
      tip:'Kantel je hoofd naar rechts, houd 30 sec. Herhaal links. Ontspannen ademhalen.',
      tip_en:'Tilt your head to the right, hold 30 sec. Repeat left. Breathe relaxed.',
      youtube:'https://www.youtube.com/watch?v=4pKly2JojMw',
      photo:'https://images.pexels.com/photos/3822906/pexels-photo-3822906.jpeg?auto=compress&cs=tinysrgb&w=400&h=300&fit=crop',
      alts:[
        { name:'Wervelkolom rotatie', name_en:'Spinal rotation', icon:'🔄', sets:3, reps:'10 herh', rest:'20 sec', tip:'Zit rechtop, draai langzaam van links naar rechts. Rug recht.', tip_en:'Sit upright, rotate slowly from left to right. Keep your back straight.', youtube:'https://www.youtube.com/watch?v=4pKly2JojMw', photo:'https://images.pexels.com/photos/3822906/pexels-photo-3822906.jpeg?auto=compress&cs=tinysrgb&w=400&h=300&fit=crop'},
        { name:'Borstkas openen', name_en:'Chest opener', icon:'🫁', sets:3, reps:'30 sec', rest:'15 sec', tip:'Handen achter je hoofd, ellebogen naar achteren. Voel de stretch in je borst.', tip_en:'Hands behind your head, elbows back. Feel the stretch in your chest.', youtube:'https://www.youtube.com/watch?v=4pKly2JojMw', photo:'https://images.pexels.com/photos/3822906/pexels-photo-3822906.jpeg?auto=compress&cs=tinysrgb&w=400&h=300&fit=crop'},
      ]},
    { name:'Heup openers', name_en:'Hip openers', icon:'🧘', sets:3, reps:'60 sec', rest:'30 sec',
      tip:'Zit in een diepe squat, houd vast aan iets. Laat je heupen los.',
      tip_en:'Sit in a deep squat, hold onto something. Let your hips loosen.',
      youtube:'https://www.youtube.com/watch?v=YQmpO6OpBoY',
      photo:'https://images.pexels.com/photos/3822906/pexels-photo-3822906.jpeg?auto=compress&cs=tinysrgb&w=400&h=300&fit=crop',
      alts:[
        { name:'Duif pose (yoga)', name_en:'Pigeon pose (yoga)', icon:'🕊️', sets:2, reps:'60 sec per kant', rest:'30 sec', tip:'Leg je onderbeen voor je neer, strek het andere been naar achteren. Diepe heupstretch.', tip_en:'Place your shin in front of you, stretch the other leg back. Deep hip stretch.', youtube:'https://www.youtube.com/watch?v=YQmpO6OpBoY', photo:'https://images.pexels.com/photos/3822906/pexels-photo-3822906.jpeg?auto=compress&cs=tinysrgb&w=400&h=300&fit=crop'},
        { name:'Hip flexor stretch', icon:'🦵', sets:3, reps:'45 sec per kant', rest:'20 sec', tip:'Knie op de grond, andere voet voor. Duw heupen naar voren.', tip_en:'Knee on the ground, other foot forward. Push hips forward.', youtube:'https://www.youtube.com/watch?v=YQmpO6OpBoY', photo:'https://images.pexels.com/photos/3822906/pexels-photo-3822906.jpeg?auto=compress&cs=tinysrgb&w=400&h=300&fit=crop'},
      ]},
    { name:'Lichte core activatie', name_en:'Light core activation', icon:'🎯', sets:3, reps:'10 herh', rest:'45 sec',
      tip:'Plank op knieën of dead bugs. Geen kracht — alleen activatie.',
      tip_en:'Plank on knees or dead bugs. No strength focus — just activation.',
      youtube:'https://www.youtube.com/watch?v=4XLEnwUr1d8',
      photo:'https://images.pexels.com/photos/4164453/pexels-photo-4164453.jpeg?auto=compress&cs=tinysrgb&w=400&h=300&fit=crop',
      alts:[
        { name:'Dead bug', icon:'🐛', sets:3, reps:'8 per kant', rest:'45 sec', tip:'Lig op rug, armen omhoog. Strek tegengestelde arm en been, core strak.', tip_en:'Lie on your back, arms up. Extend opposite arm and leg, core tight.', youtube:'https://www.youtube.com/watch?v=SdDPV3zZRUU', photo:'https://images.pexels.com/photos/4164453/pexels-photo-4164453.jpeg?auto=compress&cs=tinysrgb&w=400&h=300&fit=crop'},
        { name:'Bird dog', icon:'🐦', sets:3, reps:'8 per kant', rest:'45 sec', tip:'Op handen en knieën. Strek tegengestelde arm en been. Heupen stabiel houden.', tip_en:'On hands and knees. Extend opposite arm and leg. Keep hips stable.', youtube:'https://www.youtube.com/watch?v=wiFNA3sqjCA', photo:'https://images.pexels.com/photos/4164453/pexels-photo-4164453.jpeg?auto=compress&cs=tinysrgb&w=400&h=300&fit=crop'},
      ]},
  ],
  normaal: [
    { name:'Barbell Squat', icon:'🏋️', sets:4, reps:'8-10', rest:'90 sec',
      tip:'Voeten op schouderbreedte. Knieën volgen je tenen. Rug recht houden door de hele beweging.',
      tip_en:'Feet shoulder-width apart. Knees track your toes. Keep your back straight throughout.',
      youtube:'https://www.youtube.com/watch?v=ultWZbUMPL8',
      photo:'https://images.pexels.com/photos/1552106/pexels-photo-1552106.jpeg?auto=compress&cs=tinysrgb&w=400&h=300&fit=crop',
      alts:[
        { name:'Goblet Squat', icon:'🏋️', sets:4, reps:'10-12', rest:'90 sec', tip:'Houd één dumbbell voor je borst. Makkelijker voor de rug, zelfde spiergroepen.', tip_en:'Hold one dumbbell in front of your chest. Easier on the back, same muscle groups.', youtube:'https://www.youtube.com/watch?v=MxsFDhcyFyE', photo:'https://images.pexels.com/photos/1552106/pexels-photo-1552106.jpeg?auto=compress&cs=tinysrgb&w=400&h=300&fit=crop'},
        { name:'Leg Press', icon:'🦵', sets:4, reps:'10-12', rest:'90 sec', tip:'Machine-alternatief. Voeten iets breder dan schouderbreedte. Knieën niet naar binnen.', tip_en:'Machine alternative. Feet slightly wider than shoulder-width. Knees do not cave in.', youtube:'https://www.youtube.com/watch?v=IZxyjW7MPJQ', photo:'https://images.pexels.com/photos/1552106/pexels-photo-1552106.jpeg?auto=compress&cs=tinysrgb&w=400&h=300&fit=crop'},
        { name:'Lunges', icon:'🚶', sets:3, reps:'12 per been', rest:'75 sec', tip:'Stap naar voren, knie boven enkel. Romp rechtop houden.', tip_en:'Step forward, knee above ankle. Keep torso upright.', youtube:'https://www.youtube.com/watch?v=QOVaHwm-Q6U', photo:'https://images.pexels.com/photos/3822906/pexels-photo-3822906.jpeg?auto=compress&cs=tinysrgb&w=400&h=300&fit=crop'},
      ]},
    { name:'Bench Press', icon:'💪', sets:4, reps:'8-10', rest:'90 sec',
      tip:'Schouderbladen samenknijpen en in de bank drukken. Stang raakt je borst licht.',
      tip_en:'Squeeze shoulder blades together and press into the bench. Bar lightly touches your chest.',
      youtube:'https://www.youtube.com/watch?v=SCVCLChPQFY',
      photo:'https://images.pexels.com/photos/3837781/pexels-photo-3837781.jpeg?auto=compress&cs=tinysrgb&w=400&h=300&fit=crop',
      alts:[
        { name:'Dumbbell Press', icon:'💪', sets:4, reps:'10-12', rest:'90 sec', tip:'Dumbbells geven meer bewegingsvrijheid. Ellebogen iets gebogen bij het laten zakken.', tip_en:'Dumbbells give more freedom of movement. Elbows slightly bent when lowering.', youtube:'https://www.youtube.com/watch?v=SCVCLChPQFY', photo:'https://images.pexels.com/photos/3837781/pexels-photo-3837781.jpeg?auto=compress&cs=tinysrgb&w=400&h=300&fit=crop'},
        { name:'Push-ups', icon:'🤸', sets:4, reps:'12-15', rest:'75 sec', tip:'Geen materiaal nodig. Handen iets breder dan schouderbreedte. Borst raakt de grond.', tip_en:'No equipment needed. Hands slightly wider than shoulder-width. Chest touches the ground.', youtube:'https://www.youtube.com/watch?v=IODxDxX7oi4', photo:'https://images.pexels.com/photos/3837757/pexels-photo-3837757.jpeg?auto=compress&cs=tinysrgb&w=400&h=300&fit=crop'},
        { name:'Cable Fly', icon:'🔗', sets:3, reps:'12-15', rest:'75 sec', tip:'Isolatieoefening borst. Armen licht gebogen, breng handen samen voor je borst.', tip_en:'Chest isolation exercise. Arms slightly bent, bring hands together in front of your chest.', youtube:'https://www.youtube.com/watch?v=Iwe6AmxVf7o', photo:'https://images.pexels.com/photos/4162481/pexels-photo-4162481.jpeg?auto=compress&cs=tinysrgb&w=400&h=300&fit=crop'},
      ]},
    { name:'Dumbbell Row', icon:'🎿', sets:3, reps:'10-12', rest:'75 sec',
      tip:'Trek de elleboog omhoog, niet de hand. Voel de contractie in je rug.',
      tip_en:'Pull the elbow up, not the hand. Feel the contraction in your back.',
      youtube:'https://www.youtube.com/watch?v=pYcpY20QaE8',
      photo:'https://images.pexels.com/photos/3837757/pexels-photo-3837757.jpeg?auto=compress&cs=tinysrgb&w=400&h=300&fit=crop',
      alts:[
        { name:'Barbell Row', icon:'🏋️', sets:3, reps:'8-10', rest:'90 sec', tip:'Romp voorover, stang naar navel trekken. Rug recht houden.', tip_en:'Bend forward, pull the bar to your navel. Keep your back straight.', youtube:'https://www.youtube.com/watch?v=pYcpY20QaE8', photo:'https://images.pexels.com/photos/3837757/pexels-photo-3837757.jpeg?auto=compress&cs=tinysrgb&w=400&h=300&fit=crop'},
        { name:'Seated Cable Row', icon:'🔗', sets:3, reps:'10-12', rest:'75 sec', tip:'Trek naar je navel. Schouderbladen samenknijpen aan het einde van de beweging.', tip_en:'Pull to your navel. Squeeze shoulder blades together at the end of the movement.', youtube:'https://www.youtube.com/watch?v=GZbfZ033f74', photo:'https://images.pexels.com/photos/4162481/pexels-photo-4162481.jpeg?auto=compress&cs=tinysrgb&w=400&h=300&fit=crop'},
        { name:'Pull-ups', icon:'🤸', sets:3, reps:'6-10', rest:'90 sec', tip:'Volle bewegingsuitslag. Start hangend, eindig met kin boven de bar.', tip_en:'Full range of motion. Start hanging, finish with chin above the bar.', youtube:'https://www.youtube.com/watch?v=eGo4IYlbE5g', photo:'https://images.pexels.com/photos/416717/pexels-photo-416717.jpeg?auto=compress&cs=tinysrgb&w=400&h=300&fit=crop'},
      ]},
    { name:'Overhead Press', icon:'🙌', sets:3, reps:'8-10', rest:'90 sec',
      tip:'Buik aanspannen, pers recht omhoog. Hoofd iets naar achteren als de stang passeert.',
      tip_en:'Brace your core, press straight up. Head slightly back as the bar passes.',
      youtube:'https://www.youtube.com/watch?v=2yjwXTZQDDI',
      photo:'https://images.pexels.com/photos/2261477/pexels-photo-2261477.jpeg?auto=compress&cs=tinysrgb&w=400&h=300&fit=crop',
      alts:[
        { name:'Dumbbell Shoulder Press', icon:'💪', sets:3, reps:'10-12', rest:'90 sec', tip:'Zittend of staand. Dumbbells naast je hoofd, pers omhoog zonder te wiegen.', tip_en:'Seated or standing. Dumbbells next to your head, press up without swaying.', youtube:'https://www.youtube.com/watch?v=B-aVuyhvLHU', photo:'https://images.pexels.com/photos/2261477/pexels-photo-2261477.jpeg?auto=compress&cs=tinysrgb&w=400&h=300&fit=crop'},
        { name:'Lateral Raises', icon:'↔️', sets:3, reps:'12-15', rest:'60 sec', tip:'Lichte dumbbells. Armen zijwaarts heffen tot schouderhoogte. Langzaam zakken.', tip_en:'Light dumbbells. Raise arms sideways to shoulder height. Lower slowly.', youtube:'https://www.youtube.com/watch?v=3VcKaXpzqRo', photo:'https://images.pexels.com/photos/2261477/pexels-photo-2261477.jpeg?auto=compress&cs=tinysrgb&w=400&h=300&fit=crop'},
      ]},
    { name:'Plank', icon:'🎯', sets:3, reps:'45 sec', rest:'45 sec',
      tip:'Romp recht als een plank. Billen niet omhoog, rug niet hol. Adem rustig.',
      tip_en:'Torso straight like a plank. Hips not up, back not arched. Breathe calmly.',
      youtube:'https://www.youtube.com/watch?v=ASdvN_XEl_c',
      photo:'https://images.pexels.com/photos/4164453/pexels-photo-4164453.jpeg?auto=compress&cs=tinysrgb&w=400&h=300&fit=crop',
      alts:[
        { name:'Side Plank', icon:'↕️', sets:3, reps:'30 sec per kant', rest:'45 sec', tip:'Op één elleboog en voet. Heupen omhoog, lichaam rechte lijn.', tip_en:'On one elbow and foot. Hips up, body in a straight line.', youtube:'https://www.youtube.com/watch?v=ASdvN_XEl_c', photo:'https://images.pexels.com/photos/4164453/pexels-photo-4164453.jpeg?auto=compress&cs=tinysrgb&w=400&h=300&fit=crop'},
        { name:'Ab Wheel', icon:'⚙️', sets:3, reps:'8-10', rest:'60 sec', tip:'Begin op knieën. Rol langzaam naar voren, core strak. Rol terug met buikspieren.', tip_en:'Start on your knees. Roll forward slowly, core tight. Roll back using your abs.', youtube:'https://www.youtube.com/watch?v=vGFQeQ8YkQ4', photo:'https://images.pexels.com/photos/4164453/pexels-photo-4164453.jpeg?auto=compress&cs=tinysrgb&w=400&h=300&fit=crop'},
        { name:'Crunches', icon:'🔄', sets:3, reps:'20', rest:'45 sec', tip:'Handen achter hoofd, ellebogen breed. Til schouders op, niet je nek.', tip_en:'Hands behind head, elbows wide. Lift your shoulders, not your neck.', youtube:'https://www.youtube.com/watch?v=Xyd_fa5zoEU', photo:'https://images.pexels.com/photos/4164453/pexels-photo-4164453.jpeg?auto=compress&cs=tinysrgb&w=400&h=300&fit=crop'},
      ]},
    { name:'Romanian Deadlift', icon:'🦵', sets:3, reps:'10-12', rest:'90 sec',
      tip:'Houd de stang dicht bij je benen, knik vanuit de heupen. Voel de rek in je hamstrings.',
      tip_en:'Keep the bar close to your legs, hinge from the hips. Feel the stretch in your hamstrings.',
      youtube:'https://www.youtube.com/watch?v=JCXUYuzwNrM',
      photo:'https://images.pexels.com/photos/841130/pexels-photo-841130.jpeg?auto=compress&cs=tinysrgb&w=400&h=300&fit=crop',
      alts:[
        { name:'Dumbbell RDL', icon:'🏋️', sets:3, reps:'12', rest:'90 sec', tip:'Zelfde beweging met dumbbells. Makkelijker te controleren dan stang.', tip_en:'Same movement with dumbbells. Easier to control than a bar.', youtube:'https://www.youtube.com/watch?v=hCDzSR6bW10', photo:'https://images.pexels.com/photos/841130/pexels-photo-841130.jpeg?auto=compress&cs=tinysrgb&w=400&h=300&fit=crop'},
        { name:'Good Morning', icon:'🌅', sets:3, reps:'10-12', rest:'90 sec', tip:'Stang op schouders, buig voorover vanuit heupen. Rug recht, knieën licht gebogen.', tip_en:'Bar on shoulders, bend forward from the hips. Back straight, knees slightly bent.', youtube:'https://www.youtube.com/watch?v=YA-h3n9L4YU', photo:'https://images.pexels.com/photos/841130/pexels-photo-841130.jpeg?auto=compress&cs=tinysrgb&w=400&h=300&fit=crop'},
        { name:'Leg Curl (machine)', icon:'🦵', sets:3, reps:'12-15', rest:'75 sec', tip:'Isolatieoefening voor hamstrings. Gecontroleerd bewegen, geen gewicht laten vallen.', tip_en:'Isolation exercise for hamstrings. Controlled movement, do not let the weight drop.', youtube:'https://www.youtube.com/watch?v=1Tq3QdYUuHs', photo:'https://images.pexels.com/photos/1552106/pexels-photo-1552106.jpeg?auto=compress&cs=tinysrgb&w=400&h=300&fit=crop'},
      ]},
  ],
  zwaar: [
    { name:'Barbell Squat', icon:'🏋️', sets:5, reps:'5', rest:'3 min',
      tip:'Zwaar gewicht, volle diepte. Ademhalen in voor de beweging — Valsalva techniek.',
      tip_en:'Heavy weight, full depth. Breathe in before the movement — Valsalva technique.',
      youtube:'https://www.youtube.com/watch?v=ultWZbUMPL8',
      photo:'https://images.pexels.com/photos/1552106/pexels-photo-1552106.jpeg?auto=compress&cs=tinysrgb&w=400&h=300&fit=crop',
      alts:[
        { name:'Front Squat', icon:'🏋️', sets:5, reps:'4-5', rest:'3 min', tip:'Stang voor op schouders. Rechtopere romp dan back squat. Technisch moeilijker.', tip_en:'Bar in front on shoulders. More upright torso than a back squat. Technically harder.', youtube:'https://www.youtube.com/watch?v=m4ytaCJZpl0', photo:'https://images.pexels.com/photos/1552106/pexels-photo-1552106.jpeg?auto=compress&cs=tinysrgb&w=400&h=300&fit=crop'},
        { name:'Hack Squat', icon:'🦵', sets:4, reps:'6-8', rest:'2 min', tip:'Machine-squat. Minder belasting op rug, zelfde beenspieren.', tip_en:'Machine squat. Less load on the back, same leg muscles.', youtube:'https://www.youtube.com/watch?v=0tn5K9NlCfo', photo:'https://images.pexels.com/photos/1552106/pexels-photo-1552106.jpeg?auto=compress&cs=tinysrgb&w=400&h=300&fit=crop'},
      ]},
    { name:'Deadlift', icon:'🔑', sets:4, reps:'4-6', rest:'3 min',
      tip:'Bar boven je middelvoet. Trek de spanning eruit voor je optilt. Explosief omhoog, gecontroleerd terug.',
      tip_en:'Bar above your mid-foot. Pull the slack out before you lift. Explosive up, controlled back down.',
      youtube:'https://www.youtube.com/watch?v=op9kVnSso6Q',
      photo:'https://images.pexels.com/photos/841130/pexels-photo-841130.jpeg?auto=compress&cs=tinysrgb&w=400&h=300&fit=crop',
      alts:[
        { name:'Sumo Deadlift', icon:'🏋️', sets:4, reps:'4-6', rest:'3 min', tip:'Voeten wijd, handen smal. Minder heupbeweging, meer benen. Goed voor korte torso.', tip_en:'Feet wide, hands narrow. Less hip movement, more legs. Good for a short torso.', youtube:'https://www.youtube.com/watch?v=jADPhCJFELs', photo:'https://images.pexels.com/photos/841130/pexels-photo-841130.jpeg?auto=compress&cs=tinysrgb&w=400&h=300&fit=crop'},
        { name:'Trap Bar Deadlift', icon:'🔷', sets:4, reps:'5-6', rest:'3 min', tip:'Rugvriendelijker alternatief. Gewicht naast je lichaam in plaats van voor je.', tip_en:'Back-friendlier alternative. Weight next to your body instead of in front of you.', youtube:'https://www.youtube.com/watch?v=B4l84LDKM4c', photo:'https://images.pexels.com/photos/841130/pexels-photo-841130.jpeg?auto=compress&cs=tinysrgb&w=400&h=300&fit=crop'},
      ]},
    { name:'Bench Press', icon:'💪', sets:4, reps:'6-8', rest:'2 min',
      tip:'Arching mag — schouderbladen vastzetten. Explosieve push, langzame laadfase (3 sec neer).',
      tip_en:'Arching is fine — lock your shoulder blades. Explosive push, slow lowering phase (3 sec down).',
      youtube:'https://www.youtube.com/watch?v=SCVCLChPQFY',
      photo:'https://images.pexels.com/photos/3837781/pexels-photo-3837781.jpeg?auto=compress&cs=tinysrgb&w=400&h=300&fit=crop',
      alts:[
        { name:'Incline Bench Press', icon:'📐', sets:4, reps:'6-8', rest:'2 min', tip:'Bank schuin (30°). Meer nadruk op bovenkant borst en schouders.', tip_en:'Bench tilted (30°). More emphasis on upper chest and shoulders.', youtube:'https://www.youtube.com/watch?v=SCVCLChPQFY', photo:'https://images.pexels.com/photos/3837781/pexels-photo-3837781.jpeg?auto=compress&cs=tinysrgb&w=400&h=300&fit=crop'},
        { name:'Weighted Push-ups', icon:'🤸', sets:4, reps:'8-12', rest:'90 sec', tip:'Gewichtsplaat op rug of gewichtsvest. Zelfde bewegingspatroon als bench press.', tip_en:'Weight plate on your back or a weight vest. Same movement pattern as bench press.', youtube:'https://www.youtube.com/watch?v=IODxDxX7oi4', photo:'https://images.pexels.com/photos/3837757/pexels-photo-3837757.jpeg?auto=compress&cs=tinysrgb&w=400&h=300&fit=crop'},
      ]},
    { name:'Pull-ups', icon:'🤸', sets:4, reps:'6-8', rest:'2 min',
      tip:'Volle bewegingsuitslag. Start met hangende armen, eindig met kin boven de bar.',
      tip_en:'Full range of motion. Start with hanging arms, finish with chin above the bar.',
      youtube:'https://www.youtube.com/watch?v=eGo4IYlbE5g',
      photo:'https://images.pexels.com/photos/416717/pexels-photo-416717.jpeg?auto=compress&cs=tinysrgb&w=400&h=300&fit=crop',
      alts:[
        { name:'Weighted Pull-ups', icon:'⚖️', sets:4, reps:'5-6', rest:'2 min', tip:'Gewichtsriem of dumbbell tussen je knieën. Zware variant voor gevorderden.', tip_en:'Weight belt or dumbbell between your knees. Heavy variant for advanced trainees.', youtube:'https://www.youtube.com/watch?v=eGo4IYlbE5g', photo:'https://images.pexels.com/photos/416717/pexels-photo-416717.jpeg?auto=compress&cs=tinysrgb&w=400&h=300&fit=crop'},
        { name:'Lat Pulldown', icon:'⬇️', sets:4, reps:'8-10', rest:'90 sec', tip:'Machine-alternatief. Trek stang naar borst. Schouderbladen samenknijpen onderaan.', tip_en:'Machine alternative. Pull the bar to your chest. Squeeze shoulder blades at the bottom.', youtube:'https://www.youtube.com/watch?v=CAwf7n6Luuc', photo:'https://images.pexels.com/photos/4162481/pexels-photo-4162481.jpeg?auto=compress&cs=tinysrgb&w=400&h=300&fit=crop'},
      ]},
    { name:'Overhead Press', icon:'🙌', sets:4, reps:'5-6', rest:'2 min',
      tip:'Zwaar maar gecontroleerd. Core staat aan alsof je een dreun verwacht.',
      tip_en:'Heavy but controlled. Core braced as if expecting a hit.',
      youtube:'https://www.youtube.com/watch?v=2yjwXTZQDDI',
      photo:'https://images.pexels.com/photos/2261477/pexels-photo-2261477.jpeg?auto=compress&cs=tinysrgb&w=400&h=300&fit=crop',
      alts:[
        { name:'Push Press', icon:'🙌', sets:4, reps:'5-6', rest:'2 min', tip:'Gebruik lichte kniebuiging voor impuls. Zwaarder gewicht mogelijk dan strict press.', tip_en:'Use a slight knee bend for momentum. Heavier weight possible than a strict press.', youtube:'https://www.youtube.com/watch?v=iaBVSJm78ko', photo:'https://images.pexels.com/photos/2261477/pexels-photo-2261477.jpeg?auto=compress&cs=tinysrgb&w=400&h=300&fit=crop'},
        { name:'Arnold Press', icon:'🔄', sets:4, reps:'8', rest:'90 sec', tip:'Start met palmen naar je toe, roteer tijdens de press. Volledige schouderbewegig.', tip_en:'Start with palms facing you, rotate during the press. Full shoulder movement.', youtube:'https://www.youtube.com/watch?v=6Z15_WdXmVw', photo:'https://images.pexels.com/photos/2261477/pexels-photo-2261477.jpeg?auto=compress&cs=tinysrgb&w=400&h=300&fit=crop'},
      ]},
    { name:'Farmer Carry', icon:'🧳', sets:3, reps:'40 meter', rest:'90 sec',
      tip:'Zwaar gewicht in beide handen, recht lopen. Schouders naar achteren en omlaag.',
      tip_en:'Heavy weight in both hands, walk straight. Shoulders back and down.',
      youtube:'https://www.youtube.com/watch?v=rt17lmnaLSM',
      photo:'https://images.pexels.com/photos/1552106/pexels-photo-1552106.jpeg?auto=compress&cs=tinysrgb&w=400&h=300&fit=crop',
      alts:[
        { name:'Suitcase Carry', icon:'💼', sets:3, reps:'30 meter per kant', rest:'90 sec', tip:'Eén kant beladen. Romp stabiel houden, niet naar de kant hangen.', tip_en:'One side loaded. Keep your torso stable, do not lean to the side.', youtube:'https://www.youtube.com/watch?v=rt17lmnaLSM', photo:'https://images.pexels.com/photos/1552106/pexels-photo-1552106.jpeg?auto=compress&cs=tinysrgb&w=400&h=300&fit=crop'},
        { name:'Trap Bar Carry', icon:'🔷', sets:3, reps:'40 meter', rest:'90 sec', tip:'Ergonomischer dan dumbbells. Gewicht naast je lichaam.', tip_en:'More ergonomic than dumbbells. Weight next to your body.', youtube:'https://www.youtube.com/watch?v=rt17lmnaLSM', photo:'https://images.pexels.com/photos/1552106/pexels-photo-1552106.jpeg?auto=compress&cs=tinysrgb&w=400&h=300&fit=crop'},
      ]},
    { name:'Face Pull', icon:'🎯', sets:3, reps:'15', rest:'60 sec',
      tip:'Afsluitende oefening voor de schouders. Trek naar je gezicht, ellebogen hoog.',
      tip_en:'Finishing exercise for the shoulders. Pull towards your face, elbows high.',
      youtube:'https://www.youtube.com/watch?v=rep-qVOkqgk',
      photo:'https://images.pexels.com/photos/4162481/pexels-photo-4162481.jpeg?auto=compress&cs=tinysrgb&w=400&h=300&fit=crop',
      alts:[
        { name:'Band Pull Apart', icon:'↔️', sets:3, reps:'20', rest:'45 sec', tip:'Weerstandsband voor je op borsthoogte, trek uiteen. Schouderbladen samenknijpen.', tip_en:'Resistance band in front at chest height, pull apart. Squeeze shoulder blades together.', youtube:'https://www.youtube.com/watch?v=rep-qVOkqgk', photo:'https://images.pexels.com/photos/4162481/pexels-photo-4162481.jpeg?auto=compress&cs=tinysrgb&w=400&h=300&fit=crop'},
        { name:'Reverse Fly', icon:'🦋', sets:3, reps:'15', rest:'60 sec', tip:'Voorovergebogen, armen zijwaarts heffen. Achterkant schouders.', tip_en:'Bent forward, raise arms sideways. Rear shoulders.', youtube:'https://www.youtube.com/watch?v=Pq-mQ76-VWg', photo:'https://images.pexels.com/photos/2261477/pexels-photo-2261477.jpeg?auto=compress&cs=tinysrgb&w=400&h=300&fit=crop'},
      ]},
  ]
};


// ========== MAALTIJDPLAN ==========
// De ontbijt/lunch/avond/snack-lijsten per type bestaan nog voor een paar
// legacy plekken (o.a. beheer.js foto-overzicht), maar zijn altijd leeg --
// de coach voegt gerechten nu toe via de "+ Gerecht toevoegen"-tab (zie
// customMeals in state.js). Er is GEEN dagdoel meer per type: zie
// getDagDoel() hieronder, dat volledig losstaat van Herstel/Normaal/Zwaar.
const MEALS = {
  herstel: { ontbijt: [], lunch: [], avond: [], snack: [] },
  normaal: { ontbijt: [], lunch: [], avond: [], snack: [] },
  zwaar:   { ontbijt: [], lunch: [], avond: [], snack: [] }
};

// Bepaalt het dag-doel (kcal/eiwit/koolh/vet) -- één vast doel per klant,
// losstaand van het dagtype (Herstel/Normaal/Zwaar) uit de check-in. Dat
// dagtype bepaalt nog wél de trainingsintensiteit/oefeningkeuze elders in de
// app, maar heeft GEEN invloed meer op voedingsdoelen.
//
// Kcal: profile.calorieBehoefte (ingevuld in Profiel), of 2000 als die nog
// leeg staat. Eiwit: profile.proteinPerKg (standaard 2) g/kg lichaamsgewicht
// (profile.weight, of 70kg als dat ontbreekt). Koolhydraten en vet vullen de
// resterende calorieën aan volgens profile.carbPct (standaard 60/40) -- zodat
// eiwit+koolh+vet altijd exact optellen tot het kcal-doel. Zie berekenDagDoel().
// Eén plek die uit een profiel het dagdoel uitrekent, zodat Profiel (live
// voorbeeld), Voeding, Dashboard, Voortgang en de check-in nooit uiteenlopen.
// Eiwit = proteinPerKg (standaard 2) x lichaamsgewicht. De overige calorieën
// worden verdeeld in carbPct % koolhydraten en de rest vet (standaard 60/40).
// Zonder ingevulde waarden blijft het dus precies zoals het altijd was.
function berekenDagDoel(p) {
  p = p || {};
  const kcal = (p.calorieBehoefte && p.calorieBehoefte > 0) ? p.calorieBehoefte : 2000;
  const gewicht = p.weight > 0 ? p.weight : 70;
  const perKg = (typeof p.proteinPerKg === 'number' && p.proteinPerKg > 0) ? p.proteinPerKg : 2;
  const carbPct = (typeof p.carbPct === 'number' && p.carbPct >= 0 && p.carbPct <= 100) ? p.carbPct : 60;

  const prot = Math.round(gewicht * perKg);
  const protKcal = prot * 4;
  const restKcal = Math.max(0, kcal - protKcal);
  const carbRatio = carbPct / 100;

  const carb = Math.round((restKcal * carbRatio) / 4);
  const fat = Math.round((restKcal * (1 - carbRatio)) / 9);

  return {
    kcal, prot, carb, fat, perKg, carbPct,
    // Eiwit alleen is al meer dan het kcal-doel: past niet.
    proteinTeHoog: protKcal > kcal,
    // Waarschuwing: meer dan 3 g eiwit per kg lichaamsgewicht.
    proteinHoog: perKg > 3
  };
}
function getDagDoel() {
  return berekenDagDoel(profile);
}

// Marge rond het doel waarbinnen een waarde als "gehaald" telt: calorieën
// ±10%, de drie macro's (eiwit/koolhydraten/vet) ±20% -- die laatste
// schommelen van nature meer per dag (afhankelijk van wát je eet) dan het
// totale calorieaantal, dus een even strakke marge als bij kcal sloeg te
// vaak ten onrechte aan als "niet gehaald". Eén plek voor deze marge, zodat
// de balkjes op Voeding, het dashboardkaartje en Voortgang → Voeding allemaal
// dezelfde limieten tonen.
function macroTolerantie(key) {
  return key === 'kcal' ? 0.1 : 0.2;
}
// profielOverride (optioneel): gebruik het profiel van een ANDERE klant dan
// de actieve (bv. calcSignalenVoorKlant() in history.js, dat per klant in de
// Signalen-lijst een eigen los opgehaald profiel doorgeeft i.p.v. de globale
// `profile`-variabele, die alleen de actieve/bekeken klant is).
function macroDoelRange(doelVal, key, profielOverride) {
  const tol = macroTolerantie(key);
  const p = profielOverride !== undefined ? profielOverride : (typeof profile !== 'undefined' ? profile : null);
  // Calorieën: handmatige onder-/bovengrens uit het profiel wint, per grens
  // apart -- vul je er maar één in, dan blijft de andere gewoon de
  // automatische marge. Zie profile.js (p-calorie-min/-max).
  if (key === 'kcal' && p && (p.calorieMin || p.calorieMax)) {
    return {
      min: p.calorieMin || Math.round(doelVal * (1 - tol)),
      max: p.calorieMax || Math.round(doelVal * (1 + tol))
    };
  }
  return { min: Math.round(doelVal * (1 - tol)), max: Math.round(doelVal * (1 + tol)) };
}


// ========== CLAUDE SYSTEEM PROMPT ==========
const SYSTEM = `Je bent coach Anneke, een AI lifestyle coach. Direct, nuchter, warm en motiverend. Geen zweverige termen. Je combineert coachende vragen met concreet advies voor duurzame leefstijlverandering. Jij en je vrouw zijn zelf in 2018 volledig overgestapt naar een gezonde leefstijl — van overgewicht en gezondheidsklachten naar een sterk, fit lichaam. Dat maakt je geloofwaardig en menselijk. Antwoord altijd in het Nederlands. Maximaal 120 woorden per antwoord. Geen opsommingslijsten tenzij gevraagd.`;

const SYSTEM_EN = `You are coach Anneke, an AI lifestyle coach. Direct, down-to-earth, warm and motivating. No fluffy terms. You combine coaching questions with concrete advice for sustainable lifestyle change. You and your wife made a full switch to a healthy lifestyle yourselves in 2018 — from being overweight and dealing with health issues to a strong, fit body. That makes you credible and human. Always answer in English. Maximum 120 words per answer. No bullet lists unless asked for.`;

// ========== BASISPRODUCTEN ==========
// Macros per 100g: kcal, prot, carb, fat
const PRODUCTS = [
  // FRUIT
  { id:'p1', name:'Appel', name_en:'Apple', icon:'🍎', cat:'fruit', kcal:48, prot:0, carb:12, fat:0, portie:{ gram:150, label:'1 appel', label_en:'1 apple' }, photo:'images/producten/p1.jpg'},
  { id:'p2', name:'Banaan', name_en:'Banana', icon:'🍌', cat:'fruit', kcal:87, prot:1.1, carb:20, fat:0.3, portie:{ gram:100, label:'1 banaan', label_en:'1 banana' }, photo:'images/producten/p2.jpg'},
  { id:'p3', name:'Aardbei', name_en:'Strawberry', icon:'🍓', cat:'fruit', kcal:32, prot:0.7, carb:8, fat:0.3, photo:'images/producten/p3.jpg'},
  { id:'p4', name:'Bosbes', name_en:'Blueberry', icon:'🫐', cat:'fruit', kcal:57, prot:0.7, carb:14, fat:0.3, photo:'images/producten/p4.jpg'},
  { id:'p5', name:'Sinaasappel', name_en:'Orange', icon:'🍊', cat:'fruit', kcal:47, prot:0.9, carb:12, fat:0.1, photo:'images/producten/p5.jpg'},
  { id:'p6', name:'Mango', name_en:'Mango', icon:'🥭', cat:'fruit', kcal:60, prot:0.8, carb:15, fat:0.4, photo:'images/producten/p6.jpg'},
  { id:'p7', name:'Peer', name_en:'Pear', icon:'🍐', cat:'fruit', kcal:57, prot:0.4, carb:15, fat:0.1, photo:'images/producten/p7.jpg'},
  { id:'p8', name:'Watermeloen', name_en:'Watermelon', icon:'🍉', cat:'fruit', kcal:30, prot:0.6, carb:8, fat:0.2, photo:'images/producten/p8.jpg'},
  { id:'p9', name:'Druiven', name_en:'Grapes', icon:'🍇', cat:'fruit', kcal:67, prot:0.6, carb:17, fat:0.4, photo:'images/producten/p9.jpg'},
  { id:'p10', name:'Kiwi', name_en:'Kiwi', icon:'🥝', cat:'fruit', kcal:61, prot:1.1, carb:15, fat:0.5, photo:'images/producten/p10.jpg'},
  { id:'p11', name:'Ananas', name_en:'Pineapple', icon:'🍍', cat:'fruit', kcal:54, prot:0.5, carb:12, fat:0.1, photo:'images/producten/p11.jpg'},
  { id:'p12', name:'Framboos', name_en:'Raspberry', icon:'🍓', cat:'fruit', kcal:37, prot:1.4, carb:4.5, fat:0.3, photo:'images/producten/p12.jpg'},
  { id:'p13', name:'Mandarijn', name_en:'Mandarin', icon:'🍊', cat:'fruit', kcal:47, prot:0.7, carb:9.8, fat:0.2, portie:{ gram:60, label:'1 mandarijn', label_en:'1 mandarin' }, photo:'images/producten/p13.jpg'},
  { id:'p14', name:'Perzik', name_en:'Peach', icon:'🍑', cat:'fruit', kcal:40, prot:1, carb:7.2, fat:0.1, portie:{ gram:115, label:'1 perzik', label_en:'1 peach' }, photo:'images/producten/p14.jpg'},
  { id:'p15', name:'Pruim', name_en:'Plum', icon:'🍑', cat:'fruit', kcal:40, prot:0.8, carb:7.3, fat:0, portie:{ gram:40, label:'1 pruim', label_en:'1 plum' }, photo:'images/producten/p15.jpg'},
  { id:'p16', name:'Kersen', name_en:'Cherries', icon:'🍒', cat:'fruit', kcal:57, prot:0.9, carb:11.5, fat:0.4, photo:'images/producten/p16.jpg'},
  { id:'p17', name:'Honingmeloen', name_en:'Honeydew melon', icon:'🍈', cat:'fruit', kcal:30, prot:0.9, carb:6.3, fat:0, photo:'images/producten/p17.jpg'},
  { id:'p18', name:'Citroen', name_en:'Lemon', icon:'🍋', cat:'fruit', kcal:35, prot:0.8, carb:3.1, fat:0.3, portie:{ gram:65, label:'1 citroen', label_en:'1 lemon' }, photo:'images/producten/p18.jpg'},
  { id:'p19', name:'Grapefruit', name_en:'Grapefruit', icon:'🍊', cat:'fruit', kcal:37, prot:0.9, carb:6.6, fat:0, portie:{ gram:150, label:'1 grapefruit', label_en:'1 grapefruit' }, photo:'images/producten/p19.jpg'},
  { id:'p20', name:'Bramen', name_en:'Blackberries', icon:'🫐', cat:'fruit', kcal:37, prot:0.9, carb:5.1, fat:0.2, photo:'images/producten/p20.jpg'},
  { id:'p21', name:'Granaatappel', name_en:'Pomegranate', icon:'🍎', cat:'fruit', kcal:91, prot:1, carb:17, fat:1, portie:{ gram:150, label:'1 granaatappel', label_en:'1 pomegranate' }, photo:'images/producten/p21.jpg'},
  { id:'p22', name:'Dadels (gedroogd)', name_en:'Dates (dried)', icon:'🌰', cat:'fruit', kcal:300, prot:1.7, carb:70, fat:0, portie:{ gram:6, label:'1 dadel', label_en:'1 date' }, photo:'images/producten/p22.jpg'},
  { id:'p23', name:'Rozijnen', name_en:'Raisins', icon:'🍇', cat:'fruit', kcal:325, prot:3, carb:71.5, fat:0.5, portie:{ gram:20, label:'1 handje', label_en:'1 handful' }, photo:'images/producten/p23.jpg'},
  // GROENTE
  { id:'g1', name:'Broccoli', name_en:'Broccoli', icon:'🥦', cat:'groente', kcal:20, prot:2.7, carb:0.7, fat:0.7, photo:'images/producten/g1.jpg'},
  { id:'g2', name:'Spinazie', name_en:'Spinach', icon:'🥬', cat:'groente', kcal:23, prot:2.9, carb:4, fat:0.4, photo:'images/producten/g2.jpg'},
  { id:'g3', name:'Wortel', name_en:'Carrot', icon:'🥕', cat:'groente', kcal:27, prot:1, carb:5.2, fat:0.2, photo:'images/producten/g3.jpg'},
  { id:'g4', name:'Komkommer', name_en:'Cucumber', icon:'🥒', cat:'groente', kcal:12, prot:0.7, carb:1.3, fat:0.4, portie:{ gram:400, label:'1 komkommer', label_en:'1 cucumber' }, photo:'images/producten/g4.jpg'},
  { id:'g5', name:'Tomaat', name_en:'Tomato', icon:'🍅', cat:'groente', kcal:27, prot:0.9, carb:4, fat:0.8, photo:'images/producten/g5.jpg'},
  { id:'g6', name:'Paprika', name_en:'Bell pepper', icon:'🫑', cat:'groente', kcal:21, prot:0.8, carb:4.1, fat:0.2, photo:'images/producten/g6.jpg'},
  { id:'g7', name:'Zoete aardappel', name_en:'Sweet potato', icon:'🍠', cat:'groente', kcal:92, prot:1.2, carb:21, fat:0.3, photo:'images/producten/g7.jpg'},
  { id:'g8', name:'Courgette', name_en:'Zucchini', icon:'🥬', cat:'groente', kcal:16, prot:1.3, carb:2.3, fat:0.2, portie:{ gram:300, label:'1 courgette', label_en:'1 zucchini' }, photo:'images/producten/g8.jpg'},
  { id:'g9', name:'Bloemkool', name_en:'Cauliflower', icon:'🥦', cat:'groente', kcal:21, prot:1.9, carb:3, fat:0.2, photo:'images/producten/g9.jpg'},
  { id:'g10', name:'Sperziebonen', name_en:'Green beans', icon:'🫛', cat:'groente', kcal:30, prot:2, carb:5, fat:0.2, photo:'images/producten/g10.jpg'},
  { id:'g11', name:'Avocado', name_en:'Avocado', icon:'🥑', cat:'groente', kcal:326, prot:3.8, carb:3.2, fat:33.1, photo:'images/producten/g11.jpg'},
  { id:'g12', name:'Ui', name_en:'Onion', icon:'🧅', cat:'groente', kcal:32, prot:1.3, carb:6.3, fat:0.2, photo:'images/producten/g12.jpg'},
  { id:'g13', name:'Doperwten', name_en:'Green peas', icon:'🫛', cat:'groente', kcal:81, prot:5.4, carb:14, fat:0.4, photo:'images/producten/g13.jpg'},
  { id:'g14', name:'Champignons', name_en:'Mushrooms', icon:'🍄', cat:'groente', kcal:28, prot:2.5, carb:4.3, fat:0.1, photo:'images/producten/g14.jpg'},
  { id:'g15', name:'Aziatische Wokgroenten', name_en:'Asian wok vegetables', icon:'🥬', cat:'groente', kcal:19, prot:3.5, carb:0.1, fat:0.5, photo:'images/producten/g15.jpg'},
  { id:'g17', name:'Pompoen', name_en:'Pumpkin', icon:'🎃', cat:'groente', kcal:35, prot:1, carb:7, fat:0.3, photo:'images/producten/g17.jpg'},
  { id:'g18', name:'Wortelpeterselie', name_en:'Hamburg parsley root', icon:'🥕', cat:'groente', kcal:46, prot:2.3, carb:8, fat:0.5, photo:'images/producten/g18.jpg'},
  { id:'g19', name:'Spruiten', name_en:'Brussels sprouts', icon:'🥦', cat:'groente', kcal:34, prot:4.5, carb:3.3, fat:0.3, photo:'images/producten/g19.jpg'},
  { id:'g20', name:'Asperges', name_en:'Asparagus', icon:'🌱', cat:'groente', kcal:16, prot:1, carb:3, fat:0, photo:'images/producten/g20.jpg'},
  { id:'g21', name:'Tuinerwten', name_en:'Garden peas', icon:'🫛', cat:'groente', kcal:79, prot:6.6, carb:12, fat:0.5, photo:'images/producten/g21.jpg'},
  { id:'g22', name:'Koolraap', name_en:'Kohlrabi', icon:'🥬', cat:'groente', kcal:26, prot:1, carb:5, fat:0.2, photo:'images/producten/g22.jpg'},
  { id:'g23', name:'Witlof', name_en:'Chicory (Belgian endive)', icon:'🥬', cat:'groente', kcal:19, prot:1.3, carb:2.4, fat:0.3, photo:'images/producten/g23.jpg'},
  { id:'g24', name:'Sla', name_en:'Lettuce', icon:'🥬', cat:'groente', kcal:12, prot:1.6, carb:0.4, fat:0.4, photo:'images/producten/g24.jpg'},
  { id:'g25', name:'Bleekselderij', name_en:'Celery', icon:'🥬', cat:'groente', kcal:14, prot:1, carb:2, fat:0, photo:'images/producten/g25.jpg'},
  { id:'g26', name:'Olijven (groen)', name_en:'Green olives', icon:'🫒', cat:'groente', kcal:112, prot:1, carb:0.5, fat:11, photo:'images/producten/g26.jpg'},
  { id:'g27', name:'Olijven (zwart)', name_en:'Black olives', icon:'🫒', cat:'groente', kcal:162, prot:1, carb:1.8, fat:14, photo:'images/producten/g27.jpg'},
  { id:'g28', name:'Rode ui', name_en:'Red onion', icon:'🧅', cat:'groente', kcal:37, prot:1.3, carb:5.6, fat:0.4, photo:'images/producten/g28.jpg'},
  { id:'g29', name:'Knoflook', name_en:'Garlic', icon:'🧄', cat:'groente', kcal:150, prot:5, carb:30, fat:0, portie:{ gram:2, label:'1 teentje', label_en:'1 clove' }, photo:'images/producten/g29.jpg'},
  { id:'g30', name:'Prei', name_en:'Leek', icon:'🥬', cat:'groente', kcal:28, prot:1.6, carb:3.6, fat:0, photo:'images/producten/g30.jpg'},
  { id:'g31', name:'Aubergine', name_en:'Eggplant', icon:'🍆', cat:'groente', kcal:20, prot:1, carb:3, fat:0, portie:{ gram:290, label:'1 aubergine', label_en:'1 eggplant' }, photo:'images/producten/g31.jpg'},
  { id:'g32', name:'Rucola', name_en:'Arugula', icon:'🥬', cat:'groente', kcal:24, prot:3.6, carb:0, fat:0.4, photo:'images/producten/g32.jpg'},
  { id:'g33', name:'IJsbergsla', name_en:'Iceberg lettuce', icon:'🥬', cat:'groente', kcal:16, prot:0.8, carb:1.6, fat:0, photo:'images/producten/g33.jpg'},
  { id:'g34', name:'Radijs', name_en:'Radish', icon:'🥬', cat:'groente', kcal:25, prot:1.3, carb:3.8, fat:0, portie:{ gram:8, label:'1 radijs', label_en:'1 radish' }, photo:'images/producten/g34.jpg'},
  { id:'g35', name:'Rode biet', name_en:'Beetroot', icon:'🥬', cat:'groente', kcal:38, prot:1.6, carb:6, fat:0.1, portie:{ gram:85, label:'1 biet', label_en:'1 beetroot' }, photo:'images/producten/g35.jpg'},
  { id:'g36', name:'Lente-ui', name_en:'Spring onion', icon:'🧅', cat:'groente', kcal:37, prot:1.3, carb:6.3, fat:0.2, photo:'images/producten/g36.jpg'},
  { id:'g37', name:'Venkel', name_en:'Fennel', icon:'🥬', cat:'groente', kcal:17, prot:1, carb:2, fat:0, photo:'images/producten/g37.jpg'},
  { id:'g38', name:'Maïs', name_en:'Sweet corn', icon:'🌽', cat:'groente', kcal:74, prot:2.5, carb:11.6, fat:1.4, portie:{ gram:175, label:'1 maiskolf', label_en:'1 corn cob' }, photo:'images/producten/g38.jpg'},
  { id:'g39', name:'Rode kool', name_en:'Red cabbage', icon:'🥬', cat:'groente', kcal:28, prot:2, carb:3.2, fat:0, photo:'images/producten/g39.jpg'},
  { id:'g40', name:'Witte kool', name_en:'White cabbage', icon:'🥬', cat:'groente', kcal:30, prot:2, carb:4, fat:0, photo:'images/producten/g40.jpg'},
  { id:'g41', name:'Spitskool', name_en:'Pointed cabbage', icon:'🥬', cat:'groente', kcal:40, prot:3.2, carb:4, fat:0.8, photo:'images/producten/g41.jpg'},
  { id:'g42', name:'Boerenkool', name_en:'Kale', icon:'🥬', cat:'groente', kcal:33, prot:3, carb:1.6, fat:0.6, photo:'images/producten/g42.jpg'},
  { id:'g43', name:'Andijvie', name_en:'Curly endive', icon:'🥬', cat:'groente', kcal:16, prot:1.6, carb:0.8, fat:0.4, photo:'images/producten/g43.jpg'},
  { id:'g44', name:'Veldsla', name_en:"Lamb's lettuce", icon:'🥬', cat:'groente', kcal:16, prot:2.4, carb:0.4, fat:0, photo:'images/producten/g44.jpg'},
  { id:'g45', name:'Paksoi', name_en:'Pak choi', icon:'🥬', cat:'groente', kcal:16, prot:0.8, carb:1.6, fat:0, photo:'images/producten/g45.jpg'},
  { id:'g46', name:'Snijbonen', name_en:'Runner beans', icon:'🥬', cat:'groente', kcal:22, prot:1.8, carb:2, fat:0.2, photo:'images/producten/g46.jpg'},
  { id:'g47', name:'Tuinbonen', name_en:'Broad beans', icon:'🥬', cat:'groente', kcal:51, prot:5.1, carb:4, fat:0, photo:'images/producten/g47.jpg'},
  { id:'g48', name:'Pastinaak', name_en:'Parsnip', icon:'🥬', cat:'groente', kcal:71, prot:1.8, carb:10.9, fat:1.1, photo:'images/producten/g48.jpg'},
  { id:'g49', name:'Knolselderij', name_en:'Celeriac', icon:'🥬', cat:'groente', kcal:39, prot:2, carb:5, fat:0, photo:'images/producten/g49.jpg'},
  { id:'g50', name:'Artisjok (blik/glas)', name_en:'Artichoke (canned/jarred)', icon:'🥬', cat:'groente', kcal:48, prot:2, carb:9.5, fat:0, photo:'images/producten/g50.jpg'},
  { id:'g51', name:'Zuurkool', name_en:'Sauerkraut', icon:'🥬', cat:'groente', kcal:12, prot:1.2, carb:0.6, fat:0, photo:'images/producten/g51.jpg'},
  { id:'g52', name:'Gedroogde tomaat (zongedroogd)', name_en:'Sun-dried tomato', icon:'🍅', cat:'groente', kcal:333, prot:14, carb:56, fat:2.7, portie:{ gram:15, label:'1 stuk', label_en:'1 piece' }, photo:'images/producten/g52.jpg'},
  // VLEES
  { id:'v1', name:'Kipfilet', name_en:'Chicken breast', icon:'🍗', cat:'vlees', kcal:113, prot:23, carb:0, fat:2.3, photo:'images/producten/v1.jpg'},
  { id:'v2', name:'Kipgehakt', name_en:'Ground chicken', icon:'🍗', cat:'vlees', kcal:143, prot:17, carb:0, fat:8, photo:'images/producten/v2.jpg'},
  { id:'v3', name:'Rundergehakt (mager)', name_en:'Ground beef (lean)', icon:'🥩', cat:'vlees', kcal:154, prot:21, carb:0, fat:7, photo:'images/producten/v3.jpg'},
  { id:'v4', name:'Biefstuk', name_en:'Steak', icon:'🥩', cat:'vlees', kcal:180, prot:26, carb:0, fat:8, photo:'images/producten/v4.jpg'},
  { id:'v5', name:'Kalkoenfilet', name_en:'Turkey breast', icon:'🍗', cat:'vlees', kcal:104, prot:22, carb:0, fat:1.5, photo:'images/producten/v5.jpg'},
  { id:'v6', name:'Pulled chicken', name_en:'Pulled chicken', icon:'🍗', cat:'vlees', kcal:130, prot:24, carb:0, fat:3, photo:'images/producten/v6.jpg'},
  { id:'v7', name:'Spek (mager)', name_en:'Bacon (lean)', icon:'🥓', cat:'vlees', kcal:218, prot:14, carb:0, fat:18, photo:'images/producten/v7.jpg'},
  { id:'v8', name:'Hamburger (mager)', name_en:'Hamburger (lean)', icon:'🍔', cat:'vlees', kcal:165, prot:20, carb:0, fat:9, photo:'images/producten/v8.jpg'},
  { id:'v9', name:'Rosbief', name_en:'Roast beef', icon:'🥩', cat:'vlees', kcal:149, prot:22, carb:0, fat:6.5, photo:'images/producten/v9.jpg'},
  { id:'v10', name:'Lamsvlees', name_en:'Lamb', icon:'🍖', cat:'vlees', kcal:294, prot:25, carb:0, fat:21, photo:'images/producten/v10.jpg'},
  { id:'v11', name:'Hertenbiefstuk', name_en:'Venison steak', icon:'🦌', cat:'vlees', kcal:120, prot:22, carb:0, fat:3.6, photo:'images/producten/v11.jpg'},
  { id:'v12', name:'Hertenhamburger', name_en:'Venison burger', icon:'🦌', cat:'vlees', kcal:120, prot:22, carb:0, fat:3.6, photo:'images/producten/v12.jpg'},
  { id:'v13', name:'Hertenstoof', name_en:'Venison stew meat', icon:'🦌', cat:'vlees', kcal:120, prot:22, carb:0, fat:3.6, photo:'images/producten/v13.jpg'},
  { id:'v14', name:'Hertenworstjes', name_en:'Venison sausages', icon:'🦌', cat:'vlees', kcal:200, prot:16.1, carb:0.2, fat:15, photo:'images/producten/v14.jpg'},
  { id:'v15', name:'Runderstoof', name_en:'Beef stew meat', icon:'🥩', cat:'vlees', kcal:106, prot:22, carb:0, fat:2, photo:'images/producten/v15.jpg'},
  { id:'v16', name:'Runderhamburger', name_en:'Beef burger', icon:'🍔', cat:'vlees', kcal:232, prot:18, carb:4, fat:16, photo:'images/producten/v16.jpg'},
  { id:'v17', name:'Herten/runderhamburger', name_en:'Venison/beef burger', icon:'🍔', cat:'vlees', kcal:176, prot:20, carb:2, fat:9.8, photo:'images/producten/v17.jpg'},
  { id:'v18', name:'Kipshoarma', name_en:'Chicken shoarma', icon:'🍗', cat:'vlees', kcal:92, prot:19, carb:0, fat:1.8, photo:'images/producten/v18.jpg'},
  { id:'v19', name:'Kipdij (zonder vel)', name_en:'Chicken thigh (skinless)', icon:'🍗', cat:'vlees', kcal:139, prot:20.5, carb:0, fat:6.3, photo:'images/producten/v19.jpg'},
  { id:'v20', name:'Varkenshaas', name_en:'Pork tenderloin', icon:'🥩', cat:'vlees', kcal:105, prot:22.4, carb:0, fat:1.7, photo:'images/producten/v20.jpg'},
  { id:'v21', name:'Ham (gekookt)', name_en:'Ham (cooked)', icon:'🥓', cat:'vlees', kcal:132, prot:18.2, carb:2.7, fat:5.9, portie:{ gram:22, label:'1 plak', label_en:'1 slice' }, photo:'images/producten/v21.jpg'},
  { id:'v22', name:'Kalkoengehakt', name_en:'Turkey mince', icon:'🍗', cat:'vlees', kcal:141, prot:21.8, carb:0, fat:6, photo:'images/producten/v22.jpg'},
  { id:'v23', name:'Kippenpoot / drumstick', name_en:'Chicken drumstick', icon:'🍗', cat:'vlees', kcal:148, prot:19.1, carb:0, fat:7.9, portie:{ gram:80, label:'1 drumstick', label_en:'1 drumstick' }, photo:'images/producten/v23.jpg'},
  { id:'v24', name:'Half-om-halfgehakt', name_en:'Mixed beef and pork mince', icon:'🥩', cat:'vlees', kcal:233, prot:19.2, carb:0.3, fat:17.2, photo:'images/producten/v24.jpg'},
  { id:'v25', name:'Kalfsvlees', name_en:'Veal', icon:'🥩', cat:'vlees', kcal:105, prot:22, carb:0, fat:1.8, photo:'images/producten/v25.jpg'},
  { id:'v26', name:'Kipfiletblokjes', name_en:'Diced chicken breast', icon:'🍗', cat:'vlees', kcal:109, prot:23.3, carb:0, fat:1.8, photo:'images/producten/v26.jpg'},
  { id:'v27', name:'Kippenlever', name_en:'Chicken liver', icon:'🍗', cat:'vlees', kcal:128, prot:19.2, carb:0.8, fat:5.6, photo:'images/producten/v27.jpg'},
  { id:'v28', name:'Eendenborst', name_en:'Duck breast', icon:'🦆', cat:'vlees', kcal:388, prot:13.1, carb:0, fat:37.3, photo:'images/producten/v28.jpg'},
  { id:'v29', name:'Rookworst (varken)', name_en:'Smoked sausage (pork)', icon:'🌭', cat:'vlees', kcal:304, prot:14.1, carb:2.6, fat:26.3, photo:'images/producten/v29.jpg'},
  // VIS
  { id:'f1', name:'Kweekzalm', name_en:'Farmed salmon', icon:'🐟', cat:'vis', kcal:225, prot:18, carb:0, fat:17, photo:'images/producten/f1.jpg'},
  { id:'f13', name:'Wilde zalm', name_en:'Wild salmon', icon:'🐟', cat:'vis', kcal:123, prot:24, carb:0, fat:3, photo:'images/producten/f13.jpg'},
  { id:'f2', name:'Tonijn (blik, water)', name_en:'Tuna (canned, water)', icon:'🐟', cat:'vis', kcal:84, prot:19, carb:0, fat:0.5, photo:'images/producten/f2.jpg'},
  { id:'f3', name:'Kabeljauw', name_en:'Cod', icon:'🐠', cat:'vis', kcal:82, prot:18, carb:0, fat:0.7, photo:'images/producten/f3.jpg'},
  { id:'f4', name:'Tilapia', name_en:'Tilapia', icon:'🐠', cat:'vis', kcal:96, prot:20, carb:0, fat:1.7, photo:'images/producten/f4.jpg'},
  { id:'f5', name:'Makreel', name_en:'Mackerel', icon:'🐟', cat:'vis', kcal:205, prot:19, carb:0, fat:14, photo:'images/producten/f5.jpg'},
  { id:'f6', name:'Garnalen', name_en:'Shrimp', icon:'🦐', cat:'vis', kcal:85, prot:18, carb:1, fat:1, photo:'images/producten/f6.jpg'},
  { id:'f7', name:'Haring', name_en:'Herring', icon:'🐟', cat:'vis', kcal:158, prot:18, carb:0, fat:9, photo:'images/producten/f7.jpg'},
  { id:'f8', name:"Gamba's", name_en:'King prawns', icon:'🦐', cat:'vis', kcal:99, prot:24, carb:0.2, fat:0.3, photo:'images/producten/f8.jpg'},
  { id:'f9', name:'Witvis', name_en:'White fish', icon:'🐟', cat:'vis', kcal:90, prot:20, carb:0, fat:1, photo:'images/producten/f9.jpg'},
  { id:'f10', name:'Kreeft', name_en:'Lobster', icon:'🦞', cat:'vis', kcal:89, prot:19, carb:0, fat:0.9, photo:'images/producten/f10.jpg'},
  { id:'f11', name:'Paling', name_en:'Eel', icon:'🐟', cat:'vis', kcal:236, prot:18, carb:0, fat:18, photo:'images/producten/f11.jpg'},
  { id:'f12', name:'Sardines', name_en:'Sardines', icon:'🐟', cat:'vis', kcal:208, prot:25, carb:0, fat:11, photo:'images/producten/f12.jpg'},
  { id:'f14', name:'Gerookte zalm', name_en:'Smoked salmon', icon:'🐟', cat:'vis', kcal:188, prot:21.6, carb:0.8, fat:10.8, portie:{ gram:25, label:'1 plakje', label_en:'1 slice' }, photo:'images/producten/f14.jpg'},
  { id:'f15', name:'Pangasius', name_en:'Pangasius', icon:'🐟', cat:'vis', kcal:74, prot:14.9, carb:0, fat:1.6, portie:{ gram:120, label:'1 filet', label_en:'1 fillet' }, photo:'images/producten/f15.jpg'},
  { id:'f16', name:'Mosselen (gekookt)', name_en:'Mussels (cooked)', icon:'🦪', cat:'vis', kcal:125, prot:17.2, carb:7.2, fat:3.1, photo:'images/producten/f16.jpg'},
  { id:'f17', name:'Tonijn (vers)', name_en:'Tuna (fresh)', icon:'🐟', cat:'vis', kcal:101, prot:23.7, carb:0, fat:0.7, photo:'images/producten/f17.jpg'},
  { id:'f18', name:'Schol', name_en:'Plaice', icon:'🐟', cat:'vis', kcal:76, prot:16.4, carb:0, fat:1.2, photo:'images/producten/f18.jpg'},
  { id:'f19', name:'Forel', name_en:'Trout', icon:'🐟', cat:'vis', kcal:242, prot:17.2, carb:0.3, fat:19.1, photo:'images/producten/f19.jpg'},
  { id:'f20', name:'Zeebaars', name_en:'Sea bass', icon:'🐟', cat:'vis', kcal:92, prot:19.7, carb:0, fat:1.5, photo:'images/producten/f20.jpg'},
  { id:'f21', name:'Kibbeling', name_en:'Battered fish bites', icon:'🐟', cat:'vis', kcal:210, prot:19, carb:8.2, fat:11.2, portie:{ gram:145, label:'1 portie', label_en:'1 portion' }, photo:'images/producten/f21.jpg'},
  { id:'f22', name:'Ansjovis', name_en:'Anchovies', icon:'🐟', cat:'vis', kcal:200, prot:25, carb:0, fat:12.5, portie:{ gram:4, label:'1 filet', label_en:'1 fillet' }, photo:'images/producten/f22.jpg'},
  { id:'f23', name:'Zalm (blik)', name_en:'Salmon (canned)', icon:'🐟', cat:'vis', kcal:145, prot:20.5, carb:0, fat:7.3, photo:'images/producten/f23.jpg'},
  { id:'f24', name:'Surimi', name_en:'Surimi', icon:'🐟', cat:'vis', kcal:124, prot:7.1, carb:15.3, fat:3.5, portie:{ gram:17, label:'1 stokje', label_en:'1 stick' }, photo:'images/producten/f24.jpg'},
  // ZUIVEL
  { id:'z1', name:'Griekse yoghurt (0%)', name_en:'Greek yogurt (0%)', icon:'🥛', cat:'zuivel', kcal:59, prot:10, carb:4, fat:0.4, photo:'images/producten/z1.jpg'},
  { id:'z2', name:'Kwark', name_en:'Quark', icon:'🥛', cat:'zuivel', kcal:57, prot:9, carb:4, fat:0.2, photo:'images/producten/z2.jpg'},
  { id:'z3', name:'Cottage cheese', name_en:'Cottage cheese', icon:'🧀', cat:'zuivel', kcal:98, prot:11, carb:3, fat:4, photo:'images/producten/z3.jpg'},
  { id:'z4', name:'Eieren', name_en:'Eggs', icon:'🥚', cat:'zuivel', kcal:142, prot:12, carb:1, fat:10, portie:{ gram:50, label:'1 ei', label_en:'1 egg' }, photo:'images/producten/z4.jpg'},
  { id:'z5', name:'Volle melk', name_en:'Whole milk', icon:'🥛', cat:'zuivel', kcal:61, prot:3.2, carb:5, fat:3.5, photo:'images/producten/z5.jpg'},
  { id:'z6', name:'Halfvolle melk', name_en:'Semi-skimmed milk', icon:'🥛', cat:'zuivel', kcal:46, prot:3.4, carb:5, fat:1.5, photo:'images/producten/z6.jpg'},
  { id:'z7', name:'Mozzarella', name_en:'Mozzarella', icon:'🧀', cat:'zuivel', kcal:280, prot:18, carb:3, fat:22, photo:'images/producten/z7.jpg'},
  { id:'z8', name:'Eiwitpoeder (whey)', name_en:'Protein powder (whey)', icon:'🥛', cat:'zuivel', kcal:380, prot:80, carb:8, fat:5, photo:'images/producten/z8.jpg'},
  { id:'z9', name:'Eiwit', name_en:'Egg white', icon:'🥚', cat:'zuivel', kcal:52, prot:11, carb:0.7, fat:0.2, photo:'images/producten/z9.jpg'},
  { id:'z10', name:'Skyr', name_en:'Skyr', icon:'🥛', cat:'zuivel', kcal:63, prot:11, carb:4, fat:0.2, photo:'images/producten/z10.jpg'},
  { id:'z11', name:'Kaas 20+', name_en:'Cheese (20+ fat)', icon:'🧀', cat:'zuivel', kcal:264, prot:24, carb:0, fat:19, photo:'images/producten/z11.jpg'},
  { id:'z12', name:'Eigeel', name_en:'Egg yolk', icon:'🥚', cat:'zuivel', kcal:322, prot:16, carb:3.6, fat:27, photo:'images/producten/z12.jpg'},
  { id:'z13', name:'Kaas 45+', name_en:'Cheese (45+ fat)', icon:'🧀', cat:'zuivel', kcal:350, prot:25, carb:0, fat:28, photo:'images/producten/z13.jpg'},
  { id:'z14', name:'Eiwitpoeder (Evou)', name_en:'Protein powder (Evou)', icon:'🥛', cat:'zuivel', kcal:373, prot:77, carb:8.7, fat:3.3, photo:'images/producten/z14.jpg'},
  { id:'z15', name:'Eiwitpoeder (Nutribites)', name_en:'Protein powder (Nutribites)', icon:'🥛', cat:'zuivel', kcal:365, prot:68.7, carb:7.7, fat:6.6, photo:'images/producten/z15.jpg'},
  { id:'z16', name:'Boeren skyr (Weeribben)', name_en:'Farm skyr (Weeribben)', icon:'🥛', cat:'zuivel', kcal:79, prot:10, carb:6.4, fat:1.5, photo:'images/producten/z16.jpg'},
  { id:'z17', name:'Amandelmelk (Mylky)', name_en:'Almond milk (Mylky)', icon:'🥛', cat:'zuivel', kcal:59, prot:1.9, carb:3.4, fat:4.2, photo:'images/producten/z17.jpg'},
  { id:'z18', name:'Boter (roomboter)', name_en:'Butter', icon:'🧈', cat:'zuivel', kcal:737, prot:1, carb:1.1, fat:81.2, portie:{ gram:15, label:'1 eetlepel', label_en:'1 tablespoon' }, photo:'images/producten/z18.jpg'},
  { id:'z19', name:'Karnemelk', name_en:'Buttermilk', icon:'🥛', cat:'zuivel', kcal:30, prot:3, carb:3.6, fat:0.2, portie:{ gram:250, label:'1 beker', label_en:'1 cup' }, photo:'images/producten/z19.jpg'},
  { id:'z20', name:'Yoghurt (halfvol)', name_en:'Yogurt (semi-skimmed)', icon:'🥛', cat:'zuivel', kcal:50, prot:4.2, carb:4.3, fat:1.5, portie:{ gram:150, label:'1 schaaltje', label_en:'1 bowl' }, photo:'images/producten/z20.jpg'},
  { id:'z21', name:'Roomkaas', name_en:'Cream cheese', icon:'🧀', cat:'zuivel', kcal:315, prot:7, carb:2.5, fat:31, portie:{ gram:20, label:'1 voorsnee', label_en:'1 slice' }, photo:'images/producten/z21.jpg'},
  { id:'z22', name:'Feta', name_en:'Feta', icon:'🧀', cat:'zuivel', kcal:275, prot:16.5, carb:0.5, fat:23, portie:{ gram:20, label:'1 voorsnee', label_en:'1 slice' }, photo:'images/producten/z22.jpg'},
  { id:'z23', name:'Parmezaanse kaas', name_en:'Parmesan', icon:'🧀', cat:'zuivel', kcal:400, prot:40, carb:0, fat:27, portie:{ gram:10, label:'1 eetlepel', label_en:'1 tablespoon' }, photo:'images/producten/z23.jpg'},
  { id:'z24', name:'Havermelk', name_en:'Oat milk', icon:'🥛', cat:'zuivel', kcal:44, prot:0.5, carb:6.7, fat:1.5, portie:{ gram:250, label:'1 beker', label_en:'1 cup' }, photo:'images/producten/z24.jpg'},
  { id:'z25', name:'Sojamelk (verrijkt)', name_en:'Soy milk (fortified)', icon:'🥛', cat:'zuivel', kcal:37, prot:3, carb:3, fat:1.4, portie:{ gram:250, label:'1 beker', label_en:'1 cup' }, photo:'images/producten/z25.jpg'},
  { id:'z26', name:'Kefir', name_en:'Kefir', icon:'🥛', cat:'zuivel', kcal:40, prot:3.5, carb:3.1, fat:1.5, portie:{ gram:250, label:'1 beker', label_en:'1 cup' }, photo:'images/producten/z26.jpg'},
  { id:'z27', name:'Crème fraîche', name_en:'Crème fraîche', icon:'🥛', cat:'zuivel', kcal:295, prot:2.5, carb:3, fat:30, portie:{ gram:20, label:'1 eetlepel', label_en:'1 tablespoon' }, photo:'images/producten/z27.jpg'},
  { id:'z28', name:'Slagroom (geklopt)', name_en:'Whipped cream', icon:'🥛', cat:'zuivel', kcal:350, prot:2, carb:16, fat:30, portie:{ gram:10, label:'1 toef', label_en:'1 dollop' }, photo:'images/producten/z28.jpg'},
  { id:'z29', name:'Ricotta', name_en:'Ricotta', icon:'🧀', cat:'zuivel', kcal:140, prot:8, carb:4, fat:10, portie:{ gram:15, label:'1 eetlepel', label_en:'1 tablespoon' }, photo:'images/producten/z29.jpg'},
  { id:'z30', name:'Geitenkaas', name_en:'Goat cheese', icon:'🧀', cat:'zuivel', kcal:395, prot:22.5, carb:0, fat:32.5, portie:{ gram:20, label:'1 voorsnee', label_en:'1 slice' }, photo:'images/producten/z30.jpg'},
  { id:'z31', name:'Brie', name_en:'Brie', icon:'🧀', cat:'zuivel', kcal:370, prot:17, carb:1, fat:33, portie:{ gram:30, label:'1 portie', label_en:'1 portion' }, photo:'images/producten/z31.jpg'},
  { id:'z32', name:'Sojayoghurt', name_en:'Soy yogurt', icon:'🥛', cat:'zuivel', kcal:47, prot:4, carb:2.1, fat:2.3, portie:{ gram:150, label:'1 bakje', label_en:'1 pot' }, photo:'images/producten/z32.jpg'},
  { id:'z33', name:'Kokosmelk', name_en:'Coconut milk', icon:'🥥', cat:'zuivel', kcal:170, prot:1, carb:2, fat:17, photo:'images/producten/z33.jpg'},
  // GRANEN
  { id:'gr1', name:'Havermout', name_en:'Oatmeal', icon:'🥣', cat:'granen', kcal:368, prot:13, carb:66, fat:7, photo:'images/producten/gr1.jpg'},
  { id:'gr2', name:'Volkoren brood', name_en:'Wholegrain bread', icon:'🍞', cat:'granen', kcal:247, prot:9, carb:41, fat:3, photo:'images/producten/gr2.jpg'},
  { id:'gr3', name:'Witte rijst (gekookt)', name_en:'White rice (cooked)', icon:'🍚', cat:'granen', kcal:130, prot:2.7, carb:28, fat:0.3, photo:'images/producten/gr3.jpg'},
  { id:'gr4', name:'Zilvervliesrijst (gekookt)', name_en:'Brown rice (cooked)', icon:'🍚', cat:'granen', kcal:112, prot:2.6, carb:24, fat:0.9, photo:'images/producten/gr4.jpg'},
  { id:'gr5', name:'Quinoa (gekookt)', name_en:'Quinoa (cooked)', icon:'🌾', cat:'granen', kcal:120, prot:4.4, carb:22, fat:1.9, photo:'images/producten/gr5.jpg'},
  { id:'gr6', name:'Pasta (gekookt)', name_en:'Pasta (cooked)', icon:'🍝', cat:'granen', kcal:158, prot:5.8, carb:31, fat:0.9, photo:'images/producten/gr6.jpg'},
  { id:'gr7', name:'Aardappel (gekookt)', name_en:'Potato (cooked)', icon:'🥔', cat:'granen', kcal:77, prot:2.0, carb:17, fat:0.1, photo:'images/producten/gr7.jpg'},
  { id:'gr8', name:'Granola', name_en:'Granola', icon:'🥣', cat:'granen', kcal:471, prot:10, carb:64, fat:20, photo:'images/producten/gr8.jpg'},
  { id:'gr9', name:'Rijstwafels', name_en:'Rice cakes', icon:'🫓', cat:'granen', kcal:387, prot:8, carb:82, fat:3, photo:'images/producten/gr9.jpg'},
  { id:'gr10', name:'Couscous (gekookt)', name_en:'Couscous (cooked)', icon:'🌾', cat:'granen', kcal:112, prot:3.8, carb:23, fat:0.2, photo:'images/producten/gr10.jpg'},
  { id:'gr11', name:'Volkoren basmatirijst (gekookt)', name_en:'Wholegrain basmati rice (cooked)', icon:'🍚', cat:'granen', kcal:123, prot:3.5, carb:25, fat:1, photo:'images/producten/gr11.jpg'},
  { id:'gr12', name:'Volkoren pasta (gekookt)', name_en:'Wholegrain pasta (cooked)', icon:'🍝', cat:'granen', kcal:124, prot:5, carb:25, fat:1.1, photo:'images/producten/gr12.jpg'},
  { id:'gr13', name:'Volkoren couscous (gekookt)', name_en:'Wholegrain couscous (cooked)', icon:'🌾', cat:'granen', kcal:112, prot:4.5, carb:23, fat:0.6, photo:'images/producten/gr13.jpg'},
  { id:'gr14', name:'Volkoren wraps', name_en:'Wholegrain wraps', icon:'🌯', cat:'granen', kcal:245, prot:8, carb:40, fat:6, photo:'images/producten/gr14.jpg'},
  { id:'gr15', name:'Brinta', name_en:'Brinta (wheat bran cereal)', icon:'🥣', cat:'granen', kcal:350, prot:11, carb:65, fat:3.5, photo:'images/producten/gr15.jpg'},
  { id:'gr16', name:'Boekweit (gekookt)', name_en:'Buckwheat (cooked)', icon:'🌾', cat:'granen', kcal:92, prot:3.4, carb:20, fat:0.6, photo:'images/producten/gr16.jpg'},
  { id:'gr17', name:'Desem volkoren (brood)', name_en:'Sourdough wholegrain bread', icon:'🍞', cat:'granen', kcal:221, prot:11.1, carb:39, fat:2.3, photo:'images/producten/gr17.jpg'},
  { id:'gr18', name:'Frites', name_en:'French fries', icon:'🍟', cat:'granen', kcal:84, prot:2, carb:19, fat:0, photo:'images/producten/gr18.jpg'},
  // NOTEN & ZADEN
  { id:'n1', name:'Amandelen', name_en:'Almonds', icon:'🌰', cat:'noten', kcal:582, prot:22.3, carb:3.9, fat:53, photo:'images/producten/n1.jpg'},
  { id:'n2', name:'Walnoten', name_en:'Walnuts', icon:'🌰', cat:'noten', kcal:676, prot:15.2, carb:7, fat:65.2, photo:'images/producten/n2.jpg'},
  { id:'n3', name:'Cashewnoten', name_en:'Cashews', icon:'🌰', cat:'noten', kcal:553, prot:18, carb:30, fat:44, photo:'images/producten/n3.jpg'},
  { id:'n4', name:'Pindakaas', name_en:'Peanut butter', icon:'🫙', cat:'noten', kcal:588, prot:25, carb:20, fat:50, photo:'images/producten/n4.jpg'},
  { id:'n5', name:'Chiazaad', name_en:'Chia seeds', icon:'🌱', cat:'noten', kcal:486, prot:17, carb:42, fat:31, photo:'images/producten/n5.jpg'},
  { id:'n6', name:'Lijnzaad', name_en:'Flaxseed', icon:'🌱', cat:'noten', kcal:534, prot:18, carb:29, fat:42, photo:'images/producten/n6.jpg'},
  { id:'n7', name:'Pompoenpitten', name_en:'Pumpkin seeds', icon:'🌱', cat:'noten', kcal:446, prot:19, carb:54, fat:19, photo:'images/producten/n7.jpg'},
  { id:'n8', name:'Hazelnoten', name_en:'Hazelnuts', icon:'🌰', cat:'noten', kcal:628, prot:15, carb:17, fat:61, photo:'images/producten/n8.jpg'},
  { id:'n9', name:'Pecannoten', name_en:'Pecans', icon:'🌰', cat:'noten', kcal:691, prot:9, carb:14, fat:72, photo:'images/producten/n9.jpg'},
  { id:'n10', name:'Pijnboompitten', name_en:'Pine nuts', icon:'🌰', cat:'noten', kcal:673, prot:14, carb:13, fat:68, photo:'images/producten/n10.jpg'},
  { id:'n11', name:'Sesamzaad', name_en:'Sesame seeds', icon:'🌱', cat:'noten', kcal:573, prot:18, carb:23, fat:50, photo:'images/producten/n11.jpg'},
  { id:'n12', name:'Zonnebloempitten', name_en:'Sunflower seeds', icon:'🌻', cat:'noten', kcal:584, prot:21, carb:20, fat:51, photo:'images/producten/n12.jpg'},
  { id:'n13', name:'Pistachenoten', name_en:'Pistachios', icon:'🥜', cat:'noten', kcal:590, prot:24, carb:11, fat:48.5, portie:{ gram:20, label:'1 handje', label_en:'1 handful' }, photo:'images/producten/n13.jpg'},
  { id:'n14', name:"Pinda's", name_en:'Peanuts', icon:'🥜', cat:'noten', kcal:628, prot:25.2, carb:12, fat:51.6, portie:{ gram:25, label:'1 handje', label_en:'1 handful' }, photo:'images/producten/n14.jpg'},
  { id:'n15', name:'Macadamianoten', name_en:'Macadamia nuts', icon:'🥜', cat:'noten', kcal:752, prot:8, carb:5.6, fat:76, portie:{ gram:25, label:'1 handje', label_en:'1 handful' }, photo:'images/producten/n15.jpg'},
  { id:'n16', name:'Paranoten', name_en:'Brazil nuts', icon:'🥜', cat:'noten', kcal:688, prot:14.4, carb:2.4, fat:67.2, portie:{ gram:25, label:'1 handje', label_en:'1 handful' }, photo:'images/producten/n16.jpg'},
  { id:'n17', name:'Hennepzaad', name_en:'Hemp seeds', icon:'🌱', cat:'noten', kcal:593, prot:31.3, carb:4.7, fat:48.7, portie:{ gram:15, label:'1 eetlepel', label_en:'1 tablespoon' }, photo:'images/producten/n17.jpg'},
  // OVERIG
  { id:'o1', name:'Hummus', name_en:'Hummus', icon:'🫙', cat:'overig', kcal:166, prot:8, carb:14, fat:10, photo:'images/producten/o1.jpg'},
  { id:'o2', name:'Olijfolie', name_en:'Olive oil', icon:'🫒', cat:'overig', kcal:884, prot:0, carb:0, fat:100, photo:'images/producten/o2.jpg'},
  { id:'o3', name:'Honing', name_en:'Honey', icon:'🍯', cat:'overig', kcal:304, prot:0.3, carb:82, fat:0, photo:'images/producten/o3.jpg'},
  { id:'o4', name:'Edamame', name_en:'Edamame', icon:'🫘', cat:'overig', kcal:121, prot:11, carb:9, fat:5, photo:'images/producten/o4.jpg'},
  { id:'o5', name:'Linzen', name_en:'Lentils', icon:'🫘', cat:'overig', kcal:102, prot:7.6, carb:16, fat:0.8, photo:'images/producten/o5.jpg'},
  { id:'o6', name:'Kikkererwten', name_en:'Chickpeas', icon:'🫘', cat:'overig', kcal:106, prot:6.5, carb:14, fat:2.7, photo:'images/producten/o6.jpg'},
  { id:'o7', name:'Proteinenbar', name_en:'Protein bar', icon:'🍫', cat:'overig', kcal:350, prot:25, carb:35, fat:9, photo:'images/producten/o7.jpg'},
  { id:'o8', name:'Kokosolie', name_en:'Coconut oil', icon:'🥥', cat:'overig', kcal:862, prot:0, carb:0, fat:100, photo:'images/producten/o8.jpg'},
  { id:'o9', name:'Sojabonen (gekookt)', name_en:'Soybeans (cooked)', icon:'🫘', cat:'overig', kcal:173, prot:18, carb:9, fat:9, photo:'images/producten/o9.jpg'},
  { id:'o10', name:'Seitan', name_en:'Seitan', icon:'🌱', cat:'overig', kcal:130, prot:25, carb:4, fat:2, photo:'images/producten/o10.jpg'},
  { id:'o11', name:'Tofu', name_en:'Tofu', icon:'🌱', cat:'overig', kcal:76, prot:8, carb:1.9, fat:4.8, photo:'images/producten/o11.jpg'},
  { id:'o12', name:'Tempeh', name_en:'Tempeh', icon:'🌱', cat:'overig', kcal:192, prot:20, carb:7.6, fat:11, photo:'images/producten/o12.jpg'},
  { id:'o13', name:'Zwarte bonen (gekookt)', name_en:'Black beans (cooked)', icon:'🫘', cat:'overig', kcal:132, prot:8.9, carb:24, fat:0.5, photo:'images/producten/o13.jpg'},
  { id:'o14', name:'Witte bonen (gekookt)', name_en:'White beans (cooked)', icon:'🫘', cat:'overig', kcal:139, prot:9.7, carb:25, fat:0.5, photo:'images/producten/o14.jpg'},
  { id:'o15', name:'Bruine bonen (gekookt)', name_en:'Brown beans (cooked)', icon:'🫘', cat:'overig', kcal:127, prot:8.7, carb:23, fat:0.5, photo:'images/producten/o15.jpg'},
  { id:'o16', name:'Pure chocolade', name_en:'Dark chocolate', icon:'🍫', cat:'overig', kcal:546, prot:4.9, carb:61, fat:31, photo:'images/producten/o16.jpg'},
  { id:'o17', name:'Koolzaadolie', name_en:'Rapeseed oil', icon:'🛢️', cat:'overig', kcal:884, prot:0, carb:0, fat:100, photo:'images/producten/o17.jpg'},
  { id:'o18', name:'Lijnzaadolie', name_en:'Flaxseed oil', icon:'🛢️', cat:'overig', kcal:884, prot:0, carb:0, fat:100, photo:'images/producten/o18.jpg'},
  { id:'o19', name:'Zonnebloemolie', name_en:'Sunflower oil', icon:'🛢️', cat:'overig', kcal:884, prot:0, carb:0, fat:100, photo:'images/producten/o19.jpg'},
  { id:'o20', name:'Cacaopoeder', name_en:'Cocoa powder', icon:'🍫', cat:'overig', kcal:255, prot:25.2, carb:13.7, fat:11, photo:'images/producten/o20.jpg'},
  { id:'o21', name:'Cacao nibs', name_en:'Cacao nibs', icon:'🍫', cat:'overig', kcal:488, prot:13.4, carb:2.5, fat:47.2, photo:'images/producten/o21.jpg'},
];

// Cache-busting: elke keer dat een productfoto vervangen wordt, dit nummer ophogen.
// data.js zelf wordt al bij elke paginalaad vers opgehaald (zie _appScriptsCacheBust in
// auth.js), dus deze versie-toevoeging aan elk foto-pad zorgt dat de browser de nieuwe
// foto ook meteen ophaalt i.p.v. een oude, gecachete versie te blijven tonen.
const PRODUCT_PHOTO_VERSION = 3;
PRODUCTS.forEach(p => { if (p.photo) p.photo += '?v=' + PRODUCT_PHOTO_VERSION; });

// ========== INGEBOUWDE PROGRAMMA'S ==========
// Leeg -- het vaste "Basisprogramma Ira" is op verzoek verwijderd. Alle
// programma's zijn nu vrij door de coach/klant zelf samen te stellen
// (Training > Programma's) of komen uit de gedeelde PRIME-programma's.
const BUILTIN_PROGRAMMAS = [];
