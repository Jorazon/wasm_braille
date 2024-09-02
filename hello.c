#include <stdio.h>
#include <stdint.h>
#include <emscripten/emscripten.h>

int main() {
	return 0;
}

int EMSCRIPTEN_KEEPALIVE square(int n) {
	return n * n;
}

void EMSCRIPTEN_KEEPALIVE color2bw(size_t width, size_t height, uint8_t* data) {
	const int dataLength = width * height * 4;
	for (size_t i = 0; i < dataLength; i += 4) {
		uint8_t R, G, B;
		R = data[i + 0];
		G = data[i + 1];
		B = data[i + 2];
		// https://stackoverflow.com/a/596241
		uint8_t luma = ((R << 1) + R + (G << 2) + B) >> 3;;
		data[i + 0] = luma;
		data[i + 1] = luma;
		data[i + 2] = luma;
	}
};

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