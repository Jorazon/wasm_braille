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

void EMSCRIPTEN_KEEPALIVE threshold(double threshold, size_t width, uint8_t* dataPtr, size_t dataLength){
	size_t x, y;
	for (size_t i = 0; i < dataLength; i += 4) {
		index2xy(i, width*4, &x, &y);
		uint8_t oldpixel = dataPtr[i];
        uint8_t newpixel = (double)oldpixel/255.0 < threshold;
		newpixel *= 255; // debug
        dataPtr[i] = newpixel;
        dataPtr[i+1] = newpixel;
        dataPtr[i+2] = newpixel;
        uint8_t quant_error = oldpixel - newpixel;
        dataPtr[i + 4] += quant_error * 7 / 16;
        if (x) dataPtr[i - 4 + width*4] += quant_error * 3 / 16;
        dataPtr[i + width*4] += quant_error * 5 / 16;
        dataPtr[i + 4 + width*4] += quant_error * 1 / 16;
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