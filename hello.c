#include <stdio.h>
#include <stdint.h>
#include <emscripten/emscripten.h>

int main() {
	return 0;
}

int EMSCRIPTEN_KEEPALIVE square(int n) {
	return n * n;
}

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

void EMSCRIPTEN_KEEPALIVE threshold(double threshold, size_t width, int dither, uint8_t* dataPtr, size_t dataLength){
	size_t x, y;
	for (size_t i = 0; i < dataLength; i += 4) {
		index2xy(i, width * 4, &x, &y);
		uint8_t oldpixel = dataPtr[i];
        uint8_t newpixel = (double)oldpixel/255.0 >= threshold;
		if (newpixel < 0) newpixel = 0;
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

/*
dot pattern
hex values
1  8
2  10
4  20
40 80
offset
0x2800
 */