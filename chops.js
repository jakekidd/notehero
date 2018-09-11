/* global d3 */
/* global Howl */
/* global user */
var MEDIA_STREAM;
var NOTE_STRINGS = ["C", "Db", "D", "Eb", "E", "F", "Gb", "G", "Ab", "A", "Bb", "B"];

const CANVAS_HEIGHT = 240;
const CANVAS_WIDTH = 840;
const CANVAS_PADDING = 50;

// these things will affect difficulty:
var INITIAL_CLOCK = 60.00;
var SCROLL_MAX = 1.5;
const BASE_POINTS = 10;

// paths to assets:
const IMG_PATH = "assets/img/";
const SOUND_PATH = "assets/sound/";
	
// CLEF = [0,0];
const DEBUGGING = false;

const FFTSIZE = 8192;
const RATE = 32000;

var Chops = function(home, clef, key, timeSig, difficulty) {
	this.home = home;
	//initialize all the game settings
	this.difficulty = difficulty;
	this.clef = [];
	for(let c = 0; c < clef.length; c++) {
		if(clef[c]) { this.clef.push(clef[c]) }
	}
	this.timeSig = timeSig;
	this.key = key;
	this.music = Chops.music(this);
	//returns a list of the notes in the scale (e.g. E4 to F5)
	this.scales = this.music.keyToScale();

	//generate the staff, along with the clef, key signature, time signature
	this.staff = Chops.staff(this, home);

	this.audio = Chops.audio(this);

	if(DEBUGGING) {
		console.log("BOOTED CHOPS.");
		console.log("STAFF:");
		console.log(this.staff);
		console.log("MUSIC:");
		console.log(this.music);
		console.log("SCALE(s):");
		console.log(this.scales);
	}

	Chops.play(this);

	return this;
}

Chops.staff = function(game, home) {
	var pad = CANVAS_PADDING;
	var staffWidth = CANVAS_WIDTH - pad*2;
	var staffHeight = CANVAS_HEIGHT - pad*2;

	return {
		bars: [],
		notes: [],
		staffCtxs: [],
		staffRestores: [],

		initializeCanvas: function() {
			var sheetNode = document.getElementById("sheet");
			//draw a staff for each clef involved
			for(let c = 0; c < game.clef.length; c++) {

				let canvas = document.createElement("canvas");
				canvas.width = CANVAS_WIDTH;
				canvas.height = CANVAS_HEIGHT;
				canvas.style.width = sheetNode.clientWidth.toString() + "px";
				canvas.setAttribute("class", "clef");
				document.getElementById("sheet").appendChild(canvas);

				let ctx = this.drawStaff(canvas);
				this.staffCtxs[c] = ctx;
				this.drawClef(ctx, game.clef[c], canvas);
				
				// this.drawGradient(ctx);
			}
		},
		drawGradient: function(ctx) {
			var linGrad = ctx.createLinearGradient(0, 0, CANVAS_WIDTH, 0);
			linGrad.addColorStop(0.05, "transparent");
			linGrad.addColorStop(0.85, "#D2F1E4");

			ctx.fillStyle = linGrad;
			ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
		},
		drawClef: function(ctx, clef, canvas) {
			//draw the clef
			var img = new Image();
			img.setAttribute("id", clef + "Clef");
			document.getElementById("hidden").appendChild(img);
			var subT = this;
			img.onload = function() {
				if(clef === "treble") {
					ctx.drawImage(img, pad-15,pad-32);
					subT.staffRestores.push(ctx.getImageData(0,0, CANVAS_WIDTH, CANVAS_HEIGHT));
				}
				if(clef === "bass") {
					ctx.drawImage(img, pad,pad);
					subT.staffRestores.push(ctx.getImageData(0,0, CANVAS_WIDTH, CANVAS_HEIGHT));
				}
			}
			img.src = IMG_PATH + clef + "Clef.png";
		},
		// this should be private
		drawStaff: function(canvas) {
			var ctx = canvas.getContext("2d");
			ctx.strokeStyle = "2A2B2A";
			ctx.lineWidth = 2;
			// ctx.fillStyle = 'white';

			ctx.moveTo(pad, pad);
			ctx.lineTo(staffWidth, pad);
			ctx.lineTo(staffWidth, staffHeight);
			ctx.lineTo(pad, staffHeight);
			ctx.lineTo(pad, pad);
			ctx.stroke();

			for(let l = 1; l <= 3; l++) {
				let lineY = pad + ((staffHeight)/6)*l
				ctx.moveTo(pad, lineY);
				ctx.lineTo(staffWidth, lineY);
			}
			ctx.stroke();
			
			//TODO: DRAW ACCIDENTALS!!

			return ctx;
		},
		updateCanvas: function(scrollSpeed) {
			//update each staff, if both
			for(let i = 0; i < game.clef.length; i++) {
				var ctx = this.staffCtxs[i];
				
				var data = this.staffRestores[i];
				ctx.putImageData(data, 0, 0);

				// bars feature, to be integrated when rhythm is added.
				for(let b = 0; b < this.bars.length; b++) {

					let posX = this.bars[b];
					// console.log(this.bars);
					posX -= scrollSpeed;
					this.bars[b] = posX;
					if(posX > pad) {
						ctx.moveTo(posX, pad);
						ctx.lineTo(posX, staffHeight);
						ctx.stroke();
					} else { this.bars.splice(b, 1) }
				}
				for(let n = 0; n < this.notes.length; n++) {
					this.notes[n].posX -= scrollSpeed;
					if(this.notes[n].posX > pad+100) {
						ctx.drawImage(this.notes[n].img, this.notes[n].posX, this.notes[n].posY);
					} else {
						this.notes.splice(n, 1)
					}
				}
				// this.drawGradient(ctx);	
			}
		},
		addBar: function() { this.bars.push(staffWidth); },
		addNote: function(note) {

			note.posX = staffWidth;
			note.posY = (game.scales[note.staff].length - game.scales[note.staff].indexOf(note.letter));
			
			//we should only do this once for every kind of note!! \/
			let img = document.createElement("img");
			let orientation;
			if(note.posY < game.scales[note.staff].length / 2) {
				orientation = "Flipped";
				note.posY *= 12;
				note.posY += 26;
			} else {
				orientation = "";
				note.posY -= 4;
				note.posY *= 11;
				note.posY += 12;
			}
			img.src = IMG_PATH + note.duration + "Note" + orientation + ".png";

			note.img = img;
			
			this.notes.push(note);
		},
		popNote: function(which) {
			if(!which) { which = 0; }
			// setInterval()
			// let elm = this.notes[which].img;
			// elm.parentNode.removeElement(elm);
			this.notes.splice(which, 1);
		}
	}
}

