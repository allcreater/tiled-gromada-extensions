/// <reference types="@mapeditor/tiled-api" />

import * as GromadaResources from "gromada_resources.mjs"
import * as GromadaGraphics from "gromada_graphics.mjs"

function readVids(fileName) {
    tiled.log("begin loading " + fileName)

    const file = new BinaryFile(fileName, BinaryFile.ReadOnly)
    
    let vids = []
    for (let section of GromadaResources.readSectionsNew(file)) { 
        if (section.type !== GromadaResources.Section_Vid)
            continue

        vids.push(GromadaResources.readVid(section.readData()))
    }
    file.close()

    // link together duplicated graphics data
    for (let vid of vids) {
        if (typeof vid.graphics === "number") {
            vid.graphics = vids[vid.graphics]
        }
    }

    return vids
}

tiled.registerTilesetFormat("gromada", {
        name: "Gromada",
        extension: "res",
        read: (fileName) => {
            const vids = readVids(fileName)

            const result = new Tileset("Gromada res")
            result.objectAlignment = Tileset.Center
            result.tileRenderSize = Tileset.TileSize
            result.orientation = Tileset.Orthogonal
            
            for (const [nvid, vid] of vids.entries()) {
                if (vid.class == 0 ) {
                    tiled.log(`found vid = ${nvid} with vb =${vid.graphics.dataFormat}`)


                    for (let i = 0; i < vid.graphics.numOfFrames; ++i){
                        tiled.log(`processing frame ${i}/${vid.graphics.numOfFrames}`)
                        const image = GromadaGraphics.decodeFrame(vid.graphics, i)
                        if (image) {
                            const tile = result.addTile()
                            tile.setImage(image)
                            tile.setProperty("Vid", nvid)
                            tile.setProperty("referenceFrameNumber", vid.graphics.frames[i].referenceFrameNumber)
                        }
                    }
                }
            }

            return result
        }
    }
)

//tiled.