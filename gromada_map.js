/// <reference types="@mapeditor/tiled-api" />

tiled.registerMapFormat("gromada", {
	name: "Gromada",
	extension: "map",

	write: (map, fileName) => {

    },

    read: (fileName) => {
        let result = new TileMap()
        
        return result
    }

})