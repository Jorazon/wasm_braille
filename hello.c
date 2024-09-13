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

size_t encode_utf8(char *output, unsigned int codepoint) {
    if (codepoint <= 0x7F) {
        // 1-byte UTF-8
        output[0] = codepoint & 0x7F;
        //output[1] = '\0';
        return 1;
    } else if (codepoint <= 0x7FF) {
        // 2-byte UTF-8
        output[0] = 0xC0 | ((codepoint >> 6) & 0x1F);
        output[1] = 0x80 | (codepoint & 0x3F);
        //output[2] = '\0';
        return 2;
    } else if (codepoint <= 0xFFFF) {
        // 3-byte UTF-8
        output[0] = 0xE0 | ((codepoint >> 12) & 0x0F);
        output[1] = 0x80 | ((codepoint >> 6) & 0x3F);
        output[2] = 0x80 | (codepoint & 0x3F);
        //output[3] = '\0';
        return 3;
    } else if (codepoint <= 0x10FFFF) {
        // 4-byte UTF-8
        output[0] = 0xF0 | ((codepoint >> 18) & 0x07);
        output[1] = 0x80 | ((codepoint >> 12) & 0x3F);
        output[2] = 0x80 | ((codepoint >> 6) & 0x3F);
        output[3] = 0x80 | (codepoint & 0x3F);
        //output[4] = '\0';
        return 4;
    } else {
        // Invalid codepoint
        //output[0] = '\0';
        return 0;
    }
}

/*
Bit order
1 4
2 5
3 6
7 8
*/

void EMSCRIPTEN_KEEPALIVE toBraille(struct pixel* dataPtr, size_t dataLength, size_t width, size_t height, char* stringPointer, size_t stringLength, char invert) {
    char* charIndex = stringPointer;
    for (size_t y = 0; y < height; y += 4) {
        for (size_t x = 0; x < width; x += 2) {
            size_t index = xy2index(width, x, y);

            uint8_t color1 = dataPtr[index + 0 + width * 0].R;
            uint8_t color2 = dataPtr[index + 0 + width * 1].R;
            uint8_t color3 = dataPtr[index + 0 + width * 2].R;
            uint8_t color4 = dataPtr[index + 1 + width * 0].R;
            uint8_t color5 = dataPtr[index + 1 + width * 1].R;
            uint8_t color6 = dataPtr[index + 1 + width * 2].R;
            uint8_t color7 = dataPtr[index + 0 + width * 3].R;
            uint8_t color8 = dataPtr[index + 1 + width * 3].R;

            if (!invert) {
                color1 = 255 - color1;
                color2 = 255 - color2;
                color3 = 255 - color3;
                color4 = 255 - color4;
                color5 = 255 - color5;
                color6 = 255 - color6;
                color7 = 255 - color7;
                color8 = 255 - color8;
            }

            uint8_t alpha1 = dataPtr[index + 0 + width * 0].A;
            uint8_t alpha2 = dataPtr[index + 0 + width * 1].A;
            uint8_t alpha3 = dataPtr[index + 0 + width * 2].A;
            uint8_t alpha4 = dataPtr[index + 1 + width * 0].A;
            uint8_t alpha5 = dataPtr[index + 1 + width * 1].A;
            uint8_t alpha6 = dataPtr[index + 1 + width * 2].A;
            uint8_t alpha7 = dataPtr[index + 0 + width * 3].A;
            uint8_t alpha8 = dataPtr[index + 1 + width * 3].A;

            unsigned int bits = // if pixel color & pixel alpha > 0 bit is 1
            ((color1 & (alpha1 > 0) & 1) << 0) +
            ((color2 & (alpha2 > 0) & 1) << 1) +
            ((color3 & (alpha3 > 0) & 1) << 2) +
            ((color4 & (alpha4 > 0) & 1) << 3) +
            ((color5 & (alpha5 > 0) & 1) << 4) +
            ((color6 & (alpha6 > 0) & 1) << 5) +
            ((color7 & (alpha7 > 0) & 1) << 6) +
            ((color8 & (alpha8 > 0) & 1) << 7);

            if (!bits) bits |= 1; // set top bit if otherwise empty to avoid collapsing whitespace

            charIndex += encode_utf8(charIndex, 0x2800 + bits); // encode character
        }
        charIndex += encode_utf8(charIndex, 0xD); // carriage return
        charIndex += encode_utf8(charIndex, 0xA); // line feed
    }
    charIndex[stringLength - 1] = '\0'; // null terminate
}
