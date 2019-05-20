/* config.js
    
    General configuration.
*/

// Full configuration object.
const CONFIG = {
    // Environment paths.
    PATH: {
        // Source paths.
        SRC: {
            // Generic build source path root.
            ROOT: "%%[src]%%",
            
            // SASS build source path.
            SASS: "%%[srcSass]%%",
            
            // JS build source path.
            JS: "%%[srcJs]%%"
        },
        
        // Destination output paths.
        DEST: {
            // Generic build output path root.
            ROOT: "%%[dest]%%",
            
            // SASS build output path.
            SASS: "%%[destSass]%%",
            
            // JS build output path.
            JS: "%%[destJs]%%"
        }
    }
};

// Set up paths
(() => {
    let paths = CONFIG.PATH,
        groups = [ "SRC", "DEST" ];
    
    for (let i=0, l=groups.length; i<l; ++i) {
        let group = paths[groups[i]],
            root = group.ROOT = group.ROOT.replace(/\/+$/, "");
        
        for (let k in group) {
            if (!group.hasOwnProperty(k) || "ROOT" === k) { continue; }
            
            let path = group[k].replace(/^\/+/, "");
            group[k] = root + "/" + path;
        }
    }
})();

module.exports = CONFIG;
