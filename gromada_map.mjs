/// <reference types="@mapeditor/tiled-api" />

import * as GromadaResources from "gromada_resources.mjs"
import { Section_MapObjects } from "gromada_resources.mjs"
import { readVids } from "gromada_tileset.mjs"

function readMapPreambleSection(data/* : DataView*/) {
    return {
        width: data.getUint32(0, true),
        height: data.getUint32(4, true),
        observerX: data.getInt16(8, true),
        observerY: data.getInt16(10, true),
        // skipping 8 unknown bytes
        startTimer: data.getUint32(20, true),
        version : data.byteLength >= 28 ? data.getUint32(24, true) : 0,
    }
}

function readMapObjectsSection (version, data, vids) {
    let dataOffset = 0
    let incOffset = (offset) => {
        dataOffset = dataOffset + offset
        return dataOffset - offset
    }

    const readPayload = (type) => {
        const storageType0 = new Set([9, 10, 12, 19])
        const storageType1 = new Set([0, 1, 5, 6, 7, 8, 11, 14, 15, 16, 18, 20])
        const storageType2 = new Set([2, 3, 4, 13, 17])

        let payload = {}
        if (storageType1.has(type) || storageType2.has(type)) {
            payload.hp = data.getUint8(incOffset(1))
        }
        if (storageType2.has(type)) {
            if (version > 2)
                payload.buildType = data.getUint8(incOffset(1))

            if (version > 1)
                payload.army = data.getUint8(incOffset(1))

            payload.behavior = data.getUint8(incOffset(1))

            if (version > 0) {
                payload.inventory = new Array
                for (let nvid = 0; (nvid = data.getInt16(incOffset(2), true)) > 0; ) {
                    //tiled.log("item " + nvid)
                    payload.inventory.push(nvid)
                }
            }
        }

        if (Object.keys(payload).length === 0 && !storageType0.has(type))
            throw "Incorrect object type"

        return payload
    }

    const objects = new Array
    for (let nvid = 0; (nvid = data.getInt16(incOffset(2), true)) > 0; ) {
        const x = data.getUint16(incOffset(2), true)
        const y = data.getUint16(incOffset(2), true)
        const z = data.getUint16(incOffset(2), true)
        const direction = data.getUint16(incOffset(2), true)

        //tiled.log(`object ${nvid} at (${x}, ${y})`)
        objects.push({
            nvid : nvid,
            x: x,
            y: y,
            z: z,
            direction : direction,
            payload : readPayload(vids[nvid].class)
        })
    }

    return objects
}

function loadMap(fileName, vids) {
    const file = new BinaryFile(fileName, BinaryFile.ReadOnly)
    const sections = GromadaResources.readSections(file)

    // const preamble = (() => {
    //     const section = sections.next()
    //     if (section.type != GromadaResources.Section_MapInfo) {
    //         throw new Error("Unsupported map")
    //     }
    
    //     return readMapPreambleSection(section.readData())
    // })()

    
    let preamble = null
    let objects = null
    for (const section of sections) {
        if (section.type == GromadaResources.Section_MapInfo) {
            preamble = readMapPreambleSection(section.readData())
            tiled.log(`Map version is ${preamble.version}`)
        }
        if (section.type == GromadaResources.Section_MapObjects) {
            objects = readMapObjectsSection(preamble.version, section.readData(), vids)

        }
    }

    file.close()

    return {
        header : preamble,
        objects : objects,
    }
}

function getTileset() {
    const filename = tiled.project.property("gromada.fwres_filename")
    if (tiled.project.gromadaTileset && tiled.project.gromadaTileset.vidsList) {
        tiled.log("using cached Gromada tileset")
    } else {
        tiled.log(`tileset is not loaded, but located in ${filename}, trying to reload...`)
        tiled.project.gromadaTileset = tiled.tilesetFormat("gromada").read(filename)
    }

    if (tiled.project.gromadaTileset) {
        return tiled.project.gromadaTileset
    }
}

// function getVids() {
//     if (tiled.project.gromadaVidsList) {
//         tiled.log("using cached vids")
//     } else if (tiled.project.property("gromada.fwres_filename")) {
//         const filename = tiled.project.property("gromada.fwres_filename")
//         tiled.log(`vids is not loaded, but located in ${filename}, trying to reload...`)
//         tiled.project.gromadaVidsList = readVids(filename)
//         tiled.log(`ok`)
//     }

//     if (tiled.project.gromadaVidsList)
//         return tiled.project.gromadaVidsList

//     throw new Error("a map require a vids array to be loaded")
// }

tiled.registerMapFormat("gromada", {
	name: "Gromada",
	extension: "map",

	// write: (map, fileName) => {

    // },

    read: (fileName) => {
        const tileset = getTileset()
        const vids = tiled.project.gromadaVidsList//tileset.vidsList

        const gromadaMap = loadMap(fileName, vids)

        let tiledMap = new TileMap()
        tiledMap.addTileset(tileset)

        tiledMap.tileWidth = 80
        tiledMap.tileHeight = 50
        tiledMap.infinite = false
        tiledMap.height = gromadaMap.header.height / tiledMap.tileHeight
        tiledMap.width = gromadaMap.header.width / tiledMap.tileWidth
        

        const groundLayer = new TileLayer("Ground")
        groundLayer.height = tiledMap.height
        groundLayer.width = tiledMap.width

        const groundLayerEdit = groundLayer.edit()

        const objectsLayer = new ObjectGroup("Objects")
        
        for (const object of gromadaMap.objects) {
            const vid = vids[object.nvid]

            switch (vid.class) {
                case 0:
                    {
                        //groundLayer.cellAt(object.x, object.y);
                        groundLayerEdit.setTile(object.x / tiledMap.tileWidth, object.y / tiledMap.tileHeight, tiled.project.gromadaGetTileForDirection(object.nvid, object.direction))
                    } break;
                default:
                    const mapObject = new MapObject()
                    mapObject.shape = MapObject.Rectangle
                    mapObject.pos = {x : object.x, y : object.y}
                    //mapObject.rotation = object.direction * 360 / 256
                    //mapObject.size = {width : vid.anotherWidth, height: vid.anotherHeight}
                    mapObject.size = {width : vid.graphics.imgWidth, height: vid.graphics.imgHeight}

                    mapObject.tile = tiled.project.gromadaGetTileForDirection(object.nvid, object.direction)
                    

                    objectsLayer.addObject(mapObject)
            } 
        }
        
        

        groundLayerEdit.apply()
        tiledMap.addLayer(groundLayer)
        tiledMap.addLayer(objectsLayer)


        return tiledMap
    }

})

