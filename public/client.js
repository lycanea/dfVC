window.addEventListener('load', () => {
	const socket = new WebSocket('/');

	const params = new URLSearchParams(window.location.search);
	const plot = params.get('plot');
	const id = params.get('id');
	let authed = false;
	let audioStream = null;
	let audioProcessor = null;
	let isTalking = false;
	const TALKING_THRESHOLD = 0.02; // Adjust as needed
	const FAVICON_DEFAULT = 'icon.png';
	const FAVICON_TALKING = 'iconTalking.png';

	// --- Visualizer Bar Setup ---
	const visualizer = document.createElement('div');
	visualizer.style.position = 'fixed';
	visualizer.style.top = '10px';
	visualizer.style.left = '10px';
	visualizer.style.width = '200px';
	visualizer.style.height = '10px';
	visualizer.style.background = '#eee';
	visualizer.style.border = '1px solid #ccc';
	visualizer.style.zIndex = 1000;

	const bar = document.createElement('div');
	bar.style.height = '100%';
	bar.style.width = '0%';
	bar.style.background = '#4caf50';
	bar.style.transition = 'width 0.05s linear';

	visualizer.appendChild(bar);
	document.body.appendChild(visualizer);
	// --- End Visualizer Bar Setup ---

	function base64ToArrayBuffer(base64) {
		var binaryString = atob(base64);
		var bytes = new Uint8Array(binaryString.length);
		for (var i = 0; i < binaryString.length; i++) {
			bytes[i] = binaryString.charCodeAt(i);
		}
		return bytes.buffer;
}

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
		} else if (data.type === 'audio') {
			console.log('Update received:', data.data);

			let audioDataArr = data.data;
			if (data.data && Array.isArray(data.data)) {
				audioDataArr = data.data;
			} else if (data.data && data.data.type === 'Buffer' && Array.isArray(data.data.data)) {
				audioDataArr = data.data.data;
				console.log(data.da)
			}

			const audioData = new Int16Array(audioDataArr);

			if (audioData.length === 0) {
				console.warn('Received empty audio buffer, skipping playback.');
				return;
			}

			const audioContext = window._receivedAudioContext || (window._receivedAudioContext = new (window.AudioContext || window.webkitAudioContext)());
			const float32Buffer = new Float32Array(audioData.length);
			for (let i = 0; i < audioData.length; i++) {
				float32Buffer[i] = audioData[i] / 32768;
			}
			const buffer = audioContext.createBuffer(1, float32Buffer.length, audioContext.sampleRate);
			buffer.copyToChannel(float32Buffer, 0);
			const source = audioContext.createBufferSource();
			source.buffer = buffer;
			source.connect(audioContext.destination);
			source.start();
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
		bar.style.width = '0%'; // Reset visualizer
	};

	function startSendingAudio() {
		if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) return;
		navigator.mediaDevices.getUserMedia({ audio: true })
			.then((stream) => {
				audioStream = stream;
				const audioContext = new (window.AudioContext || window.webkitAudioContext)();
				const source = audioContext.createMediaStreamSource(stream);

				audioProcessor = audioContext.createScriptProcessor(4096, 1, 1);
				audioProcessor.onaudioprocess = function (e) {
					if (!authed || socket.readyState !== WebSocket.OPEN) return;
					const input = e.inputBuffer.getChannelData(0);

					// Calculate RMS (root mean square) volume
					let sum = 0;
					for (let i = 0; i < input.length; i++) {
						sum += input[i] * input[i];
					}
					const rms = Math.sqrt(sum / input.length);

					// --- Update visualizer bar ---
					const percent = Math.min(1, rms * 5); // scale for visibility
					bar.style.width = (percent * 100) + '%';
					// --- End visualizer bar update ---

					if (rms > TALKING_THRESHOLD) {
						if (!isTalking) {
							isTalking = true;
							setFavicon(FAVICON_TALKING);
						}
						// Convert Float32Array to Int16Array for smaller size
						const int16Buffer = new Int16Array(input.length);
						for (let i = 0; i < input.length; i++) {
							let s = Math.max(-1, Math.min(1, input[i]));
							int16Buffer[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
						}
						socket.send(int16Buffer.buffer);
					} else {
						if (isTalking) {
							isTalking = false;
							setFavicon(FAVICON_DEFAULT);
						}
					}
				};

				source.connect(audioProcessor);
				audioProcessor.connect(audioContext.destination);

				// Optionally play back locally
				
			})
			.catch((error) => {
				console.error('Error accessing media devices:', error);
			});
	}
});