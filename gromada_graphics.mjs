/// <reference types="@mapeditor/tiled-api" />

function decodeFrame_format2(vidGraphics, frameData) {
    const image = new Image(vidGraphics.imgWidth, vidGraphics.imgHeight, Image.Format_RGBA8888)
    image.fill(0x00000000)
    
    tiled.log(`len = ${frameData.byteLength}`)

    let dataView = new DataView(frameData)
    const startY = dataView.getUint16(0, true)
    const height = dataView.getUint16(2, true)

    let dataOffset = 4
    for (let y = startY; y < startY + height; ++y){
        for (let x = 0, currentByte = 0; (currentByte = dataView.getUint8(dataOffset++)) != 0; ) {
            const count = currentByte & 0x3F;
            switch (currentByte & 0xC0) {
                case 0x00:
                    x += count;
                    break;
                case 0x40:
                    for (let i = 0; i < count; ++i){
                        image.setPixel(x++, y, 0x0000007F)
                    }
                    break;
                case 0x80:
                    for (let i = 0; i < count; ++i){
                        const index = dataView.getUint8(dataOffset++)
                        image.setPixel(x++, y, vidGraphics.palette[index])
                    }
                    break;
                case 0xC0:
                    const index = dataView.getUint8(dataOffset++)
                    for (let i = 0; i < count; ++i){
                        image.setPixel(x++, y, vidGraphics.palette[index])
                    }
                    break;
            }
        }
    }

    return image
}

function decodeFrame(vidGraphics, frameIndex) {
    const frameData = vidGraphics.frames[frameIndex].data

    const decodedImage = ({
        0 : () => {return new Image(frameData, vidGraphics.imgWidth, vidGraphics.imgHeight, Image.Format_Indexed8)},
        2 : () => decodeFrame_format2(vidGraphics, frameData),
    }[vidGraphics.dataFormat] ?? (() => null))();

    if (decodedImage && decodedImage.format == Image.Format_Indexed8) {
        decodedImage.setColorTable(vidGraphics.palette)
    }
    
    return decodedImage
}


export {decodeFrame}