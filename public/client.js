window.addEventListener('load', () => {
	const socket = new WebSocket('/');

	const params = new URLSearchParams(window.location.search);
	const plot = params.get('plot');
	const id = params.get('id');
	let authed = false;
	let audioStream = null;
	let audioProcessor = null;
	let isTalking = false;
	const audioContext = new (window.AudioContext || window.webkitAudioContext)();
	const TALKING_THRESHOLD = 0.0;
	const FAVICON_DEFAULT = 'icon.png';
	const FAVICON_TALKING = 'iconTalking.png';

	let noiseSuppression = true;
	let muted = true;
	const noiseSuppressionToggle = document.getElementById('noiseSuppressionToggle');
	noiseSuppressionToggle.addEventListener('click', () => {
		noiseSuppression = !noiseSuppression
		noiseSuppressionToggle.textContent = noiseSuppression ? 'Disable Noise Suppression' : 'Enable Noise Suppression';
		restartAudioStream();
	});

	const muteToggle = document.getElementById('muteToggle');
	muteToggle.addEventListener('click', () => {
		muted = !muted
		muteToggle.textContent = muted ? 'Enable Microphone' : 'Disable Microphone';
	});

	function restartAudioStream() {
		if (audioStream) {
			audioStream.getTracks().forEach(track => track.stop());
			audioStream = null;
		}
		if (audioProcessor) {
			audioProcessor.disconnect();
			audioProcessor = null;
		}
		startSendingAudio();
	}

	const visualizer = document.getElementById('visualizer');
	// visualizer.style.position = 'fixed';
	visualizer.style.margin = '10px 0px'
	visualizer.style.top = '10px';
	// visualizer.style.left = '10px';
	visualizer.style.width = '30px';
	visualizer.style.height = '300px';
	visualizer.style.background = '#eee';
	visualizer.style.border = '1px solid #ccc';

	const bar = document.getElementById('bar');
	bar.style.height = '0%';
	bar.style.width = '100%';
	bar.style.background = '#4caf50';
	bar.style.transition = 'height 0.05s linear';

	function setFavicon(src) {
		let link = document.querySelector("link[rel~='icon']");
		if (!link) {
			link = document.createElement('link');
			link.rel = 'icon';
			document.head.appendChild(link);
		}
		link.href = src;
	}

	setFavicon(FAVICON_DEFAULT);

	if (!plot || !id) {
		console.error('Missing plot or id in the URL.');
		alert("Tried connecting without a plotId and userId")
		return;
	}

	socket.onopen = () => {
		console.log('WebSocket connection established.');
	};

	socket.onmessage = (event) => {
		// console.log('Message received from server:', event.data);
		if (event.data instanceof Blob) {
			const reader = new FileReader();
			reader.onload = () => {
				const arrayBuffer = reader.result;
				const audioData = new Int16Array(arrayBuffer);
				const playbackBuffer = audioContext.createBuffer(1, audioData.length, audioContext.sampleRate);
				const float32PlaybackBuffer = new Float32Array(audioData.length);
				for (let i = 0; i < audioData.length; i++) {
					float32PlaybackBuffer[i] = audioData[i] / 32768; // Convert Int16 to Float32
				}
				playbackBuffer.copyToChannel(float32PlaybackBuffer, 0);

				const playbackSource = audioContext.createBufferSource();
				playbackSource.buffer = playbackBuffer;
				playbackSource.connect(audioContext.destination);
				playbackSource.start();
			};
			reader.readAsArrayBuffer(event.data);
			return
		}
		let data = JSON.parse(event.data);
		if (data.type === 'auth') {
			switch (data.status) {
				case 'wait':
					console.log('Sending authentication request...');
					if (plot && id) {
						socket.send(JSON.stringify({ type: "auth", roomId: plot, userId: id }));
					} else {
						console.error('Missing plot or id in the URL.');
						alert("Tried connecting without a plotId and userId")
						socket.close();
					}
					break;
				case 'success':
					authed = true;
					console.log('Authenticated successfully.');
					startSendingAudio();
					break;
				case 'fail':
					console.error('Authentication error');
					alert('Authentication error');
					socket.close();
					return;
				default:
					console.error('Unknown authentication status:', data.status);
			}
		} else if (data.type === 'error') {
			console.error('Error from server:', data.message);
			alert(data.message);
			socket.close();
		}
	};

	socket.onerror = (error) => {
		console.error('WebSocket error:', error);
	};

	socket.onclose = () => {
		console.log('WebSocket connection closed.');
		if (audioProcessor) {
			audioProcessor.disconnect();
			audioProcessor = null;
		}
		if (audioStream) {
			audioStream.getTracks().forEach(track => track.stop());
			audioStream = null;
		}
		setFavicon(FAVICON_DEFAULT);
		bar.style.height = '0%';
	};

	function startSendingAudio() {
		if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) return;
		navigator.mediaDevices.getUserMedia({ audio: { noiseSuppression: noiseSuppression } })
			.then((stream) => {
				audioStream = stream;
				const audioContext = new (window.AudioContext || window.webkitAudioContext)();
				const source = audioContext.createMediaStreamSource(stream);

				audioProcessor = audioContext.createScriptProcessor(8192, 1, 1);
				audioProcessor.onaudioprocess = function (e) {
					if (muted) return;
					if (!authed || socket.readyState !== WebSocket.OPEN) return;
					const input = e.inputBuffer.getChannelData(0);

					// caclulate volume
					let sum = 0;
					for (let i = 0; i < input.length; i++) {
						sum += input[i] * input[i];
					}
					const rms = Math.sqrt(sum / input.length);

					const percent = Math.min(1, rms * 5);
					bar.style.height = (percent * 100) + '%';

					if (rms >= TALKING_THRESHOLD) {
						if (!isTalking) {
							isTalking = true;
							setFavicon(FAVICON_TALKING);
						}
						const int16Buffer = new Int16Array(input.length);
						for (let i = 0; i < input.length; i++) {
							let s = Math.max(-1, Math.min(1, input[i]));
							int16Buffer[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
						}
						socket.send(int16Buffer);
					} else {
						if (isTalking) {
							isTalking = false;
							setFavicon(FAVICON_DEFAULT);
						}
					}
				};

				source.connect(audioProcessor);
				audioProcessor.connect(audioContext.destination);
			})
			.catch((error) => {
				console.error('Error accessing media devices:', error);
			});
	}
});