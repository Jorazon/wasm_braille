#include <stdio.h>
#include <stdint.h>
#include <emscripten/emscripten.h>

int main() {
    return 0;
}

int EMSCRIPTEN_KEEPALIVE square(int n) {
    return n * n;
}

int clamp(int value, int min, int max) {
    return ((value > max) ? max : ((value < min) ? min : value));
}

struct pixel
{
    uint8_t R, G, B, A;
};

void setPixelRGB(struct pixel* pixel, uint8_t value) {
    pixel->R = value;
    pixel->G = value;
    pixel->B = value;
}

/**
 * @brief Color data to luma conversion.
 * 
 * @param dataPtr Pointer to start of RGBA data
 * @param dataLength Length of data
 */
void EMSCRIPTEN_KEEPALIVE color2bw(struct pixel* dataPtr, size_t dataLength) {
    for (size_t i = 0; i < dataLength; ++i) {
        struct pixel* P = &dataPtr[i];
        // https://stackoverflow.com/a/596241
        uint8_t luma = (P->R * 3 + P->G * 4 + P->B) >> 3;
        setPixelRGB(P, clamp(luma, 0, 255));
    }
};

void index2xy(size_t index, size_t width, size_t* x, size_t* y){
    *x = index % width;
    *y = index / width;
}

size_t xy2index(size_t width, size_t x, size_t y) {
    return y * width + x;
}

/**
 * @brief Threshold image data to black and white with optional floyd-steinberg dithering.
 * 
 * @param dataPtr Pointer to start of RGBA data
 * @param dataLength Length of data
 * @param width Image width
 * @param height Image height
 * @param threshold Threshold
 * @param dither Boolean toggle for dithering
 */
void EMSCRIPTEN_KEEPALIVE threshold(struct pixel* dataPtr, size_t dataLength, size_t width, size_t height, uint8_t threshold, int dither) {
    for (size_t y = 0; y < height; ++y) {
        for (size_t x = 0; x < width; ++x) {
            size_t index = xy2index(width, x, y); // calculate index
            struct pixel* P = &dataPtr[index]; // get pixel
            uint8_t oldpixel = P->R; // get pixel value
            uint8_t newpixel = (oldpixel > threshold) * 255; // calculate new value
            setPixelRGB(P, clamp(newpixel, 0, 255)); // set new value
            
            if (dither) {
                int quant_error = oldpixel - newpixel; // calculate error
                
                int oobArr[] = {
                    x + 1 < width,
                    x - 1 >= 0 && y + 1 < height,
                    y + 1 < height,
                    x + 1 < width && y + 1 < height
                };
                
                size_t idxArr[] = {
                    xy2index(width, x + 1, y),
                    xy2index(width, x - 1, y + 1),
                    xy2index(width, x, y + 1),
                    xy2index(width, x + 1, y + 1)
                };
                
                int qeArr[] = {
                    quant_error * 7 / 16,
                    quant_error * 3 / 16,
                    quant_error * 5 / 16,
                    quant_error * 1 / 16
                };
                
                for (size_t i = 0; i < 4; i++)
                {
                    if (oobArr[i]) {
                        setPixelRGB(&dataPtr[idxArr[i]], clamp(dataPtr[idxArr[i]].R + qeArr[i], 0, 255));
                    }
                }
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
