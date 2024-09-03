#include <stdio.h>
#include <stdint.h>
#include <emscripten/emscripten.h>

int main() {
	return 0;
}

int EMSCRIPTEN_KEEPALIVE square(int n) {
	return n * n;
}

/**
 * @brief Color data to luma conversion.
 * 
 * @param dataPtr Pointer to start of RGBA data
 * @param dataLength Length of data
 */
void EMSCRIPTEN_KEEPALIVE color2bw(uint8_t* dataPtr, size_t dataLength) {
	for (size_t i = 0; i < dataLength; i += 4) {
		uint8_t R, G, B;
		R = dataPtr[i + 0];
		G = dataPtr[i + 1];
		B = dataPtr[i + 2];
		// https://stackoverflow.com/a/596241
		uint8_t luma = ((R << 1) + R + (G << 2) + B) >> 3;
		dataPtr[i + 0] = luma;
		dataPtr[i + 1] = luma;
		dataPtr[i + 2] = luma;
	}
};

void index2xy(size_t index, size_t width, size_t* x, size_t* y){
	*x = index % width;
	*y = index / width;
}

/**
 * @brief Threshold image data to black and white with optional floyd-steinberg dithering.
 * 
 * @param threshold Threshold
 * @param width Image width
 * @param dither Boolean toggle for dithering
 * @param dataPtr Pointer to start of RGBA data
 * @param dataLength Length of data
 */
void EMSCRIPTEN_KEEPALIVE threshold(uint8_t threshold, size_t width, int dither, uint8_t* dataPtr, size_t dataLength) {
	size_t x, y;
	for (size_t i = 0; i < dataLength; i += 4) {
		index2xy(i, width * 4, &x, &y);
		uint8_t oldpixel = dataPtr[i];
        uint8_t newpixel = oldpixel >= threshold;
		newpixel *= 255; // debug
        dataPtr[i] = newpixel;
        dataPtr[i+1] = newpixel;
        dataPtr[i+2] = newpixel;
		if (dither) {
			uint8_t quant_error = oldpixel - newpixel;

			uint8_t qe1 = quant_error * 7 / 16;
			uint8_t qe2 = quant_error * 3 / 16;
			uint8_t qe3 = quant_error * 5 / 16;
			uint8_t qe4 = quant_error * 1 / 16;

			size_t idx1 = i + 4;
			size_t idx2 = i - 4 + width * 4;
			size_t idx3 = i     + width * 4;
			size_t idx4 = i + 4 + width * 4;
// TODO oob check
			if (dataPtr[idx1] < 255 - qe1) {
				dataPtr[idx1] += qe1;
			} else {
				dataPtr[idx1] = 255;
			}

			if (dataPtr[idx2] < 255 - qe2) {
				dataPtr[idx2] += qe2;
			} else {
				dataPtr[idx2] = 255;
			}

			if (dataPtr[idx3] < 255 - qe3) {
				dataPtr[idx3] += qe3;
			} else {
				dataPtr[idx3] = 255;
			}

			if (dataPtr[idx4] < 255 - qe4) {
				dataPtr[idx4] += qe4;
			} else {
				dataPtr[idx4] = 255;
			}
		}
	}
}

const uint_least16_t offset = 0x2800;

/*
Bit order
1 4
2 5
3 6
7 8
*/

uint_least16_t toChar(uint8_t bits) {
	return offset + bits;
}

size_t characterCount(size_t width, size_t height){
	return (width + 1) / 2 * (height + 3) / 4 + 2 * (height - 1);
}

void EMSCRIPTEN_KEEPALIVE toBraille(size_t width, uint8_t* dataPtr, size_t dataLength) {
	
}
