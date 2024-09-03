import wasiPolyfill from "./wasiPolyfill.js";

const importObject = {
	env: wasiPolyfill,
	wasi_snapshot_preview1: wasiPolyfill,
	memoryBase: 0,
	tableBase: 0,
	memory: new WebAssembly.Memory({
		initial: 256,
	}),
	table: new WebAssembly.Table({
		initial: 0,
		element: 'anyfunc',
	}),
};

let hello = await fetch("hello.wasm")
	.then(bytes => bytes.arrayBuffer())
	.then(buffer => WebAssembly.compile(buffer))
	.then(module => {
		console.log(module);
		let instance = new WebAssembly.Instance(module, importObject);
		wasiPolyfill.memory = instance.exports.memory;
		return instance;
	})

console.log(
	hello.exports.square(13)
);

const colorCanvas = document.getElementById("colorCanvas");
const colorCanvasContext = colorCanvas.getContext("2d", { willReadFrequently: true });
const bwCanvas = document.getElementById("bwCanvas");

function drawImageToCanvas(canvas, file) {
	const context = canvas.getContext("2d");
	if (context == null) console.log("Couldn't get 2D drawing context");

	const reader = new FileReader();
	reader.onload = function (event) {
		const img = new Image();
		img.onload = function () {
			// Clear the canvas
			context.clearRect(0, 0, canvas.width, canvas.height);

			// Draw the image to fit within the canvas
			const ratio = img.width / img.height;
			if (ratio < 1) {
				context.drawImage(img, (canvas.width / 2) - (canvas.height * ratio / 2), 0, canvas.width * ratio, canvas.height);
			} else if (ratio > 1) {
				context.drawImage(img, 0, (canvas.height / 2) - (canvas.height / ratio / 2), canvas.width, canvas.height / ratio);
			} else {
				context.drawImage(img, 0, 0, canvas.width, canvas.height);
			}

			color2bw();
		};
		img.src = event.target.result;
	};
	reader.readAsDataURL(file);
}

let colorData = colorCanvasContext.getImageData(0, 0, colorCanvas.width, colorCanvas.height);
const dataLength = colorData.data.length * colorData.data.BYTES_PER_ELEMENT;
const dataPtr = hello.exports.malloc(dataLength);
const imageDataMemory = new Uint8ClampedArray(hello.exports.memory.buffer, dataPtr, dataLength);

function color2bw() {
	colorData = colorCanvasContext.getImageData(0, 0, colorCanvas.width, colorCanvas.height);
	// copy imagedata into wasm memory
	imageDataMemory.set(colorData.data);
	// run desaturate wasm code
	hello.exports.color2bw(dataPtr, dataLength);
	let dither = ditherCB.checked ?? true;
	let threshold = dither ? 1.0 : thresholdSlider.value / (thresholdSlider.max - thresholdSlider.min);
	hello.exports.threshold(threshold, colorCanvas.width, dither, dataPtr, dataLength);

	const imageData = new ImageData(imageDataMemory, colorCanvas.width, colorCanvas.height);
	bwCanvas.getContext("2d").putImageData(imageData, 0, 0);
}

const thresholdSlider = document.getElementById("threshold");
const ditherCB = document.getElementById("ditherCB");

thresholdSlider.addEventListener("input", (event) => {
	if (!ditherCB.checked ?? false) color2bw();
});
ditherCB.addEventListener("input", (event) => {
	color2bw();
});

/**
 * Handle file drop events
 * @param {Event} event
 */
function dropHandler(event) {
	const files = [];
	if (event.dataTransfer.items) {
		// Use DataTransferItemList interface to access the file(s)
		[...event.dataTransfer.items].forEach((item, i) => {
			// If dropped items aren't files, reject them
			if (item.kind === "file") {
				files.push(item.getAsFile());
			}
		});
	} else {
		files.push(...event.dataTransfer.files);
	}
	drawImageToCanvas(colorCanvas, files[0]);
}

function preventDefault(event) {
	event.preventDefault();
	event.stopPropagation();
}

Array.from(document.getElementsByClassName("dropzone"))
	.forEach(
		(zone) => {
			zone.addEventListener("dragenter", (event) => {
				preventDefault(event);
			});
			zone.addEventListener("dragleave", (event) => {
				preventDefault(event);
			});
			zone.addEventListener("dragover", (event) => {
				preventDefault(event);
			});
			zone.addEventListener("drop", (event) => {
				preventDefault(event);
				dropHandler(event);
				const fileinput = zone.getElementsByTagName("input")[0];
				fileinput.files = event.dataTransfer.files;
				fileinput.dispatchEvent(new Event("change"));
			});
		}
	);

Array.from(document.getElementsByTagName("input")).forEach((input) => {
	if (input.type == "file") {
		input.addEventListener("change", (event) => {
			drawImageToCanvas(colorCanvas, event.target.files[0]);
		})
	}
})