Chops.music = function(game) {
	return {
		generateNote: function() {
			var note = {};
			//place in a rando clef
			let thisClef = game.clef[Math.floor(Math.random() * game.clef.length)]
			var thisScale = game.scales[thisClef].slice();

			//make sure we don't use the same as the last note...for now?
			var lastNote = game.staff.notes.slice(-1)[0]
			if(lastNote) {
				var lastNoteLetter = lastNote.letter;
				thisScale.splice(thisScale.indexOf(lastNoteLetter), 1);
			}

			note.letter = thisScale[Math.floor(Math.random() * thisScale.length)];

			note.duration = "quarter";
			note.staff = thisClef;
			if(DEBUGGING) {
				console.log("New note I made: ");
				console.log(note);
			}

			return note;
		},
		keyToScale: function() {

			var scales = {}

			scales.treble = ["E4", "F4", "G4", "A5", "B5", "C5", "D5", "E5", "F5"];
			scales.bass = ["G2", "A3", "B3", "C3", "D3", "E3", "F3", "G3", "A4"];
			// var scaleSize = [3, 4]
			// if(game.clef[0] === "treble") { scaleSize[0] = 5; }
			// if(game.clef[1] === "bass") { scaleSize[1] = 2; }
			// for(i = 0; i < (scaleSize[0] - scaleSize[1]); i++) {
			// 	octave = scaleSize[1] + i.toString();
			// 	if(i === 0) { octaveScale = ["E", "F", "G"]; } else { octaveScale = NOTE_STRINGS; }
			// 	for(n = 0; n < octaveScale.length; n++) {
			// 		octaveScale[n] += octave;
			// 	}
			// }
			
			// the weirdest system ever for determining flats/sharps...
			// there's gotta be a better algorithm somewhere.
			if(game.key[1] === "flat") {
				var accPosY = 4;
				var accPositions = [-3, 4, -3, 4, -3, 4];
				var order = ["Bb", "Eb", "Ab", "Db", "Gb", "Cb", "Fb"];
				NOTE_STRINGS = ["C", "Db", "D", "Eb", "E", "F", "Gb", "G", "Ab", "A", "Bb", "B"];
			} else {
				var accPosY = 0;
				var accPositions = [3, -4, 3, 3, -4, 3];
				var order = ["F#", "C#", "G#", "D#", "A#", "E#", "B#"];
				NOTE_STRINGS = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
			}

			//[default top, default bottom]
			return scales;
		},
		// detectPitch: function() {
		// 	game.dataPane.updatePitch(notePlayed);
		// 	return notePlayed;
		// }
	}
}

