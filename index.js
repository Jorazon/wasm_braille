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


function color2bw() {
	const colorData = colorCanvas.getContext("2d").getImageData(0, 0, colorCanvas.width, colorCanvas.height);

	const memory = new DataView(hello.exports.memory.buffer);

	for (let index = 0; index < memory.length; index++) {
		memory.setUint8(index, colorData[index]);
	}

	hello.exports.color2bw(colorData.width, colorData.height, colorData.data);

	const buffer = new Uint8ClampedArray(colorData.width * colorData.height * 4);

	for (let index = 0; index < buffer.length; index++) {
		buffer[index] = memory.getUint8(index);
	}

	const bwData = new ImageData(buffer, colorCanvas.width, colorCanvas.height);

	bwCanvas.getContext("2d").putImageData(bwData, 0, 0);
}

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