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

/**
 * Get dimensions of image with a given ratio that has pixels closest to but not over count
 * @param {number} count maximim number of pixels
 * @param {number} ratio image width/height ratio
 * @returns {number[]}
 */
function xyFromCount(count, ratio) {
	// 2 is subtracted to account for linefeeds
	let y = (Math.sqrt(count) / Math.sqrt(ratio)) - 2;
	return [Math.floor(y * ratio), Math.floor(y)];
}

// html elements
const thresholdSlider = document.getElementById("threshold");
const thresholdText = document.getElementById("thresholdText");
const ditherCB = document.getElementById("ditherCB");
const invertCB = document.getElementById("invertCB");
const maxLengthCB = document.getElementById("maxLengthCB");
const maxWidthCB = document.getElementById("maxWidthCB");
const maxLength = document.getElementById("maxLength");
const maxWidth = document.getElementById("maxWidth");
const autoconvertCB = document.getElementById("autoconvertCB");
const convertButton = document.getElementById("convertButton");
const stringOutput = document.getElementById("output");

// canvases
const colorCanvas = document.getElementById("colorCanvas");
const colorCanvasContext = colorCanvas.getContext("2d", { willReadFrequently: true });
const bwCanvas = document.getElementById("bwCanvas");

function convert() {
	stringOutput.innerText = makeBraille();
}

thresholdText.innerText = thresholdSlider.value;

convertButton.addEventListener("click", (event) => {
	convert()
});
thresholdSlider.addEventListener("input", (event) => {
	thresholdText.innerText = thresholdSlider.value;
	if (!ditherCB.checked) color2bw();
	if (autoconvertCB.checked) convert();
});
ditherCB.addEventListener("input", (event) => {
	thresholdSlider.disabled = ditherCB.checked;
	color2bw();
	if (autoconvertCB.checked) convert();
});
maxLengthCB.addEventListener("change", (event) => {
	maxWidthCB.checked = false;
	maxWidth.disabled = true;
	maxLength.disabled = false;
	resizeImage();
	color2bw();
	if (autoconvertCB.checked) convert();
});
maxWidthCB.addEventListener("change", (event) => {
	maxLengthCB.checked = false;
	maxLength.disabled = true;
	maxWidth.disabled = false;
	resizeImage();
	color2bw();
	if (autoconvertCB.checked) convert();
});
maxLength.addEventListener("change", (event) => {
	resizeImage();
	color2bw();
	if (autoconvertCB.checked) convert();
});
maxWidth.addEventListener("change", (event) => {
	resizeImage();
	color2bw();
	if (autoconvertCB.checked) convert();
});

let image = new Image();

function resizeImage() {
	const ratio = image.width / image.height;

	if (maxLengthCB.checked) {
		const dimensions = xyFromCount(maxLength.value * 8, ratio);
		colorCanvas.width = dimensions[0];
		colorCanvas.height = dimensions[1];
	} else if (maxWidthCB.checked) {
		colorCanvas.width = maxWidth.value * 2;
		colorCanvas.height = maxWidth.value * 2 / ratio + 3;
	} else {
		colorCanvas.width = image.width;
		colorCanvas.height = image.height;
	}

	colorCanvas.width -= colorCanvas.width % 2;
	colorCanvas.height -= colorCanvas.height % 4;

	bwCanvas.width = colorCanvas.width;
	bwCanvas.height = colorCanvas.height;

	const context = colorCanvas.getContext("2d");
	if (!context) return;
	context.clearRect(0, 0, colorCanvas.width, colorCanvas.height); // Clear the canvas
	context.drawImage(image, 0, 0, colorCanvas.width, colorCanvas.height); // draw image

	allocateImageData();
}

image.onload = function () {
	resizeImage();
	color2bw();
	if (autoconvertCB.checked) convert();
};

/**
 * Load image from file
 * @param {File} file 
 */
function loadImageFromFile(file) {
	const reader = new FileReader();
	reader.onload = function (event) {
		image.src = event.target.result;
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
	if (colorCanvas.width == 0 || colorCanvas.height == 0) return;
	let colorData = colorCanvasContext.getImageData(0, 0, colorCanvas.width, colorCanvas.height); // get colordata
	imageDataLength = colorData.data.length * colorData.data.BYTES_PER_ELEMENT; // image data length in bytes
	ImageDataPointer = hello.exports.malloc(imageDataLength); // allocate bytes and get pointer
	imageDataMemory = new Uint8ClampedArray(hello.exports.memory.buffer, ImageDataPointer, imageDataLength); // get memory area
}

function color2bw() {
	if (colorCanvas.width == 0 || colorCanvas.height == 0 || imageDataMemory.length == 0) return;
	imageDataMemory.set(colorCanvasContext.getImageData(0, 0, colorCanvas.width, colorCanvas.height).data); // copy image data to memory
	hello.exports.color2bw(ImageDataPointer, imageDataLength / 4); // run desaturate wasm code

	let dither = ditherCB.checked ?? true;
	let threshold = dither ? 128 : thresholdSlider.value;
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
	const string = textDecoder.decode(stringMemory);
	return string; // decode string and return
}

// Image dropzone event handling
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
	loadImageFromFile(files[0]);
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
			loadImageFromFile(event.target.files[0]);
		})
	}
})