Chops.audio = function(game) {
	window.AudioContext = window.AudioContext || window.webkitAudioContext;

	var audioContext = new AudioContext();
	var audioInput = null,
		inputPoint = null;
	var analyserContext = null;
	var rafIDWave = null;
	var rafIDBars = null;
	var sampleRate = RATE;
	var canvasWidth, canvasHeight;
	var analyserNode = null;
	var sampleRate = audioContext.sampleRate;

	return {
		//maybe initialization should be refactored into a constructor function
		initAudio: function(resolve, reject) {
			window.navigator.mediaDevices.getUserMedia(
				{ audio: true }).then(function(mediaStream) {
					MEDIA_STREAM = mediaStream;
					// Chops.audio.gotStream(mediaStream);  <-- maybe do this instead?
					inputPoint = audioContext.createGain();

					audioInput = audioContext.createMediaStreamSource(mediaStream);
					audioInput.connect(inputPoint);

					analyserNode = audioContext.createAnalyser();
					analyserNode.fftSize = FFTSIZE;
					inputPoint.connect(analyserNode);

					// countdown();

					// updateAnalysers();
					game.audio.updateWaveform();

					resolve();
				}
			);
		},
		//TODO: handle reject/catch for no audio in~!

		samplePitch: function() {
			var freqByteData = new Uint8Array(analyserNode.frequencyBinCount);
			analyserNode.getByteFrequencyData(freqByteData);
			var pitch = this.getFundamental(freqByteData);
			if(pitch[0] > 1200000) {
				var freq = (pitch[1] * sampleRate / analyserNode.fftSize);
				var note = this.noteFromPitch(freq);
				// console.log("Note: " + note);
				var centsOff = this.centsOffFromPitch(freq, note[1]);
				// TODO: this should really be an object!
				return [freq, note[0], centsOff];
			} else { return null; }
		},

		getFundamental: function(freqByteArray) {

			var spectrum = Array.from(freqByteArray)
			let factorTw = this.downsample(spectrum, 2);
			let factorTh = this.downsample(spectrum, 3);

			for(let i = 0; i < factorTh.length; i++) {
				spectrum[i] = (spectrum[i]+1) * (factorTw[i]+1) * (factorTh[i]+1);
			}

			// console.log(spectrum);

			var pk = [0, 0];
			for(let i = 0; i < spectrum.length; i++) {
				if(spectrum[i] > pk[0]) { pk = [spectrum[i], i]; }
			}
			return pk;
		},

		downsample: function(fft, factor) {
			var newFFT = [fft[0]];
			for(let i = factor; i < fft.length; i++) {
				if(i % factor === 0) {
					newFFT.push(fft[i]);
				}
			}
			return newFFT;
		},

		noteFromPitch: function(frequency) {
			//72 = C5
			var noteNum = 12 * (Math.log(frequency / 440)/Math.log(2));
			var noteNum = Math.round(noteNum) + 69;
			// console.log("Note number found to be: " + noteNum);
			// console.log("note value: " + noteNum);
			var noteRange = (Math.floor((noteNum + 3) / 12) - 1).toString();
			// console.log("note range: " + noteRange);
			return [(NOTE_STRINGS[noteNum%12]) + noteRange, noteNum];
		},

		centsOffFromPitch: function(frequency, note) {
			return Math.round(1200 * Math.log2(frequency/this.frequencyFromNoteNumber(note)));
		},

		frequencyFromNoteNumber: function(note) {
			return 440 * Math.pow(2,(note-69)/12);
		},

		updateWaveform: function(time) {
			var cycles = new Array;
			var floatTimeData = new Float32Array(analyserNode.frequencyBinCount);
			analyserNode.getFloatTimeDomainData(floatTimeData);

			var waveCanvas = document.getElementById("waveform")
			waveCanvas.style.width = (waveCanvas.parentNode.clientWidth - 40).toString() + "px";

			var ctx = waveCanvas.getContext("2d");
			ctx.clearRect(0,0,512,256);
			ctx.lineWidth = 2;
			ctx.strokeStyle = "#2A2B2A";
			ctx.beginPath();
			ctx.moveTo(0,82);
			for (var i=2;i<512;i++) {
				ctx.lineTo(i,82+(floatTimeData[i]*128));
			}
			ctx.stroke();

			if (!window.requestAnimationFrame) {
				window.requestAnimationFrame = window.webkitRequestAnimationFrame;
			}
			rafIDWave = window.requestAnimationFrame(game.audio.updateWaveform);
		}
	};
};

