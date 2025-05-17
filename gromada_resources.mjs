/// <reference types="@mapeditor/tiled-api" />

function readVid(data /*: DataView*/) {
    //var d = new TextDecoder("cp866")
    //tiled.log(d.decode(data))

    const graphicsOffset = 71 + 144 + 32 + 16
    const dataSizeOrNvid = data.getInt32(graphicsOffset, true)

    const makeRGBA32Palette = (array/* : ArrayBuffer*/) => {
        const srcData = new Uint8Array(array, 0, 0x300)
        const outArray = new Uint32Array(0x100)
        for (let i = 0; i < outArray.length; ++i) {
            outArray[i] = srcData[i*3 + 2] | (srcData[i*3 + 1] << 8) | (srcData[i*3] << 16) | 0xFF << 24
        }

        return outArray
    }

    const readGraphics = () => {
        const numOfFrames = data.getUint16(graphicsOffset + 7, true)
        const dataSize = data.getUint32(graphicsOffset + 9, true)

        let framesData = data.buffer.slice(graphicsOffset + 17 + 0x300, graphicsOffset + 17 + dataSize)
        const frames = []
        for (let i = 0; i < numOfFrames; ++i) {
            const header = new DataView(framesData, 0, 6)

            const frameDataSize = header.getUint32(0, true)
            const referenceFrameNumber = header.getInt16(4, true)

            frames.push({
                referenceFrameNumber : referenceFrameNumber,
                data : referenceFrameNumber >= 0 ? frames[referenceFrameNumber].data : framesData.slice(6, 4 + frameDataSize)
            })
            framesData = framesData.slice(4 + frameDataSize)
        }
        
        return {
            dataFormat : data.getUint8(graphicsOffset + 4),
            hz7 : data.getUint16(graphicsOffset + 5, true),
            numOfFrames : numOfFrames,
            dataSize: dataSize,
            imgWidth : data.getUint16(graphicsOffset + 13, true),
            imgHeight : data.getUint16(graphicsOffset + 15, true),
            palette : makeRGBA32Palette(data.buffer.slice(graphicsOffset + 17, graphicsOffset + 17 + 0x300)),
            frames: frames,
        }
    }

    return {
        type: data.getUint8(34),
        class: data.getUint8(35),
        flags: data.getUint16(36, true),

        collisionMask: data.getUint8(38),
        anotherWidth: data.getUint16(39, true),
        anotherHeight: data.getUint16(41, true),
        z_or_height: data.getUint16(43, true),
        maxHP: data.getUint8(45),
        gridRadius: data.getUint16(46, true),
        p6: data.getUint8(48),

        speedX: data.getUint16(49, true),
        speedY: data.getUint16(51, true),
        acceleration: data.getUint16(53, true),
        rotationPeriod: data.getUint8(55),

        army: data.getUint8(56),
        someWeaponIndex: data.getUint8(57),
        hz4: data.getUint8(58),
        deathDamageRadius: data.getUint16(59, true),
        deathDamage: data.getUint8(61),

        linkX: data.getUint8(62),
        linkY: data.getUint8(63),
        linkZ: data.getUint8(64),
        linkedObjectVid: data.getUint16(65, true),

        hz6: data.getUint16(67, true),
        directionsCount: data.getUint8(69),
        z: data.getUint8(70),
        animationLengths: new Int8Array(data.buffer, 71, 16),

        graphics : dataSizeOrNvid > 0 ? readGraphics() : -dataSizeOrNvid
    }
}

function readSectionHeader(file) {
    let view = new DataView(file.read(11))
    let nextSectionOffset = view.getUint32(1, true)
    let dataOffset = view.getUint16(9, true)

    file.read(dataOffset) // just skip

    return {
        type: view.getUint8(0),
        elementCount: view.getUint32(5, true),
        dataSize: nextSectionOffset - 6 - dataOffset
    }
}


function* readSections(file) {
    file.seek(0)
    let sectionCount = new DataView(file.read(4)).getUint32(0, true)
    
    for (let i = 0; i < sectionCount; i++) {
        const header = readSectionHeader(file)

        const currentSectionPos = file.pos
        const nextSectionPos = currentSectionPos + header.dataSize
        
        yield {
            type : header.type,
            elementCount: header.elementCount,
            readData : () => {
                file.seek(currentSectionPos)
                return new DataView(file.read(header.dataSize))
            }
        }

        file.seek(nextSectionPos)
    }
}


export const Section_MapInfo = 1
export const Section_MapObjects = 2
export const Section_MapCommand = 4

export const Section_Vid = 33
export const Section_Sound = 34
export const Section_Weapon = 35

export {readSections, readVid, readMapPreamble}