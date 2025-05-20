window.addEventListener('load', () => {
    const socket = new WebSocket('/');

    const params = new URLSearchParams(window.location.search);
    const plot = params.get('plot');
    const id = params.get('id');

    socket.onopen = () => {
        console.log('WebSocket connection established.');

        if (plot && id) {
            socket.send(`${plot},${id}`);
        } else {
            console.error('Missing plot or id in the URL.');
            alert("Tried connecting without a plotId and userId")
            socket.close();
        }
    };

    socket.onmessage = (event) => {
        console.log('Message from server:', event.data);
    };

    socket.onerror = (error) => {
        console.error('WebSocket error:', error);
    };

    socket.onclose = () => {
        console.log('WebSocket connection closed.');
    };
});