Chops.play = function(game) {

	var scrollSpeed = 1.0;
	var suspend = 0;
	var wrongSuspend = 0;

	var clock = INITIAL_CLOCK;
	var score = 0;
	var record = [];
	var wrongNotes = 0;
	var lastNote = "";

	//initialize sounds:
	const countdown_click = new Howl({
		src: [SOUND_PATH + 'countdown_click.wav']
	});
	const countdown_go = new Howl({
		src: [SOUND_PATH + 'countdown_go.wav']
	});
	const game_finish = new Howl({
		src: [SOUND_PATH + 'game_finish.wav'],
		sprite: {
			chime: [0,1000]
		}
	});
	const tick = new Howl({
		src: [SOUND_PATH + 'blip.wav']
	});
	const clink = new Howl({
		src: [SOUND_PATH + 'clink.wav']
	});
	const level_up = new Howl({
		src: [SOUND_PATH + 'levelup.wav']
	});
	const trombone = new Howl({
		src: [SOUND_PATH + 'sad_trombone.wav']
	});

	const initialize = function() {
		const audioPromise = new Promise(game.audio.initAudio);
		audioPromise.then(function() {
			game.staff.initializeCanvas();
			// slidefade in game-host element
			game.home.classList.remove("inactive");
			game.home.classList.toggle("fadein");

			//run a COUNTDOWN, wait for it to finish:
			var countdown = 3;
			var countdownDisplay = document.getElementById("countdown-display-text");
			countdownDisplay.style.visibility = "visible";
			return new Promise(function(resolve, reject) {
				var interval = setInterval(function() {
					if(countdown < 0) {
						countdownDisplay.style.visibility = "hidden";
						resolve();
						clearInterval(interval);
					} else if(countdown === 0) {
						countdownDisplay.innerText = "GO";
						countdown_go.play();
					} else {
						countdownDisplay.innerText = countdown.toString();
						countdown_click.play();
					}
					countdown--;
				}, 1000);
			});
		}).then(function(){
			runGame();
		});
	};
	
	// =======================================
	
	const runGame = function() {
		var gameRunning = setInterval(function() {
			game.staff.updateCanvas(scrollSpeed);

			let numNotes = game.staff.notes.length;
			let frontNote = game.staff.notes[0];

			if(frontNote) {
				if(frontNote.posX < (180+60*SCROLL_MAX) && scrollSpeed > 0) { scrollSpeed -= SCROLL_MAX/100; }
				if(frontNote.posX > (180+60*SCROLL_MAX) && scrollSpeed < SCROLL_MAX) { scrollSpeed += SCROLL_MAX/20; }
			}

			if(numNotes < 8) {
				if(numNotes === 0) {
					let nextNote = game.music.generateNote();
					game.staff.addNote(nextNote);
					// console.log("Current notes: ");
					// console.log(game.staff.notes);
				} else if(game.staff.notes[numNotes - 1].posX <= CANVAS_WIDTH-200) {
					let nextNote = game.music.generateNote();
					game.staff.addNote(nextNote);
					// console.log("Current notes: ");
					// console.log(game.staff.notes);
				}
			}

			var notePlayed = game.audio.samplePitch();
			var pitchDisplay = "";
			var centsDisplay = "";
			if(notePlayed && frontNote) {
				// updated display for pitch, with centsOff:
				pitchDisplay = notePlayed[1];
				if(notePlayed[2] > 15) {
					centsDisplay = "(#)";
				} else if(notePlayed[2] < -15) {
					centsDisplay = "(b)";
				} else {
					centsDisplay = "";
				}
				// console.log(notePlayed);
				if(notePlayed[1] === frontNote["letter"]) {
					if(suspend >= 10) { 
						bounceScore(clock, notePlayed);
						game.staff.popNote();
						scrollSpeed = SCROLL_MAX;
						suspend = 0;
					} else { suspend++; }
				} else if(notePlayed[1] === lastNote) {
					if(wrongSuspend >= 16) {
						wrongNotes++;
						wrongSuspend = 0;
					} else { wrongSuspend++; }
				} else {
					suspend = 0;
					wrongSuspend = 0;
				}
				lastNote = notePlayed[1];
			}
			clock -= .02;
			updateDisplay(pitchDisplay, centsDisplay);

			if(clock <= 0.05) { endGame(gameRunning); }
		}, 20);
	};

	const updateDisplay = function(pitchDisplay, centsDisplay) {
		document.getElementById("pitch-display-text").textContent = pitchDisplay;
		document.getElementById("cents-display-text").textContent = centsDisplay;
		let clockDisplay = document.getElementById("clock-display-text");
		let n = Math.floor(clock % 60);
		let sec = (n > 9 ? "" + n : "0" + n);
		n = Math.floor(clock / 60);
		let min = (n > 9 ? "" + n : "0" + n);
		clockDisplay.innerText = min.toString() + ":" + sec.toString();
		if(clock < 10) {
			clockDisplay.style.color = "red";
		}
	};

	const updateScore = function(score) {
		document.getElementById("score-display-text").textContent = score;
	};

	const bounceScore = function(clock, note) {
		let data = {};
		// TODO: Penalize for num wrong notes played first! And record THAT data as ACCURACY.
		data.stop = clock;
		data.inaccuracy;

		let lastStop;
		if(record.length > 1) {
			lastStop = record[record.length - 1].stop;
			data.inaccuracy = wrongNotes - record[record.length - 1].inaccuracy;
		} else {
			lastStop = INITIAL_CLOCK;
			data.inaccuracy = wrongNotes;
		}
		// response time rounded to two digits:
		data.responseTime = roundDig( (lastStop - clock), 3 );
		data.letter = note[1];
		data.centsOff = note[2];
		record.push(data);

		// subtract from base points - responseTime and inaccuracy penalty (centsOff penalty removed):
		let a = Math.round(BASE_POINTS - data.responseTime - data.inaccuracy);
		//minimum score is 1pt.
		if(a < 1) { a = 1 }
		score += a;

		//update DOM
		let scoreText = (10000 + score).toString().slice(1);

		if(DEBUGGING) {
			console.log("Score!");
			console.log("Stop: " + clock.toString());
			console.log("Last Stop: " + lastStop.toString());
			console.log("Cents Off: " + data.centsOff.toString());
			console.log("Response Time: " + data.responseTime.toString());
			console.log("Score Text: " + scoreText);
		}

		updateScore(scoreText);
	};

	const getAvg = function(record, item) {
		let sum = 0;
		for(let i = 0; i < record.length; i++) {
			sum += record[i][item];
		}
		return sum / record.length;
	};

	const roundDig = function(number, digits) {
		digits = Math.pow(10, digits);
		return Math.round(number * digits) / digits;
	};

	const endGame = function(gameRunning) {
		this.clearInterval(gameRunning);
		game_finish.play('chime');

		var countdownDisplay = document.getElementById("countdown-display-text");
		countdownDisplay.style.visibility = "visible";
		countdownDisplay.innerText = "FIN";
		try {
			MEDIA_STREAM.getAudioTracks()[0].stop();
		} catch(e) {
			console.log(e);
			console.log("Unable to stop media stream.");
		}

		setTimeout(function(){
			countdownDisplay.parentNode.removeChild(countdownDisplay);
			game.home.classList.toggle("fadein");
			game.home.classList.toggle("fadeout");
			setTimeout(function(){
				displaySummary();
			}, 2000);
		}, 3000);
	};

	// =======================================

	const compileXP = function(xp, lvl, userXp) {
		console.log("compiling xp...");
		var promise = new Promise(function(resolve, reject){
			let addEl = document.getElementById("added-xp");
			let xpEl = document.getElementById("xp-text");
			var total = 0;
			//dynamic adding to the DOM (looks cool lol)
			var interval = setInterval(function(){
				if(total >= xp) {
					xp += userXp;
					xpEl.textContent = xp.toString();
					xpEl.classList.toggle("bubble");
					clink.play();
					clearInterval(interval);
					resolve(checkForLevelUp(xp,lvl));
				} else {
					total++;
					addEl.textContent = total.toString();
					if(total % 10 === 0) { tick.play(); }
				}
			}, 20);
		});
		return promise;
	};

	const checkForLevelUp = function(xpTotal, lvl) {
			console.log("check for level...");
			let lvlThreshold = ((lvl-1)*100) + (lvl*100);
			if(xpTotal >= lvlThreshold) {
				var promise = new Promise(function(resolve, reject){
					console.log("yep!");
					setTimeout(function(){
						lvl += 1;
						xpTotal -= lvlThreshold;
		
						let el = document.getElementById("lvl-text");
						el.textContent = lvl.toString();
						el.classList.toggle("bubble");
						level_up.play();
						document.getElementById("lvl-message").textContent = "Level up!";
						document.getElementById("xp-text").textContent = (xpTotal);
						resolve(checkForLevelUp(xpTotal,lvl));
					}, 1000);
				});
				return promise;
			} else {
				console.log("nope.");
				return { xp: xpTotal, level: lvl };
			}
	};

	const compileData = function() {
		var height = 200;
		var width = 500;
		var padding = 35;

		// attain scale
		var yMax = -(d3.max(record, d => d.responseTime) + 1);
		var yScale = d3.scaleLinear()
						.domain([yMax, 0])
						.range([height - padding, padding]);
		var xScale = d3.scaleLinear()
						.domain([INITIAL_CLOCK, 0])
						.range([padding, width - padding]);

		// append axes
		var xAxis = d3.axisTop(xScale).ticks(10);
		var yAxis = d3.axisLeft(yScale).ticks(5);
		d3.select("#graph-svg")
			.append("g")
			  .attr("transform", "translate(0," + padding + ")")
			  .call(xAxis);
		d3.select("#graph-svg")
			.append("g")
			  .attr("transform", "translate(" + padding + ",0)")
			  .call(yAxis);

		// TODO: fix this, it isn't working. Scale color based on inaccuracy of each note.
		var colorScale = d3.scaleLinear()
							.domain(d3.extent(record, d => d.inaccuracy))
							.range(['blue', 'red']);

		// graph scatter plot
		d3.select("#graph-svg")
			.attr("width", width)
			.attr("height", height)
		  .selectAll("circle")
		  .data(record)
		  .enter()
		  .append("circle")
		  	.attr("cx", d => xScale(d.stop))
		    .attr("cy", d => yScale(-(d.responseTime)))
		    .attr("fill", d => colorScale(d.accuracy))
		    .attr("r", 3);

		// draw a value line
		var points = [];
		d3.selectAll("circle").each(function(d, i){
			points.push({x: d3.select(this).attr("cx"), y: d3.select(this).attr("cy")});
		});
		var path = d3.path();
		path.moveTo(points[0].x, points[0].y);
		for(let i = 1; i < points.length; i++) {
			path.lineTo(points[i].x, points[i].y);
		}
		d3.select("#graph-svg").append("path")
		  	.data(record)
		  	  .attr("class", "line")
		  	  .attr("d", path)
		  	  .attr("stroke-width", 1)
		  	  .attr("stroke", "blue")
		  	  .attr("fill", "none");
	};

	const displaySummary = function() {
		// if there's no data, show the "no-data" pane. Else, continue.
		if(!record.length) {
			let el = document.getElementById("summary");
			el.classList.remove("inactive");
			document.getElementById("summary-no-data").classList.remove("inactive");
			el.classList.toggle("fadein");
			trombone.play();
			return;
		} else {
			document.getElementById("summary-main").classList.remove("inactive");
		}
		// to be used in ajax POST request (as json);
		var session = {};
		console.log(score);

		session.score = score;
		session.totalNotes = record.length;
		session.tpn = roundDig( getAvg(record, "responseTime"), 2 );
		session.nps = roundDig( (1/session.tpn), 2 );
		session.accuracy = roundDig( (1/(getAvg(record, "inaccuracy") + 1)), 2 );
		session.xp = Math.round(Math.pow(score, 1.2));
		session.wrongNotes = wrongNotes;
		console.log(session);

		document.getElementById("score-total").textContent = session.score;
		document.getElementById("avg-tpn").textContent = session.tpn;
		document.getElementById("avg-nps").textContent = session.nps;
		document.getElementById("avg-acc").textContent = session.accuracy;
		document.getElementById("total-notes").textContent = session.totalNotes;

		compileData();

		// fade in summary page
		let el = document.getElementById("summary");
		el.classList.remove("inactive");
		el.classList.toggle("fadein");
		
		if(user){
			var xp = user.xp || 0;
			var lvl = user.level || 0;
			var id = user.id;
			
			document.getElementById("xp-text").textContent = xp.toString();
			// wait for fade in to complete
			setTimeout(function(){
				var userGains = {};
				userGains.session = session;
				console.log("attempting...");

				compileXP(session.xp, lvl, xp).then(function(gains){
					console.log("gains found:");
					console.log(gains);
					userGains.level = gains.level;
					userGains.xp = gains.xp;
					var url = "/user/" + user.id.toString();
					console.log("URL:");
					console.log(url);
					putGains(userGains, url);
				}).catch(function(gains){
					console.log("gains failed");
					console.log(gains);
				});
				
			}, 2000);
		}
	};
	
	const putGains = function(userGains, url) {
		console.log("Attempting put...");
		// ajax post user gains, post session
		$.ajax({
		    url: url,
		    type: 'PUT',
		    dataType: "json",
		    data: userGains,
		    success: function(result) {
		    	console.log("YAY!");
		    	console.log(result);
		    }
		});
	}
	
	// =======================================
	
	initialize();
}

