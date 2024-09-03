//Chat
const wasiPolyfill = {
	memory: null,

	// Exits the process with a given exit code
	proc_exit: (exit_code) => {
		console.log(`Process exited with code: ${exit_code}`);
		if (exit_code !== 0) throw new Error(`WASI process exited with code: ${exit_code}`);
	},

	// Writes to a file descriptor, typically stdout (fd=1) or stderr (fd=2)
	// In this simple implementation, we assume fd=1 and fd=2 are for stdout and stderr
	fd_write: (fd, iov, iovcnt, pnum) => {
		let written = 0;
		for (let i = 0; i < iovcnt; i++) {
			const ptr = iov + i * 8;  // Assuming each iov entry is 8 bytes (4 for pointer, 4 for length)
			const bufPtr = new DataView(wasiPolyfill.memory.buffer).getUint32(ptr, true);
			const bufLen = new DataView(wasiPolyfill.memory.buffer).getUint32(ptr + 4, true);
			const bytes = new Uint8Array(wasiPolyfill.memory.buffer, bufPtr, bufLen);
			const text = new TextDecoder('utf8').decode(bytes);

			if (fd === 1) {  // stdout
				console.log(text);
			} else if (fd === 2) {  // stderr
				console.error(text);
			} else {
				console.log(`Write to file descriptor: ${fd}\nText: ${text}`);
			}

			written += bufLen;
		}

		// Store the number of bytes written
		new DataView(wasiPolyfill.memory.buffer).setUint32(pnum, written, true);
		return 0;  // Return 0 to indicate success
	},

	// Closes a file descriptor
	// For this example, we just log and pretend it succeeds
	fd_close: (fd) => {
		console.log(`Closed file descriptor: ${fd}`);
		return 0;  // Return 0 to indicate success
	},

	// Seeks to a position in a file descriptor
	// This is a stub implementation
	fd_seek: (fd, offset_low, offset_high, whence, newOffset) => {
		console.log(`Seek called on fd: ${fd}, offset: ${offset_low}, whence: ${whence}`);
		new DataView(wasiPolyfill.memory.buffer).setUint32(newOffset, 0, true);  // Mock result: set newOffset to 0
		return 0;  // Return 0 to indicate success
	},

	// Copies memory for large data blocks
	emscripten_memcpy_big: (dest, src, num) => {
		new Uint8Array(wasiPolyfill.memory.buffer, dest, num).set(new Uint8Array(wasiPolyfill.memory.buffer, src, num));
		return dest;
	}
};

export default wasiPolyfill;
