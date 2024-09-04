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
			const size = Math.min(canvas.width, canvas.height);
			if (canvas.width > canvas.height) {
				context.drawImage(img, 0, 0, size * ratio, size);
			} else {
				context.drawImage(img, 0, 0, size, size / ratio);
			}

			allocateImageData();
			color2bw();
		};
		img.src = event.target.result;
	};
	reader.readAsDataURL(file);
}

let ImageDataPointer = undefined;
let imageDataMemory = new Uint8ClampedArray();
let imageDataLength = 0;

/**
 * Allocate memory for image data on image change
 */
function allocateImageData() {
	if (!ImageDataPointer) hello.exports.free(ImageDataPointer); // free old memory if exists
	let colorData = colorCanvasContext.getImageData(0, 0, colorCanvas.width, colorCanvas.height); // get colordata
	imageDataLength = colorData.data.length * colorData.data.BYTES_PER_ELEMENT; // image data length in bytes
	ImageDataPointer = hello.exports.malloc(imageDataLength); // allocate bytes and get pointer
	imageDataMemory = new Uint8ClampedArray(hello.exports.memory.buffer, ImageDataPointer, imageDataLength); // get memory area
}

allocateImageData();

function color2bw() {
	imageDataMemory.set(colorCanvasContext.getImageData(0, 0, colorCanvas.width, colorCanvas.height).data); // copy image data to memory
	hello.exports.color2bw(ImageDataPointer, imageDataLength / 4); // run desaturate wasm code

	let dither = ditherCB.checked ?? true;
	let threshold = dither ? 127 : thresholdSlider.value;
	hello.exports.threshold(ImageDataPointer, imageDataLength / 4, colorCanvas.width, colorCanvas.height, threshold, dither);

	const imageData = new ImageData(imageDataMemory, colorCanvas.width, colorCanvas.height);
	bwCanvas.getContext("2d").putImageData(imageData, 0, 0);
}

let stringPointer = 0;
const textDecoder = new TextDecoder();

function makeBraille() {
	if (!stringPointer) hello.exports.free(stringPointer); // free old memory if exists
	// 8 pixels per braille character (2 wide, 4 tall). 2 bytes per braille character. 1 byte per linefeed. 1 byte for null terminator.
	const stringLength = (Math.ceil(colorCanvas.width / 2) * Math.ceil(colorCanvas.height / 4)) * 3 + (Math.ceil(colorCanvas.height / 4) - 1) + 1; // string length in bytes
	// 100x100 should be 3775
	stringPointer = hello.exports.malloc(stringLength); // allocate bytes and get pointer
	const stringMemory = new Uint8ClampedArray(hello.exports.memory.buffer, stringPointer, stringLength); // get memory area
	hello.exports.toBraille(ImageDataPointer, imageDataLength / 4, colorCanvas.width, colorCanvas.height, stringPointer, stringLength, invertCB.checked ?? false); // convert image to braille
	return textDecoder.decode(stringMemory); // decode string and return
}

// html elements
const thresholdSlider = document.getElementById("threshold");
const ditherCB = document.getElementById("ditherCB");
const invertCB = document.getElementById("invertCB");
const convertButton = document.getElementById("convertButton");
const stringOutput = document.getElementById("output");

convertButton.addEventListener("click", (event) => {
	stringOutput.innerText = makeBraille();
});
thresholdSlider.addEventListener("input", (event) => {
	if (!ditherCB.checked) color2bw();
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
