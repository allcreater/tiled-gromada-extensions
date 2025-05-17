/// <reference types="@mapeditor/tiled-api" />

import * as GromadaResources from "gromada_resources.mjs"
import * as GromadaGraphics from "gromada_graphics.mjs"

export function readVids(fileName) {
    tiled.log("begin loading " + fileName)

    const file = new BinaryFile(fileName, BinaryFile.ReadOnly)
    
    let vids = []
    for (let section of GromadaResources.readSections(file)) { 
        if (section.type !== GromadaResources.Section_Vid)
            continue

        vids.push(GromadaResources.readVid(section.readData()))
    }
    file.close()

    // link together duplicated graphics data
    for (const [nvid, vid] of vids.entries()) {
        if (typeof vid.graphics === "number") {
            vid.graphics = vids[vid.graphics].graphics
        }

        vid.index = nvid
        Object.freeze(vid)
    }

    return vids
}

function getAnimationFrameRange (vid, direction) {
    const animationLength = vid.animationLengths[0]
    const roundAddition = Math.floor(Math.floor(0xFF / vid.directionsCount) / 2);
    const animationStartIndex = Math.floor(((Math.floor(direction) + roundAddition) & 0xFF) * vid.directionsCount / 256) * animationLength;

    return [animationStartIndex, animationStartIndex + Math.max(animationLength-1, 0)]
}

function getOrCreateTile(vid, frameIndex, frameCache, createTileCallback) {
    const key = `${vid.index}, ${frameIndex}`
    let cachedTile = frameCache.get(key)
    if (cachedTile) {
       // tiled.log(`key ${key} found`)
        return cachedTile
    }

    cachedTile = createTileCallback(vid, frameIndex)
    frameCache.set(key, cachedTile)
    return cachedTile
}

function addVidTiles (tileset, vid, frameCache) {
    function* iterateDirections(directionsCount) {
        // suboptimal but no need to implement reverse function
        for (let i = 0; i < 256; ++i) {
            yield [i, i, i+1]
        }
    }

    for (const [i, from, to] of iterateDirections(vid.directionsCount)) {
        const [firstFrame, lastFrame] = getAnimationFrameRange(vid, from)
        
        getOrCreateTile(vid, firstFrame, frameCache, (vid, frameIndex) => {
            //tiled.log(`creating ${vid.index} ${frameIndex}`)
            const image = GromadaGraphics.decodeFrame(vid.graphics, frameIndex)
            if (!image) {
                //tiled.warn(`[${vid.index}] image # ${frameIndex} rejected `)
                return null
            }

            const tile = tileset.addTile()
            tile.setImage(image)
            tile.setProperty("gromada.nvid", vid.index)
            //tile.setProperty("gromada.direction_from", from)
            //tile.setProperty("gromada.direction_to", to)

            return tile
        })
    }
}

tiled.registerTilesetFormat("gromada", {
        name: "Gromada",
        extension: "res",
        read: (fileName) => {
            const vids = readVids(fileName)

            const tileset = new Tileset("Gromada res")
            tileset.objectAlignment = Tileset.Center
            tileset.tileRenderSize = Tileset.TileSize
            tileset.orientation = Tileset.Orthogonal
            
            const framesCache = new Map()
            for (const vid of vids) {
                //if (vid.class == 0 ) {
                    addVidTiles(tileset, vid, framesCache)
                //}
            }

            tileset.vidsList = vids
            tiled.project.gromadaVidsList = vids
            tiled.project.gromadaTileset = tileset
            tiled.project.gromadaGetTileForDirection = (nvid, direction) => {
                const [firstFrame, _] = getAnimationFrameRange(vids[nvid], direction)
                
                let cachedTile = getOrCreateTile(vids[nvid], firstFrame, framesCache, (vid, frameIndex)=> null) //throw new Error(`[${vid.index}, ${frameIndex}] is not exists`)
                return cachedTile
            }

            tiled.project.setProperty("gromada.fwres_filename", fileName)

            return tileset
        }
    }
)

//tiled.