window.onresize = function() {
	try {
		let canvasNodes = document.getElementsByClassName("clef");
		let sheetNode = document.getElementById("sheet");
		for(let i = 0; i < canvasNodes.length; i++) {
			canvasNodes[i].style.width = sheetNode.clientWidth.toString() + "px";
		}
	} catch(e) {}
}
// document.getElementById("game-host").onload = Chops(document.getElementById("chops"), ["treble"], ["C", null], "4/4", 1);
window.onload = function(){
	var newGameElm = document.getElementById("new-game");
	document.getElementById("start-game-btn").addEventListener("click", function(){
		let clefElm = document.getElementById("clef");
		var clef = clefElm.options[clefElm.selectedIndex].text;
		if(clef === "Treble") { clef = ["treble"]; }
		if(clef === "Bass") { clef = ["bass"]; }
		if(clef === "Treble and Bass") { clef = ["treble", "bass"]; }
		
		let keyElm = document.getElementById("key-sig");
		let accElm = document.getElementById("accidental");
		let key = clefElm.options[clefElm.selectedIndex].text;
		let acc = accElm.options[accElm.selectedIndex].text;
		var keySig = [keySig, acc];
		
		var timeSig = "4/4";	// These two things have no effect yet.
		var difficulty = 1;
		
		var clock = document.getElementById("time-input").value;
		try {
			clock = parseInt(clock);
			if(clock > 0 && clock < 180) { INITIAL_CLOCK = clock; }
		} catch(e) {
			if(DEBUGGING) {	console.log(e); }
		}
		
		let scrollSpeedElm = document.getElementById("scroll-speed");
		var scrollSpeed = scrollSpeedElm.options[scrollSpeedElm.selectedIndex].text;
		if(scrollSpeed === "Slow") { SCROLL_MAX = 1.5 }
		if(scrollSpeed === "Medium") { SCROLL_MAX = 2.0 }
		if(scrollSpeed === "Fast") { SCROLL_MAX = 3.0 }
		if(scrollSpeed === "Insane") { SCROLL_MAX = 5.0 }
		
		newGameElm.classList.toggle("fadein");
		newGameElm.classList.toggle("fadeout");
		
		document.getElementById("game-host").onload = Chops(document.getElementById("chops"), clef, keySig, timeSig, difficulty);
	});
	newGameElm.classList.remove("inactive");
	newGameElm.classList.toggle("fadein");
}
